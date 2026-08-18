import { KernelInvariantError } from '../core/invariant-error.js';
import type { KernelEntity } from '../core/entity.js';
import { edgeDistanceX100, type Body } from '../geometry/distance.js';
import { asX100, nonNegativeX100, type X100 } from '../geometry/x100.js';
import type { ProjectileParameters } from '../projectile/projectile-state.js';
import { validateAoEShape, type AoEShape } from '../combat/area-sampler.js';

/**
 * Authoritative attack-instance state (§P17-T01). One entity may hold at most
 * one instance; a committed action continues with its source snapshot even if
 * the source dies. All tick values are whole ticks converted from seconds at
 * content-load time — never wallclock, never floats.
 */
export interface AttackState {
  readonly attackInstanceId: number;
  readonly sourceId: string;
  readonly targetId: string;
  readonly prepareStartedTick: number;
  readonly commitTick: number | null;
  readonly recoveryEndTick: number | null;
  /** Next tick the entity may begin a new attack (previous begin + interval). */
  readonly intervalReadyTick: number;
  readonly effectIndex: number;
}

export interface AttackParameters {
  /** Whole-tick interval between attack begins; clamped to >= MIN_ATTACK_INTERVAL_TICKS. */
  readonly attackIntervalTicks: number;
  /** Whole-tick wind-up between prepare start and commit. */
  readonly prepareTicks: number;
  /** Whole-tick recovery duration after commit. */
  readonly recoveryTicks: number;
  /** Inclusive preferred range in X100 (§P16, in-range foundation). */
  readonly preferredRangeX100?: X100;
  /**
   * §5.3: on commit the attack either queues an immediate hit or spawns a
   * projectile. Absent → lifecycle-only (no hit), used by pure T01 fixtures.
   */
  readonly delivery?: Readonly<{ kind: 'direct' } & DirectHitParams> | Readonly<{ kind: 'projectile' } & DirectHitParams & ProjectileParameters>;
}

export interface DirectHitParams {
  readonly rawAmount: number;
  readonly damageTypeOrdinal: number;
  readonly defense: number;
  /** Boss cap in basis points of max LP, or null for non-boss targets. */
  readonly bossCapBps?: number | null;
  /** T03: optional AoE shape; a direct hit with a shape hits every boundary target. */
  readonly aoeShape?: AoEShape | null;
}

/** §5.2: attack tempo never lowers the interval below 0.45 s = 14 ticks. */
export const MIN_ATTACK_INTERVAL_TICKS = 14;

/** §5.2: recovery locks movement in the first half; odd counts use ceil. */
export function recoveryMovementLockTicks(recoveryTicks: number): number {
  return Math.ceil(recoveryTicks / 2);
}

export function validateAttackParameters(params: AttackParameters): void {
  for (const [key, value] of Object.entries({
    attackIntervalTicks: params.attackIntervalTicks,
    prepareTicks: params.prepareTicks,
    recoveryTicks: params.recoveryTicks,
  })) {
    if (!Number.isSafeInteger(value) || value < 0) throw new KernelInvariantError('P14_SNAPSHOT_INVALID', { reason: 'attack-parameter-invalid', key, value });
  }
  if (params.preferredRangeX100 !== undefined) nonNegativeX100(params.preferredRangeX100, 'P15_RANGE_NEGATIVE');
  if (params.delivery !== undefined) {
    if (!Number.isSafeInteger(params.delivery.rawAmount) || params.delivery.rawAmount < 0) {
      throw new KernelInvariantError('P14_SNAPSHOT_INVALID', { reason: 'attack-delivery-raw-invalid', rawAmount: params.delivery.rawAmount });
    }
    if (params.delivery.damageTypeOrdinal < 0 || params.delivery.damageTypeOrdinal > 2) {
      throw new KernelInvariantError('P14_SNAPSHOT_INVALID', { reason: 'attack-delivery-type-invalid', damageTypeOrdinal: params.delivery.damageTypeOrdinal });
    }
    if (!Number.isSafeInteger(params.delivery.defense) || params.delivery.defense < -1000 || params.delivery.defense > 1000) {
      throw new KernelInvariantError('P14_SNAPSHOT_INVALID', { reason: 'attack-delivery-defense-invalid', defense: params.delivery.defense });
    }
    if (params.delivery.bossCapBps !== undefined && params.delivery.bossCapBps !== null && (!Number.isSafeInteger(params.delivery.bossCapBps) || params.delivery.bossCapBps < 0)) {
      throw new KernelInvariantError('P14_SNAPSHOT_INVALID', { reason: 'attack-delivery-boss-cap-invalid', bossCapBps: params.delivery.bossCapBps });
    }
    if (params.delivery.aoeShape !== undefined && params.delivery.aoeShape !== null) {
      validateAoEShape(params.delivery.aoeShape);
    }
    if (params.delivery.kind === 'projectile') {
      for (const key of ['speedX100PerSecond', 'maxTurnX100PerTick', 'expiryTicks'] as const) {
        if (!Number.isSafeInteger(params.delivery[key]) || params.delivery[key] < 0) {
          throw new KernelInvariantError('P14_SNAPSHOT_INVALID', { reason: 'attack-delivery-projectile-invalid', key, value: params.delivery[key] });
        }
      }
      if (!['impact_stored_position', 'expire', 'continue_straight'].includes(params.delivery.lostTargetPolicy)) {
        throw new KernelInvariantError('P14_SNAPSHOT_INVALID', { reason: 'attack-delivery-policy-invalid', value: params.delivery.lostTargetPolicy });
      }
    }
  }
}

