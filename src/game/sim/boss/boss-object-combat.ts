import { KernelInvariantError } from '../core/invariant-error.js';
import type { KernelEntity } from '../core/entity.js';
import type { Tick } from '../core/primitives.js';
import { assertBossObjectId, validateBossObjectSpec, type BossObjectContent, type DamagePolicy } from './boss-object-manager.js';

/**
 * Phase 21 §6 boss-object combat surface (extracted from the manager so the
 * module stays within the line budget). A placed object carries a real kernel
 * body — origin `boss_object` — so damage, shields and defeat resolution apply
 * to it. The damage policy gates how a hit lands:
 * - `normal` (or no policy — a regular target) lets the amount through;
 * - `immune` zeroes the hit entirely (see `bossObjectDamageAmount`);
 * - `shield_only` lets shields absorb but never lets the remainder touch
 *   object HP (see `bossObjectHpDelta`).
 */

function assertBodyInt(value: number, field: string, entityId: string): void {
  // Strict positive (§6): the schema expresses maxLp/radiusX100 as .positive(),
  // so the sim must reject zero and negatives exactly like the schema.
  if (!Number.isSafeInteger(value) || value <= 0 || Object.is(value, -0)) {
    throw new KernelInvariantError('P21_OBJECT_INVALID', { entityId, field, value: String(value) });
  }
}

/** Validates the combat-body stats of a content entry (§6). */
export function validateBossObjectContent(content: BossObjectContent): void {
  validateBossObjectSpec(content.spec);
  assertBossObjectId(content.entityId, 'entityId');
  assertBossObjectId(content.ownerId, 'ownerId');
  assertBossObjectId(content.sourceId, 'sourceId');
  assertBodyInt(content.maxLp, 'maxLp', content.entityId);
  assertBodyInt(content.radiusX100, 'radiusX100', content.entityId);
}

/**
 * §6 combat body: the placed object as a targetable kernel entity (full Phase
 * 15 surface, origin `boss_object`). Position comes from the spec; the object
 * is a real body so damage, shields and defeat resolution apply to it — the
 * damage/status policies gate how those effects land.
 */
export function buildBossObjectBody(content: BossObjectContent, tick: Tick): KernelEntity {
  validateBossObjectContent(content);
  return Object.freeze({
    id: content.entityId,
    side: content.side,
    phase: Object.freeze({ phase: 'ACTIVE', enteredTick: tick, controlledReturn: null }),
    maxLp: content.maxLp,
    lp: content.maxLp,
    shield: 0,
    lane: content.spec.lane,
    x100: content.spec.x100,
    targetId: null,
    timers: Object.freeze({}),
    radiusX100: content.radiusX100,
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
    origin: 'boss_object',
    inRangeSinceTick: null,
  });
}

/** §6 damage policy gate for one hit. `immune` zeroes the amount (§6). */
export function bossObjectDamageAmount(policy: DamagePolicy | undefined, rawAmount: number): number {
  return policy === 'immune' ? 0 : rawAmount;
}

/** §6 shield_only: the object's HP is never reduced by direct damage. */
export function bossObjectHpDelta(policy: DamagePolicy | undefined, delta: number): number {
  return policy === 'shield_only' ? 0 : delta;
}
