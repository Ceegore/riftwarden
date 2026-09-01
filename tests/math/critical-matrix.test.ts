import { describe, expect, it } from 'vitest';
import { basisPoints, milliValue, tick } from '../../src/game/rules/units';
import { mulDivRound, applyBasisPoints, ratioBasisPoints } from '../../src/game/sim/math/fixed-math';
import { mitigatedDamage, cappedTrueDamage } from '../../src/game/sim/math/combat-formulas';
import { secondsToTicks, numberSecondsToTicks, controlDurationTicks } from '../../src/game/sim/math/time-and-speed';

describe('rounding extremes', () => {
  it('large GCD-reducible pair', () => {
    expect(mulDivRound(Number.MAX_SAFE_INTEGER, 1, Number.MAX_SAFE_INTEGER)).toBe(1);
  });
  it('mulDiv round half at 1.5', () => {
    expect(mulDivRound(3, 1, 2)).toBe(2);
  });
  it('sign symmetry no overflow', () => {
    expect(mulDivRound(-3, 1, 2)).toBe(-2);
    expect(mulDivRound(3, -1, 2)).toBe(-2);
  });
});

describe('seconds matrix', () => {
  it('0.01s no warning (exactly 10ms deviation)', () => {
    const r = secondsToTicks('0.01');
    expect(r.ticks).toBe(0);
    expect(r.warningCode).toBeUndefined();
  });
  it('0.016s warns', () => {
    const r = secondsToTicks('0.016');
    expect(r.warningCode).toBe('P12_SECONDS_PRECISION_WARNING');
  });
  it('0.001 with minimum is 1', () => {
    expect(secondsToTicks('0.001', true).ticks).toBe(1);
  });
  it('long fraction beyond safe integer blocks', () => {
    expect(() => secondsToTicks('0.12345678901234567890')).toThrow();
  });
  it('big whole seconds overflow blocks', () => {
    expect(() => secondsToTicks(String(Number.MAX_SAFE_INTEGER))).toThrow();
  });
  it('whitespace around decimal blocks', () => {
    expect(() => secondsToTicks(' 0.5')).toThrow('P12_DECIMAL_SYNTAX');
    expect(() => secondsToTicks('0.5 ')).toThrow('P12_DECIMAL_SYNTAX');
  });
  it('leading zeros block', () => {
    expect(() => secondsToTicks('01.5')).toThrow('P12_DECIMAL_SYNTAX');
  });
  it('number adapter tiny value', () => {
    expect(numberSecondsToTicks(0.001, true).ticks).toBe(1);
  });
});

describe('control matrix', () => {
  it('resistance 0 keeps base', () => {
    expect(controlDurationTicks(tick(75), basisPoints(0), false)).toBe(75);
  });
  it('resistance 1 rounds to 75', () => {
    expect(controlDurationTicks(tick(75), basisPoints(1), false)).toBe(75);
  });
  it('resistance 6999 -> 23', () => {
    expect(controlDurationTicks(tick(75), basisPoints(6999), false)).toBe(23);
  });
  it('resistance 10000 -> 0', () => {
    expect(controlDurationTicks(tick(75), basisPoints(10000), false)).toBe(0);
  });
  it('resistance 10001 blocks', () => {
    expect(() => controlDurationTicks(tick(75), basisPoints(10001))).toThrow();
  });
  it('boss cap just below (0.64s -> 19)', () => {
    expect(controlDurationTicks(tick(100), basisPoints(0), true)).toBe(20);
  });
});

describe('true damage matrix', () => {
  it('cap 0 bps -> zero', () => {
    expect(cappedTrueDamage(milliValue(9999), milliValue(10000), basisPoints(0))).toBe(0);
  });
  it('raw exactly at cap', () => {
    expect(cappedTrueDamage(milliValue(1800), milliValue(10000), basisPoints(1800))).toBe(1800);
  });
  it('huge safe raw under a huge cap passes', () => {
    expect(cappedTrueDamage(milliValue(1000), milliValue(1_000_000_000_000), basisPoints(1800))).toBe(1000);
  });
  it('cap whose irreducible product overflows blocks per §7.2', () => {
    expect(() => cappedTrueDamage(milliValue(1000), milliValue(Number.MAX_SAFE_INTEGER), basisPoints(1800))).toThrow('P12_MULTIPLY_OVERFLOW');
  });
});

describe('damage matrix', () => {
  it('huge safe raw with 200 defense', () => {
    // MAX_SAFE × 100/300 = 1/3 → 3002399751580330.33 → half-away stays
    expect(mitigatedDamage(milliValue(Number.MAX_SAFE_INTEGER), 200)).toBe(3002399751580330);
  });
  it('unsuccessful hit returns the mathematical result without minimum lift', () => {
    expect(mitigatedDamage(milliValue(1), 200, false)).toBe(0);
    expect(mitigatedDamage(milliValue(1), 0, false)).toBe(1);
  });
});

describe('BPS extremes', () => {
  it('bps 9999', () => {
    expect(applyBasisPoints(1000, basisPoints(9999))).toBe(1000);
  });
  it('bps 10000 is 100%', () => {
    expect(applyBasisPoints(1000, basisPoints(10000))).toBe(1000);
  });
  it('bps 20000 is 200%', () => {
    expect(applyBasisPoints(1000, basisPoints(20000))).toBe(2000);
  });
  it('ratio 10/1 out of brand range blocks', () => {
    expect(() => ratioBasisPoints(10, 1)).toThrow();
  });
  it('ratio negative', () => {
    expect(ratioBasisPoints(-1, 8)).toBe(-1250);
  });
});
