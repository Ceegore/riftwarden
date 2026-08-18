import type { BattleModel } from './battle-model.js';
import type { KernelEntity } from './entity.js';
import { KernelInvariantError } from './invariant-error.js';

/**
 * Versioned save/snapshot migration for the Phase 15 additive entity schema.
 * The BattleModel `schemaVersion` stays 1: the kit must not invent a real
 * simulationVersion number (§11). The migration is instead keyed on the
 * repository's explicit `simulationVersion` string and follows the replay
 * policy `EXPLICIT_IDEMPOTENT_ONLY` — every transition is a named, idempotent
 * step and unknown versions block resume rather than default.
 */
export const SIM_VERSION_PHASE14 = 'phase14-fixture-v1';
export const SIM_VERSION_PHASE15 = 'phase15-fixture-v1';

export interface MigrateEntityArgs {
  readonly entity: KernelEntity;
  /** Authoritative collision radius from content (Phase 14 had no radius field). */
  readonly radiusX100: number;
}

const PHASE15_FIELDS = [
  'radiusX100', 'movementRemainder', 'laneChange', 'normalLaneChangeCooldownUntilTick',
  'noProgressTicks', 'repathTicks', 'laneFallbackUsed', 'stuckStopGapBonusUntilTick',
  'frontDeadlockBlockedTicks', 'deadlockBuffConsumed', 'deadlockBuffedEntityId',
  'origin', 'inRangeSinceTick',
  // Phase 17 additive attack-lifecycle fields.
  'attackState', 'recoveryMovementLockedUntilTick', 'attackInstanceSeq', 'attackIntervalReadyTick',
  // Phase 17 additive combat field (T04 shield ledger).
  'shields',
  // Phase 17 additive defeat fields (T05 stage J).
  'pendingOverkill', 'reviveCount',
] as const;

function phase15FieldCount(entity: KernelEntity): number {
  return PHASE15_FIELDS.filter((key) => entity[key] !== undefined).length;
}

/**
 * Phase 14 → Phase 15 entity migration. Adds the authoritative radius plus the
 * initial zero/default values for every Phase 15 field. Idempotent: a fully
 * migrated entity keeps its values; a partially migrated entity (some fields
 * present, some absent) is an inconsistency and blocks instead of guessing.
 */
export function migrateEntity(args: MigrateEntityArgs): KernelEntity {
  const { entity, radiusX100 } = args;
  if (!Number.isSafeInteger(radiusX100) || radiusX100 < 0 || Object.is(radiusX100, -0)) {
    throw new KernelInvariantError('P15_SNAPSHOT_INCOMPATIBLE', { reason: 'migration-radius-invalid', entityId: entity.id, radiusX100 });
  }
  const present = phase15FieldCount(entity);
  if (present !== 0 && present !== PHASE15_FIELDS.length) {
    throw new KernelInvariantError('P15_SNAPSHOT_INCOMPATIBLE', { reason: 'migration-partial', entityId: entity.id, present });
  }
  if (present === PHASE15_FIELDS.length) {
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
  return Object.freeze({
    ...entity,
    radiusX100,
    movementRemainder: 0,
    laneChange: null,
    normalLaneChangeCooldownUntilTick: 0,
    noProgressTicks: 0,
    repathTicks: Object.freeze([]),
    laneFallbackUsed: false,
    stuckStopGapBonusUntilTick: 0,
    frontDeadlockBlockedTicks: 0,
    deadlockBuffConsumed: false,
    deadlockBuffedEntityId: null,
    origin: 'regular',
    inRangeSinceTick: null,
    attackState: null,
    recoveryMovementLockedUntilTick: 0,
    attackInstanceSeq: 0,
    attackIntervalReadyTick: 0,
    shields: Object.freeze([]),
    pendingOverkill: 0,
    reviveCount: 0,
  });
}

export interface MigrateBattleArgs {
  readonly state: BattleModel;
  /** Radius per entity id; every entity must have an entry or migration blocks. */
  readonly radiiX100: Readonly<Record<string, number>>;
}

/** Phase 14 → Phase 15 battle migration: bumps the version and migrates entities + battle progress. */
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
  return Object.freeze({
    ...state,
    simulationVersion: SIM_VERSION_PHASE15,
    entities: Object.freeze(entities),
    globalNoProgressTicks: 0,
    riftCollapseTicks: 0,
    riftCollapseWarningEmitted: false,
    projectiles: Object.freeze([]),
    pendingCombatApplications: Object.freeze([]),
    combatApplicationSeq: 0,
    statuses: Object.freeze([]),
  });
}
