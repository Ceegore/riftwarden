import { describe, expect, it } from 'vitest';
import { stepBattle } from '../../src/game/sim/core/battle-kernel.js';
import { migrateEntity } from '../../src/game/sim/core/migrate.js';
import { createPhase15Systems } from '../../src/game/sim/core/phase15-systems.js';
import { createSnapshot } from '../../src/game/sim/snapshot/snapshot.js';
import type { TickInput } from '../../src/game/sim/core/tick-input.js';
import { battle, entity, randomSession } from './test-helpers.js';

const input: TickInput = Object.freeze({ paused: false, decisions: Object.freeze([]), contentVersion: 'content_fixture' });

function player(x100: number, overrides: Record<string, unknown> = {}) {
  return migrateEntity({ entity: entity('unit_player', { x100, ...overrides }), radiusX100: 100 });
}

describe('Phase 15 F-stage movement integration', () => {
  it('advances exactly speed X100 over 30 unblocked ticks (rational contract)', () => {
    let state = battle({ entities: [player(1800)], simulationVersion: 'phase15-fixture-v1' });
    const systems = createPhase15Systems({ speedsX100PerSecond: { unit_player: 305 } });
    for (let i = 0; i < 30; i++) {
      state = stepBattle({ state, input, random: randomSession(), rules: {}, content: {}, systems }).state;
    }
    expect(state.entities[0]?.x100).toBe(1800 + 305);
    expect(state.entities[0]?.movementRemainder).toBe(0);
  });

  it('preserves the rational remainder across ticks', () => {
    let state = battle({ entities: [player(1800)], simulationVersion: 'phase15-fixture-v1' });
    const systems = createPhase15Systems({ speedsX100PerSecond: { unit_player: 305 } });
    state = stepBattle({ state, input, random: randomSession(), rules: {}, content: {}, systems }).state;
    expect(state.entities[0]?.x100).toBe(1810);
    expect(state.entities[0]?.movementRemainder).toBe(5);
  });

  it('stops at the enemy contact distance plus stop gap', () => {
    const playerUnit = player(1800);
    const enemyUnit = migrateEntity({ entity: entity('unit_enemy', { side: 'enemy', x100: 2500 }), radiusX100: 100 });
    let state = battle({ entities: [playerUnit, enemyUnit], simulationVersion: 'phase15-fixture-v1' });
    const systems = createPhase15Systems({ speedsX100PerSecond: { unit_player: 30000 } });
    state = stepBattle({ state, input, random: randomSession(), rules: {}, content: {}, systems }).state;
    // contact distance (200) + stop gap (10) => center stops at 2500 - 210 = 2290.
    expect(state.entities.find((e) => e.id === 'unit_player')?.x100).toBe(2290);
  });

  it('does not move a stationary entity without speed content', () => {
    const stationary = migrateEntity({ entity: entity('unit_wall', { x100: 3000 }), radiusX100: 50 });
    let state = battle({ entities: [stationary], simulationVersion: 'phase15-fixture-v1' });
    const systems = createPhase15Systems({ speedsX100PerSecond: {} });
    state = stepBattle({ state, input, random: randomSession(), rules: {}, content: {}, systems }).state;
    expect(state.entities[0]?.x100).toBe(3000);
    expect(state.entities[0]?.movementRemainder).toBe(0);
  });

  it('is permutation-invariant: entity input order does not change the snapshot hash', () => {
    const a = migrateEntity({ entity: entity('unit_a', { lane: 'top', x100: 1800 }), radiusX100: 60 });
    const b = migrateEntity({ entity: entity('unit_b', { lane: 'bottom', x100: 4000 }), radiusX100: 70 });
    const c = migrateEntity({ entity: entity('unit_c', { lane: 'top', x100: 2200 }), radiusX100: 80 });
    const speeds = { unit_a: 301, unit_b: 307, unit_c: 313 };
    const systems = createPhase15Systems({ speedsX100PerSecond: speeds });

    const forward = stepBattle({ state: battle({ entities: [a, b, c], simulationVersion: 'phase15-fixture-v1' }), input, random: randomSession(), rules: {}, content: {}, systems }).state;
    const shuffled = stepBattle({ state: battle({ entities: [c, a, b], simulationVersion: 'phase15-fixture-v1' }), input, random: randomSession(), rules: {}, content: {}, systems }).state;
    expect(createSnapshot(forward).checksum).toBe(createSnapshot(shuffled).checksum);
  });

  it('blocks an unmigrated entity that reaches stage F', () => {
    const unmigrated = entity('unit_raw'); // no radius / remainder
    const state = battle({ entities: [unmigrated], simulationVersion: 'phase15-fixture-v1' });
    const systems = createPhase15Systems({ speedsX100PerSecond: { unit_raw: 300 } });
    expect(() => stepBattle({ state, input, random: randomSession(), rules: {}, content: {}, systems })).toThrow(/P15_SNAPSHOT_INCOMPATIBLE/);
  });

  it('projects radius and remainder into the snapshot', () => {
    let state = battle({ entities: [player(1800)], simulationVersion: 'phase15-fixture-v1' });
    const systems = createPhase15Systems({ speedsX100PerSecond: { unit_player: 305 } });
    state = stepBattle({ state, input, random: randomSession(), rules: {}, content: {}, systems }).state;
    const snapshot = createSnapshot(state);
    expect(snapshot.entities[0]).toMatchObject({ id: 'unit_player', radiusX100: 100, movementRemainder: 5 });
  });
});
