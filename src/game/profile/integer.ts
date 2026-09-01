/**
 * Phase 31 integer discipline (PROFILE_PROGRESSION_CONTRACT): currency, fame,
 * level, contract level, copies and stats are non-negative safe integers.
 * Derived stats use integer arithmetic only with a documented single rounding
 * at the fixed stage — permille scaling floors exactly once.
 */
export function isNonNegativeSafeInteger(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}

export function assertNonNegativeInteger(value: number, label: string): void {
  if (!isNonNegativeSafeInteger(value)) {
    throw new Error(`${label} must be a non-negative safe integer`);
  }
}

/** `floor(value * permille / 1000)` in integer arithmetic (single rounding). */
export function mulPermilleFloor(value: number, permille: number): number {
  assertNonNegativeInteger(value, 'value');
  assertNonNegativeInteger(permille, 'permille');
  return Math.floor((value * permille) / 1000);
}
