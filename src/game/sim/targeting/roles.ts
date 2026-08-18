import type { Role } from './types.js';

/** Roles that prefer staying at range instead of closing to melee. */
export function roleNeedsPreferredRange(role: Role): boolean {
  return role === 'marksman' || role === 'mage' || role === 'controller' || role === 'healer' || role === 'support';
}

/**
 * Healer eligibility threshold (kit, inclusive 12%): a candidate is healable
 * when its missing LP in basis points reaches 1200 (i.e. missing >= 12%).
 */
export function healerEligible(hp: number, maxHp: number): boolean {
  return (maxHp - hp) * 10000 >= maxHp * 1200;
}
