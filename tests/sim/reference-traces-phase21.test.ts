import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stepBattle } from '../../src/game/sim/core/battle-kernel.js';
import { migrateEntity } from '../../src/game/sim/core/migrate.js';
import { createPhase21Systems } from '../../src/game/sim/core/phase21-systems.js';
import { createSnapshot } from '../../src/game/sim/snapshot/snapshot.js';
import type { Phase21RuntimeConfig } from '../../src/game/sim/core/phase21-systems.js';
import type { PhaseDefinition } from '../../src/game/sim/boss/boss-phase-system.js';
import type { TickInput } from '../../src/game/sim/core/tick-input.js';
import type { BattleModel } from '../../src/game/sim/core/battle-model.js';
import type { Objective } from '../../src/game/sim/objectives/combat-objective.js';
import type { Wave } from '../../src/game/sim/world/reinforcement-system.js';
import type { ModifierDefinition } from '../../src/game/sim/world/modifier-system.js';
import type { Hazard } from '../../src/game/sim/world/hazard-system.js';
import { battle, entity, randomSession } from './test-helpers.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixture = readFileSync(path.join(here, 'fixtures', 'reference-traces-phase21.json'), 'utf8');
const input: TickInput = Object.freeze({ paused: false, decisions: Object.freeze([]), contentVersion: 'content_fixture' });

const phase = (id: string, min: number, max: number, priority: number, extra: Partial<PhaseDefinition> = {}): PhaseDefinition =>
  Object.freeze({ id, bossId: 'boss_ash', priority, minHpPermille: min, maxHpPermille: max, previewKey: `preview_${id}`, ...extra });

const defs: readonly PhaseDefinition[] = Object.freeze([
  phase('p1', 501, 1001, 1),
  phase('p2', 251, 501, 2, { invulnerableTicks: 10 }),
  phase('p3', 0, 251, 3),
]);

const modifiers: readonly ModifierDefinition[] = Object.freeze([
  Object.freeze({ id: 'mod_ash_1', previewKey: 'preview_mod_ash_1', hooks: Object.freeze(['on_battle_start'] as const), incompatibilityTags: Object.freeze([]), params: Object.freeze({}) }),
  Object.freeze({ id: 'mod_ash_2', previewKey: 'preview_mod_ash_2', hooks: Object.freeze(['on_phase_entry'] as const), incompatibilityTags: Object.freeze([]), params: Object.freeze({}) }),
]);

const waves: readonly Wave[] = Object.freeze([
  Object.freeze({ id: 'wave_ash_1', scheduledTick: 10, side: 'enemy', entityIds: Object.freeze(['unit_reinforce_a', 'unit_reinforce_b']), spawnProfile: 'profile_grunt', capPolicy: 'BLOCK' }),
]);

const objectives: readonly Objective[] = Object.freeze([
  Object.freeze({ id: 'obj_survive', kind: 'survive_until', targetId: null, required: 60, progress: 0, complete: false }),
  Object.freeze({ id: 'obj_boss', kind: 'kill_boss', targetId: 'boss_ash_unit', required: 1, progress: 0, complete: false }),
]);

const hazards: readonly Hazard[] = Object.freeze([
  Object.freeze({ id: 'hazard_ash_1', scheduledTick: 5, telegraphTicks: 10, resolveTick: 15, expired: false, form: 'circle', edgePattern: 'edge_dashed', shapeSymbol: 'symbol_skull' }),
]);

const config: Phase21RuntimeConfig = Object.freeze({
  bossPhaseDefinitions: defs,
  modifiers,
  waves,
  objectives,
  bossCoreMechanicTags: Object.freeze(['core_phase']),
  bossAnnouncedCounterTags: Object.freeze(['dispel']),
});

function mk(id: string, side: 'player' | 'enemy', x100: number, lane: 'top' | 'middle' | 'bottom'): ReturnType<typeof migrateEntity> {
  return migrateEntity({ entity: entity(id, { side, lane, x100, maxLp: 1000, lp: 400 }), radiusX100: 120 });
}

function generateTrace(): string {
  let state: BattleModel = battle({
    simulationVersion: 'phase21-fixture-v1',
    entities: Object.freeze([mk('unit_player_a', 'player', 1800, 'top'), mk('boss_ash_unit', 'enemy', 5000, 'middle')]),
    bossPhase: Object.freeze({ entityId: 'boss_ash_unit', bossId: 'boss_ash', phaseId: 'p1', transition: null, visited: Object.freeze(['p1']), invulnerableUntilTick: null }),
    hazards,
  });
  const random = randomSession();
  const systems = createPhase21Systems(config);
  const checkpoints: { tick: number; checksum: string }[] = [];
  let order: string[] = [];
  for (let i = 0; i < 60; i++) {
    const r = stepBattle({ state, input, random, rules: {}, content: {}, systems });
    state = r.state;
    if (i === 0) order = [...r.callOrder];
    if (r.checkpoint) checkpoints.push({ tick: state.tick, checksum: r.checkpoint.checksum });
  }
  const trace = { schemaVersion: 1, simulationVersion: 'phase21-fixture-v1', pipelineCallOrder: order, checkpoints, finalSnapshotChecksum: createSnapshot(state).checksum };
  return `${JSON.stringify(trace, null, 2)}\n`;
}

describe('Phase 21 golden reference trace', () => {
  it('boss/objective/wave/hazard trace is byte-identical to the pinned fixture', () => {
    expect(generateTrace()).toBe(fixture);
  });

  it('runs the Phase 21 systems through the pipeline', () => {
    const parsed = JSON.parse(generateTrace()) as { pipelineCallOrder: string[]; checkpoints: { tick: number }[] };
    expect(parsed.pipelineCallOrder).toContain('D:modifier.d0.commit');
    expect(parsed.pipelineCallOrder).toContain('D:boss.d1.transition_detect');
    expect(parsed.pipelineCallOrder).toContain('C:hazard.c1.advance');
    expect(parsed.pipelineCallOrder).toContain('K:reinforcement.k1.spawn');
    expect(parsed.pipelineCallOrder).toContain('L:boss.l1.transition_commit');
    expect(parsed.pipelineCallOrder).toContain('L:objective.l1.resolution');
    expect(parsed.checkpoints.map((c) => c.tick)).toEqual([30, 60]);
  });
});
