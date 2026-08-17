import type { BattleModel } from './battle-model.js';
import type { KernelEntity } from './entity.js';
import { KernelInvariantError } from './invariant-error.js';

/**
 * Versioned save/snapshot migration for the Phase 15 additive entity schema
 * (`radiusX100`, `movementRemainder`). The BattleModel `schemaVersion` stays 1:
 * the kit must not invent a real simulationVersion number (§11). The migration
 * is instead keyed on the repository's explicit `simulationVersion` string and
 * follows the replay policy `EXPLICIT_IDEMPOTENT_ONLY` — every transition is a
 * named, idempotent step and unknown versions block resume rather than default.
 */
export const SIM_VERSION_PHASE14 = 'phase14-fixture-v1';
export const SIM_VERSION_PHASE15 = 'phase15-fixture-v1';

export interface MigrateEntityArgs {
  readonly entity: KernelEntity;
  /** Authoritative collision radius from content (Phase 14 had no radius field). */
  readonly radiusX100: number;
}

/**
 * Phase 14 → Phase 15 entity migration. Adds the authoritative radius and the
 * initial zero movement remainder. Idempotent: an already-migrated entity keeps
 * its values; a partially migrated entity (one field present, one absent) is an
 * inconsistency and blocks instead of guessing.
 */
export function migrateEntity(args: MigrateEntityArgs): KernelEntity {
  const { entity, radiusX100 } = args;
  if (!Number.isSafeInteger(radiusX100) || radiusX100 < 0 || Object.is(radiusX100, -0)) {
    throw new KernelInvariantError('P15_SNAPSHOT_INCOMPATIBLE', { reason: 'migration-radius-invalid', entityId: entity.id, radiusX100 });
  }
  const hasRadius = entity.radiusX100 !== undefined;
  const hasRemainder = entity.movementRemainder !== undefined;
  if (hasRadius !== hasRemainder) {
    throw new KernelInvariantError('P15_SNAPSHOT_INCOMPATIBLE', {
      reason: 'migration-partial',
      entityId: entity.id,
      radiusX100: entity.radiusX100,
      movementRemainder: entity.movementRemainder,
    });
  }
  if (hasRadius && hasRemainder) {
    if (entity.radiusX100 !== radiusX100) {
      throw new KernelInvariantError('P15_SNAPSHOT_INCOMPATIBLE', {
        reason: 'migration-radius-conflict',
        entityId: entity.id,
        expected: radiusX100,
        actual: entity.radiusX100,
      });
    }
    return entity;
  }
  return Object.freeze({ ...entity, radiusX100, movementRemainder: 0 });
}

export interface MigrateBattleArgs {
  readonly state: BattleModel;
  /** Radius per entity id; every entity must have an entry or migration blocks. */
  readonly radiiX100: Readonly<Record<string, number>>;
}

/** Phase 14 → Phase 15 battle migration: bumps the version and migrates entities. */
export function migrateBattleModel(args: MigrateBattleArgs): BattleModel {
  const { state, radiiX100 } = args;
  if (state.simulationVersion === SIM_VERSION_PHASE15) return state; // idempotent
  if (state.simulationVersion !== SIM_VERSION_PHASE14) {
    throw new KernelInvariantError('P15_SNAPSHOT_INCOMPATIBLE', {
      reason: 'unknown-simulation-version',
      simulationVersion: state.simulationVersion,
    });
  }
  const entities = state.entities.map((entity) => {
    const radiusX100 = radiiX100[entity.id];
    if (radiusX100 === undefined) {
      throw new KernelInvariantError('P15_SNAPSHOT_INCOMPATIBLE', { reason: 'migration-radius-missing', entityId: entity.id });
    }
    return migrateEntity({ entity, radiusX100 });
  });
  return Object.freeze({ ...state, simulationVersion: SIM_VERSION_PHASE15, entities: Object.freeze(entities) });
}
