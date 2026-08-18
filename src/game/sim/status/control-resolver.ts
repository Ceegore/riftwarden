import { KernelInvariantError } from '../core/invariant-error.js';
import { basisPoints, tick } from '../../rules/units.js';
import { controlDurationTicks } from '../math/time-and-speed.js';
import { controlCategoryOf, type StatusKind } from './status-instance.js';

/**
 * Phase 18 T04 control resolver (§8). Reuses the authoritative Phase-12/13
 * duration math (`controlDurationTicks`, which applies round-half-away-from-
 * zero and the 0.65s boss hard-control cap) and adds the §8.2 boss resistance
 * tiers plus the confusion-vs-boss conversion. No new damage/CC formula is
 * invented here.
 */

export const BOSS_TIERS = ['normal', 'ascended', 'heart'] as const;
export type BossTier = (typeof BOSS_TIERS)[number];

/** §8.2 boss resistance: normal 70%, ascended 80%, heart 85%. */
export const BOSS_RESISTANCE_BPS: Readonly<Record<BossTier, number>> = Object.freeze({
  normal: 7000,
  ascended: 8000,
  heart: 8500,
});

export type ControlTargetTier = 'regular' | BossTier;

export function bossResistanceBps(tier: BossTier): number {
  return BOSS_RESISTANCE_BPS[tier];
}

export interface ControlDurationResolution {
  readonly effectiveTicks: number;
  readonly resistanceBps: number;
  /** True when the 0.65s hard-control boss cap participated in the result. */
  readonly hardControlBossCapApplied: boolean;
}

/**
 * §8.2: `effectiveDuration = roundHalfAway(base * (10000 - resistance) / 10000)`.
 * Boss resistance tiers apply to all control; the 0.65s cap additionally
 * applies only to hard control against a boss. Regular targets are unmodified.
 */
export function effectiveControlDurationTicks(kind: StatusKind, baseTicks: number, target: ControlTargetTier): ControlDurationResolution {
  const category = controlCategoryOf(kind);
  if (category === null) {
    throw new KernelInvariantError('P14_SNAPSHOT_INVALID', { reason: 'control-kind-required', kind });
  }
  if (!Number.isSafeInteger(baseTicks) || baseTicks < 0) {
    throw new KernelInvariantError('P14_SNAPSHOT_INVALID', { reason: 'control-base-ticks', baseTicks });
  }
  const isBoss = target !== 'regular';
  const resistanceBps = isBoss ? bossResistanceBps(target) : 0;
  const hardBoss = isBoss && category === 'hard';
  const effectiveTicks = controlDurationTicks(tick(baseTicks), basisPoints(resistanceBps), hardBoss) as number;
  return { effectiveTicks, resistanceBps, hardControlBossCapApplied: hardBoss };
}

/** §8.1: confusion never deals friendly fire; against a boss it converts to the interrupt/resist feedback path. */
export function confusionResolution(kind: StatusKind, isBoss: boolean): 'converted_to_interrupt' | 'applied' {
  if (kind !== 'confusion') return 'applied';
  return isBoss ? 'converted_to_interrupt' : 'applied';
}

/** §8.4: without a content diminishing/immune rule a hard-control status stays blocked — no generic formula is invented. */
export function resolveAntiPermalock(hasDiminishingRule: boolean): 'ok' | 'BLOCKED_CONTENT_POLICY' {
  return hasDiminishingRule ? 'ok' : 'BLOCKED_CONTENT_POLICY';
}
