import { KernelInvariantError } from '../core/invariant-error.js';
import type { Lane, X100 } from '../geometry/x100.js';
import { asX100, nonNegativeX100 } from '../geometry/x100.js';
import type { KernelEntity } from '../core/entity.js';
import { edgeDistanceX100, type Body } from '../geometry/distance.js';
import { movementStep } from '../movement/movement-step.js';
import { validateAoEShape, type AoEShape } from '../combat/area-sampler.js';

const ID = /^[a-z][a-z0-9_]*$/;

/**
 * Authoritative projectile state (§P17-T02 §6). Purely serializable: stable id,
 * spawn tick, source snapshot, stored aim position/lane, current X100, speed
 * as a deterministic tick remainder (X100 per second, 30 TPS — the same
 * convention as entity movement), homing/maxTurn, expiry, lost-target policy,
 * cover/piercing flags and the committed damage payload. Movement advances
 * exactly once per tick; impact is sampled exactly once and the projectile is
 * marked resolved before follow-up commands are queued.
 */
export interface ProjectileState {
  readonly id: string;
  readonly attackInstanceId: number;
  readonly effectIndex: number;
  readonly sourceId: string;
  readonly targetId: string;
  readonly spawnTick: number;
  readonly lane: Lane;
  readonly x100: X100;
  /** Stored aim position captured at spawn (§6 non-homing hits this). */
  readonly storedTargetLane: Lane;
  readonly storedTargetX100: X100;
  /** X100 per second; per-tick step derived via movementStep (30 TPS). */
  readonly speedX100PerSecond: number;
  /** Deterministic 0..29 rational remainder, mirroring entity movement. */
  readonly movementRemainder: number;
  readonly homing: boolean;
  /** Maximum X100 the aim may turn per tick; ignored when non-homing. */
  readonly maxTurnX100PerTick: number;
  readonly expiryTick: number;
  readonly lostTargetPolicy: 'impact_stored_position' | 'expire' | 'continue_straight';
  readonly coverIgnoring: boolean;
  readonly piercing: boolean;
  readonly resolved: boolean;
  /** T03: optional AoE shape sampled at impact instead of a single target. */
  readonly aoeShape: AoEShape | null;
  // Committed damage payload (source snapshot, §5.3/§8).
  readonly rawAmount: number;
  readonly damageTypeOrdinal: number;
  readonly defense: number;
  readonly bossCapBps: number | null;
}

export interface ProjectileParameters {
  readonly speedX100PerSecond: number;
  readonly homing: boolean;
  readonly maxTurnX100PerTick: number;
  readonly expiryTicks: number;
  readonly lostTargetPolicy: 'impact_stored_position' | 'expire' | 'continue_straight';
  readonly coverIgnoring: boolean;
  readonly piercing: boolean;
  readonly aoeShape?: AoEShape | null;
  readonly rawAmount: number;
  readonly damageTypeOrdinal: number;
  readonly defense: number;
  readonly bossCapBps: number | null;
}

export function validateProjectileState(state: ProjectileState): void {
  if (!ID.test(state.id) || !ID.test(state.sourceId) || !ID.test(state.targetId)) {
    throw new KernelInvariantError('P14_SNAPSHOT_INVALID', { reason: 'projectile-ids', id: state.id });
  }
  for (const key of ['attackInstanceId', 'effectIndex', 'spawnTick', 'speedX100PerSecond', 'movementRemainder', 'maxTurnX100PerTick', 'expiryTick', 'rawAmount', 'damageTypeOrdinal'] as const) {
    const value = state[key];
    if (!Number.isSafeInteger(value) || value < 0 || Object.is(value, -0)) {
      throw new KernelInvariantError('P14_SNAPSHOT_INVALID', { reason: 'projectile-field-invalid', key, value });
    }
  }
  if (!Number.isSafeInteger(state.defense) || state.defense < -1000 || state.defense > 1000) {
    throw new KernelInvariantError('P14_SNAPSHOT_INVALID', { reason: 'projectile-defense-invalid', value: state.defense });
  }
  if (state.movementRemainder >= 30) throw new KernelInvariantError('P14_SNAPSHOT_INVALID', { reason: 'projectile-remainder', value: state.movementRemainder });
  if (!['impact_stored_position', 'expire', 'continue_straight'].includes(state.lostTargetPolicy)) {
    throw new KernelInvariantError('P14_SNAPSHOT_INVALID', { reason: 'projectile-policy', value: state.lostTargetPolicy });
  }
  if (state.damageTypeOrdinal > 2) throw new KernelInvariantError('P14_SNAPSHOT_INVALID', { reason: 'projectile-type', value: state.damageTypeOrdinal });
  if (state.bossCapBps !== null && (!Number.isSafeInteger(state.bossCapBps) || state.bossCapBps < 0)) {
    throw new KernelInvariantError('P14_SNAPSHOT_INVALID', { reason: 'projectile-boss-cap', value: state.bossCapBps });
  }
  if (state.aoeShape !== null) validateAoEShape(state.aoeShape);
  for (const key of ['homing', 'coverIgnoring', 'piercing', 'resolved'] as const) {
    if (typeof state[key] !== 'boolean') throw new KernelInvariantError('P14_SNAPSHOT_INVALID', { reason: 'projectile-flag', key });
  }
  nonNegativeX100(state.x100, 'P15_RANGE_NEGATIVE');
  nonNegativeX100(state.storedTargetX100, 'P15_RANGE_NEGATIVE');
}

function bodyOf(entity: KernelEntity): Body {
  return { id: entity.id, x100: asX100(entity.x100), radiusX100: asX100(entity.radiusX100 ?? 0), lane: entity.lane };
}

