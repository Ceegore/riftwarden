import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stepBattle } from '../../src/game/sim/core/battle-kernel.js';
import { createPhase17Systems } from '../../src/game/sim/core/phase17-systems.js';
import { createPhase21Systems } from '../../src/game/sim/core/phase21-systems.js';
import { createSnapshot } from '../../src/game/sim/snapshot/snapshot.js';
import { buildBossObject, buildBossObjectBody, type BossObjectContent } from '../../src/game/sim/boss/boss-object-manager.js';
import { battle, entity, randomSession, tick } from './test-helpers.js';
import { migrateEntity } from '../../src/game/sim/core/migrate.js';
import type { TickInput } from '../../src/game/sim/core/tick-input.js';
import type { BattleModel } from '../../src/game/sim/core/battle-model.js';
import type { Objective } from '../../src/game/sim/objectives/combat-objective.js';

/**
 * Phase 21 §8 protect_object FAILURE trace: the player's direct hit kills the
 * protected boss-object body on tick 0, the objective flips incomplete, the
 * forced DEFEAT (endReason `protect_object_failed`) sends the battle through
 * RESOLVING_END, and the on_battle_end cleanup removes the destroyed body so
 * the terminal snapshot is clean. Pinned byte-for-byte against
 * reference-traces-phase21-fail.json; the trace must be terminal-identical
 * (same final checksum + reason) on every run, which is the save\->resume
 * guarantee for this failure path.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(readFileSync(path.join(here, 'fixtures', 'reference-traces-phase21-fail.json'), 'utf8')) as {
  finalSnapshotChecksum: string; endTick: number; endReason: string; eventCount: number;
};
const input: TickInput = Object.freeze({ paused: false, decisions: Object.freeze([]), contentVersion: 'content_fixture' });

const PROTECTED: BossObjectContent = Object.freeze({
  entityId: 'obj_protected',
  side: 'player',
  ownerId: 'boss_ash_unit',
  sourceId: 'content_ash_fail',
  spec: Object.freeze({ slotId: 'boss_slot_0', lane: 'middle', x100: 4400, targetable: true, objectiveLink: null, damagePolicy: 'normal', statusPolicy: 'allow', cleanupPolicy: 'on_battle_end', fallback: 'FAIL' }),
  maxLp: 100,
  radiusX100: 120,
});

const objective: Objective = Object.freeze({ id: 'obj_protect', kind: 'protect_object', targetId: 'obj_protected', required: 1, progress: 0, complete: false });

function build(): BattleModel {
  const player = migrateEntity({ entity: entity('unit_player_a', { side: 'player', lane: 'top', x100: 1800, maxLp: 1000, lp: 1000 }), radiusX100: 100 });
  const playerB = migrateEntity({ entity: entity('unit_player_b', { side: 'player', lane: 'middle', x100: 2400, maxLp: 1000, lp: 1000 }), radiusX100: 100 });
  const migBoss = migrateEntity({ entity: entity('boss_ash_unit', { side: 'enemy', lane: 'bottom', x100: 8200, maxLp: 1000, lp: 1000 }), radiusX100: 100 });
  const body = buildBossObjectBody(PROTECTED, tick(0));
  const temp = buildBossObject(PROTECTED.spec, 'obj_protected', 'player', 'boss_ash_unit', 'content_ash_fail', 0, 0);
  return battle({
    simulationVersion: 'phase21-fail-fixture-v1',
    entities: Object.freeze([player, playerB, migBoss, body]),
    temporaryEntities: Object.freeze([temp]),
    pendingCombatApplications: Object.freeze([
      Object.freeze({ kind: 'damage', sourceId: 'unit_enemy_attacker', targetId: 'obj_protected', effectId: 'ef_kill', attackInstanceId: 1, effectIndex: 0, rawAmount: 200, damageTypeOrdinal: 0, defense: 0, coverReductionBps: 0, bossCapBps: null }),
    ]),
    objectives: Object.freeze([objective]),
    phase: Object.freeze({ phase: 'ACTIVE', enteredTick: tick(0), resolvingEndTicks: 0 }),
  });
}

function run(): { state: BattleModel; events: { type: string; targetIds: readonly string[] }[]; terminal: boolean[] } {
  let state = build();
  const events: { type: string; targetIds: readonly string[] }[] = [];
  const terminal: boolean[] = [];
  const random = randomSession();
  const systems = Object.freeze([
    ...createPhase17Systems({ speedsX100PerSecond: {} }),
    ...createPhase21Systems({ objectives: Object.freeze([objective]), bossObjects: Object.freeze([PROTECTED]) }),
  ]);
  for (let i = 0; i < 60; i++) {
    const r = stepBattle({ state, input, random, rules: {}, content: {}, systems });
    state = r.state;
    events.push(...r.events);
    terminal.push(['VICTORY', 'DEFEAT', 'DRAW_ABORT'].includes(state.phase.phase));
    if (terminal[terminal.length - 1]) break;
  }
  return { state, events, terminal };
}

describe('P21 protect_object failure reference trace (§8 + §6)', () => {
  it('kills the object, forces DEFEAT(protect_object_failed), and cleans the body — pinned to the fixture', () => {
    const { state, events } = run();
    expect(state.phase.phase).toBe('DEFEAT');
    expect(state.endReason).toBe('protect_object_failed');
    // The destroyed body was removed by the on_battle_end cleanup: no ACTIVE body
    // and an empty registry in the terminal snapshot.
    expect(state.entities.some((e) => e.id === 'obj_protected' && e.phase.phase === 'ACTIVE')).toBe(false);
    expect(state.temporaryEntities ?? []).toEqual([]);
    // The objective did not complete.
    expect(state.objectives?.[0]?.complete).toBe(false);
    // A single Removed cleanup emitted for the destroyed object.
    expect(events.filter((e) => e.type === 'Removed' && e.targetIds.includes('obj_protected')).length).toBe(1);
    // Pinned byte-identical to the fixture (the cross-runtime/P21-fail column).
    const checksum = createSnapshot(state).checksum;
    expect(checksum).toBe(fixture.finalSnapshotChecksum);
    expect(state.tick).toBe(fixture.endTick);
  });

  it('is terminal-byte-identical across repeated runs (the save->resume guarantee)', () => {
    const a = run();
    const b = run();
    expect(createSnapshot(a.state).checksum).toBe(createSnapshot(b.state).checksum);
    expect(a.state.phase.phase).toBe(b.state.phase.phase);
    expect(a.state.endReason).toBe(b.state.endReason);
    expect(a.state.tick).toBe(b.state.tick);
    // Event streams identical (terminal + cleanup events).
    expect(a.events.map((e) => `${e.type}:${e.targetIds.join(',')}`)).toEqual(b.events.map((e) => `${e.type}:${e.targetIds.join(',')}`));
  });

  it('reaches the terminal inside the 60-tick window (does not hang open)', () => {
    const r = run();
    expect(r.terminal.some(Boolean)).toBe(true);
    expect(r.state.endReason).toBe('protect_object_failed');
  });
});
