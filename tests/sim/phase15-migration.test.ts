import { describe, expect, it } from 'vitest';
import {
  migrateBattleModel,
  migrateEntity,
  SIM_VERSION_PHASE14,
  SIM_VERSION_PHASE15,
} from '../../src/game/sim/core/migrate.js';
import { battle, entity } from './test-helpers.js';

describe('Phase 15 versioned migration', () => {
  it('adds the authoritative radius and zero remainder to a Phase 14 entity', () => {
    const migrated = migrateEntity({ entity: entity(), radiusX100: 120 });
    expect(migrated.radiusX100).toBe(120);
    expect(migrated.movementRemainder).toBe(0);
    // Original input is untouched (immutable migration).
    expect(entity().radiusX100).toBeUndefined();
  });

  it('adds default lane-change, progress and deadlock fields', () => {
    const migrated = migrateEntity({ entity: entity(), radiusX100: 120 });
    expect(migrated.laneChange).toBeNull();
    expect(migrated.normalLaneChangeCooldownUntilTick).toBe(0);
    expect(migrated.noProgressTicks).toBe(0);
    expect(migrated.repathTicks).toEqual([]);
    expect(migrated.laneFallbackUsed).toBe(false);
    expect(migrated.frontDeadlockBlockedTicks).toBe(0);
    expect(migrated.deadlockBuffConsumed).toBe(false);
    expect(migrated.deadlockBuffedEntityId).toBeNull();
  });

  it('is idempotent on an already-migrated entity', () => {
    const once = migrateEntity({ entity: entity(), radiusX100: 120 });
    const twice = migrateEntity({ entity: once, radiusX100: 120 });
    expect(twice).toBe(once);
  });

  it('blocks a partially migrated entity', () => {
    const partial = entity('entity_alpha', { radiusX100: 120 });
    expect(() => migrateEntity({ entity: partial, radiusX100: 120 })).toThrow(/P15_SNAPSHOT_INCOMPATIBLE/);
  });

  it('blocks a radius conflict on an already-migrated entity', () => {
    const migrated = migrateEntity({ entity: entity(), radiusX100: 120 });
    expect(() => migrateEntity({ entity: migrated, radiusX100: 130 })).toThrow(/P15_SNAPSHOT_INCOMPATIBLE/);
  });

  it('rejects an invalid migration radius', () => {
    expect(() => migrateEntity({ entity: entity(), radiusX100: -1 })).toThrow(/P15_SNAPSHOT_INCOMPATIBLE/);
    expect(() => migrateEntity({ entity: entity(), radiusX100: 12.5 })).toThrow(/P15_SNAPSHOT_INCOMPATIBLE/);
  });

  it('bumps the simulation version and migrates every entity', () => {
    const state = battle({ entities: [entity('entity_alpha'), entity('entity_beta')] });
    const migrated = migrateBattleModel({ state, radiiX100: { entity_alpha: 100, entity_beta: 200 } });
    expect(migrated.simulationVersion).toBe(SIM_VERSION_PHASE15);
    expect(migrated.entities.map((e) => e.radiusX100)).toEqual([100, 200]);
    expect(migrated.entities.every((e) => e.movementRemainder === 0)).toBe(true);
    expect(state.simulationVersion).toBe(SIM_VERSION_PHASE14);
  });

  it('is idempotent at the Phase 15 version', () => {
    const migrated = migrateBattleModel({ state: battle({ entities: [entity()] }), radiiX100: { entity_alpha: 100 } });
    expect(migrateBattleModel({ state: migrated, radiiX100: { entity_alpha: 100 } })).toBe(migrated);
  });

  it('blocks an unknown simulation version', () => {
    const unknown = battle({ simulationVersion: 'phase16-fixture-v1' });
    expect(() => migrateBattleModel({ state: unknown, radiiX100: { entity_alpha: 100 } })).toThrow(/P15_SNAPSHOT_INCOMPATIBLE/);
  });

  it('blocks when an entity has no migration radius', () => {
    expect(() => migrateBattleModel({ state: battle({ entities: [entity()] }), radiiX100: {} })).toThrow(/P15_SNAPSHOT_INCOMPATIBLE/);
  });
});