/**
 * §7 hit sampling: a target is hit when its collision circle touches the
 * impact point (inclusive edge distance <= 0) and it is in the impact lane.
 * Cover never makes a target invalid. Output is stable-sorted by entity id.
 */
export function sampleImpactTargets(impactX100: X100, lane: Lane, entities: readonly KernelEntity[], sourceSide: string): readonly KernelEntity[] {
  const impact: Body = { id: 'impact', x100: impactX100, radiusX100: asX100(0), lane };
  return entities
    .filter((entity) => entity.lane === lane && entity.phase.phase === 'ACTIVE' && entity.side !== sourceSide && edgeDistanceX100(impact, bodyOf(entity)) <= 0)
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

export interface ProjectileStep {
  readonly state: ProjectileState;
  /** Impact point when the projectile resolved by arriving, else null. */
  readonly impactAt: X100 | null;
}

/**
 * Advances the projectile exactly one tick (§6 "Bewegung exakt einmal
 * fortgeschrieben"). Per-tick step follows movementStep (speed X100/sec over
 * 30 TPS with a rational remainder). Returns the next state plus the impact
 * point when this tick resolves the projectile by arrival. Lost-target
 * policies are applied only for non-homing projectiles.
 */
export function stepProjectile(state: ProjectileState, target: KernelEntity | undefined, atTick: number): ProjectileStep {
  if (state.resolved) return { state, impactAt: null };
  const targetValid = target?.phase.phase === 'ACTIVE';

  // §6 lost-target policies. `impact_stored_position` flies to the stored aim
  // even past expiry; `continue_straight` keeps flying and resolves at expiry;
  // `expire` resolves immediately. The union type rules out any other value.
  if (!targetValid && !state.homing && state.lostTargetPolicy === 'expire') {
    return { state: Object.freeze({ ...state, resolved: true }), impactAt: null };
  }

  // Expiry (non-homing without a stored-position arrival still expires).
  const expired = state.expiryTick > 0 && atTick >= state.expiryTick && !state.homing && state.lostTargetPolicy !== 'impact_stored_position';

  // Aim: homing re-aims at the live target with a turn cap; non-homing flies
  // to the stored position.
  let aimX100 = state.storedTargetX100;
  if (state.homing && targetValid) {
    const delta = target.x100 - state.x100;
    const capped = Math.max(-state.maxTurnX100PerTick, Math.min(state.maxTurnX100PerTick, delta));
    aimX100 = asX100(state.x100 + capped);
  }
  const direction: 1 | -1 = aimX100 >= state.x100 ? 1 : -1;
  const step = movementStep(state.speedX100PerSecond, state.movementRemainder);
  const moved = direction * step.stepX100;
  let next = state.x100 + moved;
  const arrived = direction === 1 ? next >= aimX100 : next <= aimX100;
  if (arrived) next = aimX100;

  if (arrived) {
    // Arrival resolves this tick with a single impact sample.
    return { state: Object.freeze({ ...state, x100: asX100(next), movementRemainder: step.remainder, resolved: true }), impactAt: aimX100 };
  }
  if (expired) {
    return { state: Object.freeze({ ...state, x100: asX100(next), movementRemainder: step.remainder, resolved: true }), impactAt: null };
  }
  return { state: Object.freeze({ ...state, x100: asX100(next), movementRemainder: step.remainder }), impactAt: null };
}

/** Deterministic travel forecast for the ProjectileSpawned diagnostic (§6). */
export function forecastTravelTicks(state: ProjectileState): number {
  let remaining = Math.abs(state.storedTargetX100 - state.x100);
  if (remaining === 0) return 1;
  let ticks = 0;
  let remainder = state.movementRemainder;
  const direction: 1 | -1 = state.storedTargetX100 >= state.x100 ? 1 : -1;
  while (remaining > 0) {
    ticks++;
    const step = movementStep(state.speedX100PerSecond, remainder);
    remainder = step.remainder;
    if (step.stepX100 === 0) {
      // Degenerate speed: never arrives.
      return state.expiryTick > 0 ? state.expiryTick - state.spawnTick : 1;
    }
    const moved = direction * step.stepX100;
    if (Math.abs(moved) >= remaining) remaining = 0;
    else remaining -= Math.abs(moved);
    if (ticks > 10_000) return 10_000;
  }
  return ticks;
}

export function spawnProjectile(args: { readonly id: string; readonly attackInstanceId: number; readonly effectIndex: number; readonly sourceId: string; readonly targetId: string; readonly spawnTick: number; readonly source: KernelEntity; readonly target: KernelEntity; readonly params: ProjectileParameters }): ProjectileState {
  const state: ProjectileState = Object.freeze({
    id: args.id,
    attackInstanceId: args.attackInstanceId,
    effectIndex: args.effectIndex,
    sourceId: args.sourceId,
    targetId: args.targetId,
    spawnTick: args.spawnTick,
    lane: args.source.lane,
    x100: asX100(args.source.x100),
    storedTargetLane: args.target.lane,
    storedTargetX100: asX100(args.target.x100),
    speedX100PerSecond: args.params.speedX100PerSecond,
    movementRemainder: 0,
    homing: args.params.homing,
    maxTurnX100PerTick: args.params.maxTurnX100PerTick,
    expiryTick: args.spawnTick + args.params.expiryTicks,
    lostTargetPolicy: args.params.lostTargetPolicy,
    coverIgnoring: args.params.coverIgnoring,
    piercing: args.params.piercing,
    resolved: false,
    aoeShape: args.params.aoeShape ?? null,
    rawAmount: args.params.rawAmount,
    damageTypeOrdinal: args.params.damageTypeOrdinal,
    defense: args.params.defense,
    bossCapBps: args.params.bossCapBps,
  });
  validateProjectileState(state);
  return state;
}