function bodyOf(entity: KernelEntity): Body {
  return { id: entity.id, x100: asX100(entity.x100), radiusX100: asX100(entity.radiusX100 ?? 0), lane: entity.lane };
}

/** Inclusive edge distance between the source and its committed target. */
export function targetEdgeDistanceX100(source: KernelEntity, target: KernelEntity): X100 {
  return edgeDistanceX100(bodyOf(source), bodyOf(target));
}

/**
 * §5.1: a target is attackable when it exists, is ACTIVE, is on the opposite
 * side and is within the inclusive preferred range. Dead/removed targets are
 * never valid; the E stage releases them on the next re-evaluation.
 */
export function isAttackTargetValid(source: KernelEntity, target: KernelEntity | undefined, preferredRangeX100: X100 | undefined): boolean {
  if (target?.phase.phase !== 'ACTIVE' || target.side === source.side) return false;
  if (preferredRangeX100 === undefined) return true;
  return targetEdgeDistanceX100(source, target) <= nonNegativeX100(preferredRangeX100, 'P15_RANGE_NEGATIVE');
}

/**
 * §5.1: a committed attack holds its target through recovery even if the
 * target becomes invalid; only the prepare phase aborts on target loss.
 */
export function committedTargetStillReferenced(state: AttackState, targetId: string | null): boolean {
  return targetId === state.targetId;
}


export interface AttackTransition {
  /** The new attack state, or null when the cycle ends / is interrupted. */
  readonly state: AttackState | null;
  readonly event: 'prepared' | 'committed' | 'recovery_started' | 'cycle_completed' | 'interrupted';
  readonly payload: Readonly<Record<string, number>>;
}

/** Starts a new attack instance from idle (§5.1). */
export function startPrepare(instance: number, sourceId: string, targetId: string, prepareStartedTick: number, prepareTicks: number): AttackTransition {
  return {
    state: Object.freeze({
      attackInstanceId: instance,
      sourceId,
      targetId,
      prepareStartedTick,
      commitTick: null,
      recoveryEndTick: null,
      intervalReadyTick: 0,
      effectIndex: 0,
    }),
    event: 'prepared',
    payload: Object.freeze({ commitTick: prepareStartedTick + prepareTicks }),
  };
}

/** Commits a prepared attack: recovery starts and the next interval is gated. */
export function commitAttack(state: AttackState, commitTick: number, params: AttackParameters): AttackTransition {
  const interval = Math.max(params.attackIntervalTicks, MIN_ATTACK_INTERVAL_TICKS);
  return {
    state: Object.freeze({
      ...state,
      commitTick,
      recoveryEndTick: commitTick + params.recoveryTicks,
      intervalReadyTick: state.prepareStartedTick + interval,
    }),
    event: 'committed',
    payload: Object.freeze({ commitTick }),
  };
}

/** §5.2: the first half of recovery locks movement (odd counts: ceil). */
export function recoveryLockedUntilTick(commitTick: number, recoveryTicks: number): number {
  return commitTick + recoveryMovementLockTicks(recoveryTicks);
}

/** Completes recovery: the cycle ends and the entity returns to idle. */
export function completeRecovery(): AttackTransition {
  return { state: null, event: 'cycle_completed', payload: Object.freeze({}) };
}

/** Interrupts a preparing attack (target lost / explicit interrupt). */
export function interruptAttack(reasonOrdinal: number): AttackTransition {
  return { state: null, event: 'interrupted', payload: Object.freeze({ reasonOrdinal }) };
}
