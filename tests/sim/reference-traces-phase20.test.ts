import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stepBattle } from '../../src/game/sim/core/battle-kernel.js';
import { migrateEntity } from '../../src/game/sim/core/migrate.js';
import { createPhase20Systems } from '../../src/game/sim/core/phase20-systems.js';
import { createSnapshot } from '../../src/game/sim/snapshot/snapshot.js';
import type { EffectCommand } from '../../src/game/sim/ability/effect-command.js';
import type { TickInput } from '../../src/game/sim/core/tick-input.js';
import type { BattleModel } from '../../src/game/sim/core/battle-model.js';
import { battle, entity, randomSession } from './test-helpers.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixture = readFileSync(path.join(here, 'fixtures', 'reference-traces-phase20.json'), 'utf8');
const input: TickInput = Object.freeze({ paused: false, decisions: Object.freeze([]), contentVersion: 'content_fixture' });

function mk(id: string, side: 'player' | 'enemy', x100: number, lane: 'top' | 'middle' | 'bottom'): ReturnType<typeof migrateEntity> {
  return migrateEntity({ entity: entity(id, { side, lane, x100, maxLp: 1000, lp: 1000 }), radiusX100: 100 });
}

function spawnEffect(summonId: string, index: number, sourceId: string): EffectCommand {
  return Object.freeze({
    commandId: `spawn_${String(index)}_${summonId}`,
    abilityInstanceId: `inst_summon_${String(index)}`,
    abilityId: 'ability_summon',
    effectIndex: 0,
    sourceId,
    targetRef: Object.freeze({ kind: 'summon_slot' as const, entityId: null, groundKey: null, slotId: null }),
    scheduledTick: 0,
    stage: 'K' as const,
    sourceSnapshot: Object.freeze({ sourceId, sourceLane: 'middle', sourceX100: 1800, sourceLp: 1000, sourceMaxLp: 1000 }),
    sequence: index,
    kind: 'spawn_request' as const,
    summonId,
  });
}

function generateTrace(): string {
  let state: BattleModel = battle({
    simulationVersion: 'phase20-fixture-v1',
    entities: Object.freeze([mk('unit_player_a', 'player', 1800, 'top'), mk('unit_player_b', 'player', 2400, 'middle'), mk('unit_enemy_a', 'enemy', 6200, 'middle'), mk('unit_enemy_b', 'enemy', 7600, 'bottom')]),
    temporaryEntities: Object.freeze([]),
    plannedEffects: Object.freeze([spawnEffect('summon_a', 0, 'unit_player_a'), spawnEffect('summon_b', 1, 'unit_player_b')]),
  });
  const random = randomSession();
  const systems = createPhase20Systems({
    unitTraits: Object.freeze({ unit_player_a: Object.freeze(['kingdom', 'faith']), unit_player_b: Object.freeze(['kingdom']), unit_enemy_a: Object.freeze(['wild']), unit_enemy_b: Object.freeze(['wild']) }),
    spawnPolicies: Object.freeze({ ability_summon: 'BLOCK' }),
    spawnLifetimes: Object.freeze({ ability_summon: 30 }),
  });
  const checkpoints: { tick: number; checksum: string }[] = [];
  let order: string[] = [];
  for (let i = 0; i < 60; i++) {
    const r = stepBattle({ state, input, random, rules: {}, content: {}, systems });
    state = r.state;
    if (i === 0) order = [...r.callOrder];
    if (r.checkpoint) checkpoints.push({ tick: state.tick, checksum: r.checkpoint.checksum });
  }
  const trace = { schemaVersion: 1, simulationVersion: 'phase20-fixture-v1', pipelineCallOrder: order, checkpoints, finalSnapshotChecksum: createSnapshot(state).checksum };
  return `${JSON.stringify(trace, null, 2)}\n`;
}

describe('Phase 20 golden reference trace', () => {
  it('synergy/summon/expiry trace is byte-identical to the pinned fixture', { timeout: 30_000 }, () => {
    expect(generateTrace()).toBe(fixture);
  });

  it('runs the Phase 20 systems through the pipeline', { timeout: 30_000 }, () => {
    const parsed = JSON.parse(generateTrace()) as { pipelineCallOrder: string[]; checkpoints: { tick: number }[] };
    expect(parsed.pipelineCallOrder).toContain('D:phase20.d1.synergy_commit');
    expect(parsed.pipelineCallOrder).toContain('K:phase20.k0.temporary_expiry');
    expect(parsed.pipelineCallOrder).toContain('K:phase20.k1.summon_commit');
    expect(parsed.checkpoints.map((c) => c.tick)).toEqual([30, 60]);
  });
});
