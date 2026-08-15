import { describe, expect, it } from 'vitest';
import { milliValue, basisPoints, tick } from '../../src/game/rules/units';
import { roundDivHalfAwayFromZero } from '../../src/game/sim/math/rounding';
import { mulDivRound } from '../../src/game/sim/math/fixed-math';
import { mitigatedDamage, cappedTrueDamage } from '../../src/game/sim/math/combat-formulas';
import { secondsToTicks, controlDurationTicks } from '../../src/game/sim/math/time-and-speed';

// Each sentinel breaks when the corresponding §11.4 mutation is applied.
describe('mutation kill matrix', () => {
  it('half-positive: half-step >= -> > must break', () => {
    expect(roundDivHalfAwayFromZero(1, 2)).toBe(1);
  });
  it('half-negative: away-from-zero -> toward-zero must break', () => {
    expect(roundDivHalfAwayFromZero(-1, 2)).toBe(-1);
  });
  it('negative-zero: removing -0 normalization must break (-1/3)', () => {
    expect(Object.is(roundDivHalfAwayFromZero(-1, 3), -0)).toBe(false);
  });
  it('defense-min: -40 -> -39 must break', () => {
    expect(mitigatedDamage(milliValue(1000), -41)).toBe(1667);
  });
  it('defense-max: 200 -> 201 must break', () => {
    expect(mitigatedDamage(milliValue(1000), 201)).toBe(333);
  });
  it('minimum-hit: removing minimum damage must break', () => {
    expect(mitigatedDamage(milliValue(1), 200, true)).toBe(1);
  });
  it('boss-cap: 1800 -> 1801 must break', () => {
    expect(cappedTrueDamage(milliValue(9999), milliValue(10000), basisPoints(1800))).toBe(1800);
  });
  it('attack-min: 0.45s trunc instead of round must break', () => {
    expect(secondsToTicks('0.45', true).ticks).toBe(14);
  });
  it('control-cap: removing boss cap must break', () => {
    expect(controlDurationTicks(tick(75), basisPoints(7000), true)).toBe(20);
  });
  it('gcd-reduction: removing gcd reduction must break', () => {
    expect(mulDivRound(9_000_000_000, 1_000_000, 1_000_000)).toBe(9_000_000_000);
  });
  it('overflow-check: removing the safe check must break (MAX_SAFE × 2)', () => {
    expect(() => mulDivRound(Number.MAX_SAFE_INTEGER, 2, 1)).toThrow('P12_MULTIPLY_OVERFLOW');
  });
});
