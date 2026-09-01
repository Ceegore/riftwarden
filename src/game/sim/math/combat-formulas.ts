import { basisPoints, milliValue, type BasisPoints, type MilliValue } from '../../rules/units.js';
import { clampInteger, mulDivRound } from './fixed-math.js';
import { assertRange, assertSafeInteger } from './numeric-validation.js';

export const DEFENSE_MIN = -40;
export const DEFENSE_MAX = 200;
export const DEFAULT_BOSS_TRUE_DAMAGE_CAP_BPS = basisPoints(1_800);

export function effectiveDefense(defense: number): number {
  return clampInteger(defense, DEFENSE_MIN, DEFENSE_MAX);
}
export function mitigatedDamage(rawDamage: MilliValue, defense: number, successfulHit = true): MilliValue {
  assertSafeInteger(rawDamage, 'rawDamage');
  if (rawDamage <= 0) return milliValue(0);
  const final = Math.max(0, mulDivRound(rawDamage, 100, 100 + effectiveDefense(defense)));
  return milliValue(successfulHit ? Math.max(1, final) : final);
}
export function cappedTrueDamage(rawDamage: MilliValue, targetMaxHp: MilliValue, capBps: BasisPoints | null): MilliValue {
  assertSafeInteger(rawDamage, 'rawDamage'); assertRange(targetMaxHp, 0, Number.MAX_SAFE_INTEGER, 'targetMaxHp');
  if (rawDamage <= 0 || targetMaxHp === 0) return milliValue(0);
  if (capBps === null) return milliValue(rawDamage);
  const cap = mulDivRound(targetMaxHp, capBps, 10_000);
  return milliValue(Math.min(rawDamage, Math.max(0, cap)));
}
