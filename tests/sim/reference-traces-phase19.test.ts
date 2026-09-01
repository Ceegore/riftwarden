import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stepBattle } from '../../src/game/sim/core/battle-kernel.js';
import { migrateEntity } from '../../src/game/sim/core/migrate.js';
import { createPhase19Systems } from '../../src/game/sim/core/phase19-systems.js';
import { createSnapshot } from '../../src/game/sim/snapshot/snapshot.js';
import { createAbilityInstance } from '../../src/game/sim/ability/ability-system.js';
import { tick } from '../../src/game/sim/core/primitives.js';
import type { AbilityRuntimeDefinition } from '../../src/game/sim/ability/ability-runtime.js';
import type { EffectCommand } from '../../src/game/sim/ability/effect-command.js';
import type { TickInput } from '../../src/game/sim/core/tick-input.js';
import type { BattleModel } from '../../src/game/sim/core/battle-model.js';
import { battle, entity, randomSession } from './test-helpers.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixture = readFileSync(path.join(here, 'fixtures', 'reference-traces-phase19.json'), 'utf8');
const input: TickInput = Object.freeze({ paused: false, decisions: Object.freeze([]), contentVersion: 'content_fixture' });

function mk(id: string, side: 'player' | 'enemy', x100: number, lane: 'top' | 'middle' | 'bottom'): ReturnType<typeof migrateEntity> {
  return migrateEntity({ entity: entity(id, { side, lane, x100, maxLp: 1000, lp: 1000 }), radiusX100: 100 });
}

function fireballDefinition(): AbilityRuntimeDefinition {
  return {
    config: {
      abilityId: 'ability_fireball',
      chargeTicks: null,
      cooldownTicks: 3,
      castTicks: 2,
      recoveryTicks: 1,
      interruptPolicy: 'interruptible',
      usesPerBattle: null,
      invalidTargetPolicy: 'wait',
      bossPhaseCancelAllowed: false,
    },
    trigger: { type: 'tick_interval', everyTicks: 15 },
    targetQuery: { space: 'enemy_entity', profile: 'nearest' },
    effects: (ctx): readonly EffectCommand[] => [
      Object.freeze({
        commandId: `${ctx.abilityInstanceId}_effect_0`,
        abilityInstanceId: ctx.abilityInstanceId,
        abilityId: ctx.abilityId,
        effectIndex: 0,
        sourceId: ctx.source.sourceId,
        targetRef: Object.freeze({ kind: 'entity' as const, entityId: ctx.target.entityId, groundKey: null, slotId: null }),
        scheduledTick: ctx.commitTick,
        stage: 'I' as const,
        sourceSnapshot: ctx.source,
        sequence: 0,
        kind: 'damage' as const,
        amount: 120,
      }),
    ],
  };
}

function generateTrace(): string {
  const entities = [
    mk('unit_player_a', 'player', 1800, 'top'),
    mk('unit_player_b', 'player', 2400, 'middle'),
    mk('unit_enemy_a', 'enemy', 6200, 'middle'),
    mk('unit_enemy_b', 'enemy', 7600, 'bottom'),
  ];
  let state: BattleModel = battle({
    simulationVersion: 'phase19-fixture-v1',
    tick: tick(0),
    entities,
    abilities: Object.freeze([createAbilityInstance(fireballDefinition().config, 'inst_fireball', 'unit_player_a')]),
  });
  const random = randomSession();
  const systems = createPhase19Systems({ speedsX100PerSecond: {}, abilities: { definitions: { ability_fireball: fireballDefinition() } } });
  const checkpoints: { tick: number; checksum: string }[] = [];
  let order: string[] = [];
  for (let i = 0; i < 60; i++) {
    const r = stepBattle({ state, input, random, rules: {}, content: {}, systems });
    state = r.state;
    if (i === 0) order = [...r.callOrder];
    if (r.checkpoint) checkpoints.push({ tick: state.tick, checksum: r.checkpoint.checksum });
  }
  const trace = { schemaVersion: 1, simulationVersion: 'phase19-fixture-v1', pipelineCallOrder: order, checkpoints, finalSnapshotChecksum: createSnapshot(state).checksum };
  return `${JSON.stringify(trace, null, 2)}\n`;
}

describe('Phase 19 golden reference trace', () => {
  it('ability trigger/cast/effect trace is byte-identical to the pinned fixture', { timeout: 30_000 }, () => {
    expect(generateTrace()).toBe(fixture);
  });

  it('runs the ability systems through the pipeline', { timeout: 30_000 }, () => {
    const parsed = JSON.parse(generateTrace()) as { pipelineCallOrder: string[]; checkpoints: { tick: number }[] };
    expect(parsed.pipelineCallOrder).toContain('D:phase19.d1.ability_trigger');
    expect(parsed.pipelineCallOrder).toContain('G:phase19.g2.ability_lifecycle');
    expect(parsed.checkpoints.map((c) => c.tick)).toEqual([30, 60]);
  });
});
