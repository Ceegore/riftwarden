import { mulDivRound } from '../math/fixed-math.js';
import { remainingTicks } from './status-stacking.js';
import type { StatusInstance, StatusKind } from './status-instance.js';

/**
 * Phase 18 T05 cleanse/dispel selection (§9). Pure and deterministic: cleanse
 * targets negative/control statuses by category then strength/remaining/id;
 * dispel targets positive statuses by strength/remaining/id. `unremovable`
 * instances are always skipped. Shields are never removed here — a shield
 * dispel goes through the Phase-17 shield ledger (§9.2).
 */

/** §9.2: a shield dispel may reduce at most 35% of the target's max HP. */
export const SHIELD_DISPEL_CAP_BPS = 3500;

export function shieldDispelCap(targetMaxHp: number): number {
  return mulDivRound(targetMaxHp, SHIELD_DISPEL_CAP_BPS, 10000);
}

/** §9.1 cleanse categories in priority order (hard control first, mark last). */
export type CleanseCategory = 'hard_control' | 'weaken' | 'poison_burn' | 'slow' | 'mark';

const CLEANSE_CATEGORY_ORDINAL: Readonly<Record<CleanseCategory, number>> = Object.freeze({
  hard_control: 0,
  weaken: 1,
  poison_burn: 2,
  slow: 3,
  mark: 4,
});

export function cleanseCategoryOf(kind: StatusKind): CleanseCategory | null {
  if (kind === 'stun' || kind === 'silence' || kind === 'confusion') return 'hard_control';
  if (kind === 'weaken') return 'weaken';
  if (kind === 'poison' || kind === 'burn') return 'poison_burn';
  if (kind === 'slow') return 'slow';
  if (kind === 'mark') return 'mark';
  return null;
}

export function isUnremovable(instance: StatusInstance): boolean {
  return instance.flags.includes('unremovable');
}

/** §9.1 within-category ordering: stronger, longer remaining, then statusId. */
function cleanseCompare(a: StatusInstance, b: StatusInstance, now: number): number {
  const categoryA = cleanseCategoryOf(a.kind);
  const categoryB = cleanseCategoryOf(b.kind);
  const ordinalA = categoryA === null ? 99 : CLEANSE_CATEGORY_ORDINAL[categoryA];
  const ordinalB = categoryB === null ? 99 : CLEANSE_CATEGORY_ORDINAL[categoryB];
  if (ordinalA !== ordinalB) return ordinalA - ordinalB;
  if (a.strength !== b.strength) return b.strength - a.strength;
  const ra = remainingTicks(a, now);
  const rb = remainingTicks(b, now);
  if (ra !== rb) return rb - ra;
  if (a.statusId !== b.statusId) return a.statusId < b.statusId ? -1 : 1;
  return 0;
}

/** §9.2 dispel ordering: highest strength, longest remaining, then statusId. */
function dispelCompare(a: StatusInstance, b: StatusInstance, now: number): number {
  if (a.strength !== b.strength) return b.strength - a.strength;
  const ra = remainingTicks(a, now);
  const rb = remainingTicks(b, now);
  if (ra !== rb) return rb - ra;
  if (a.statusId !== b.statusId) return a.statusId < b.statusId ? -1 : 1;
  return 0;
}

function removable(instances: readonly StatusInstance[]): StatusInstance[] {
  return instances.filter((instance) => !isUnremovable(instance));
}

/** First removable negative/control instance per §9.1, or undefined. */
export function selectCleanseTarget(instances: readonly StatusInstance[], now: number): StatusInstance | undefined {
  const candidates = removable(instances).filter((instance) => cleanseCategoryOf(instance.kind) !== null);
  if (candidates.length === 0) return undefined;
  return [...candidates].sort((a, b) => cleanseCompare(a, b, now))[0];
}

/** First removable positive instance per §9.2, or undefined. */
export function selectDispelTarget(instances: readonly StatusInstance[], now: number): StatusInstance | undefined {
  const candidates = removable(instances).filter((instance) => instance.polarity === 'positive');
  if (candidates.length === 0) return undefined;
  return [...candidates].sort((a, b) => dispelCompare(a, b, now))[0];
}
