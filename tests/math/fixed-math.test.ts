import { describe, expect, it } from 'vitest';
import { basisPoints } from '../../src/game/rules/units';
import { applyBasisPoints, ratioBasisPoints, mulDivRound, clampInteger } from '../../src/game/sim/math/fixed-math';
import { bigMulDiv } from '../../tools/math/reference-oracle.mjs';

describe('applyBasisPoints', () => {
  it('12.5% of 1000 is 125', () => {
    expect(applyBasisPoints(1000, basisPoints(1250))).toBe(125);
  });
  it('75% of 101 rounds away from zero', () => {
    expect(applyBasisPoints(101, basisPoints(7500))).toBe(76);
  });
  it('monotonic positive', () => {
    for (let v = 0; v < 10000; v += 37) {
      expect(applyBasisPoints(v, basisPoints(7500))).toBeLessThanOrEqual(applyBasisPoints(v + 1, basisPoints(7500)));
    }
  });
});

describe('ratioBasisPoints', () => {
  it('1/8 is 1250 bps', () => {
    expect(ratioBasisPoints(1, 8)).toBe(1250);
  });
});

describe('mulDivRound', () => {
  it('gcd reduction avoids avoidable intermediate overflow', () => {
    expect(mulDivRound(9_000_000_000, 1_000_000, 1_000_000)).toBe(9_000_000_000);
  });
  it('irreducible overflow blocks with P12_MULTIPLY_OVERFLOW', () => {
    expect(() => mulDivRound(Number.MAX_SAFE_INTEGER, 2, 1)).toThrow('P12_MULTIPLY_OVERFLOW');
  });
  it('denominator zero blocks', () => {
    expect(() => mulDivRound(1, 1, 0)).toThrow('P12_DIVIDE_BY_ZERO');
  });
  it('zero factor yields zero', () => {
    expect(mulDivRound(12345, 0, 777)).toBe(0);
  });
  it('identity for denominator one', () => {
    expect(mulDivRound(42, 1, 1)).toBe(42);
  });
  it('oracle equality over 1000 cases', () => {
    let seed = 7 >>> 0;
    const lcg = (): number => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed;
    };
    for (let i = 0; i < 1000; i += 1) {
      const a = (lcg() % 200_000) - 100_000;
      const b = (lcg() % 20_000) - 10_000;
      const d = (lcg() % 9999) + 1;
      expect(mulDivRound(a, b, d)).toBe(bigMulDiv(a, b, d));
    }
  });
});

describe('clampInteger', () => {
  it('saturates below and above', () => {
    expect(clampInteger(-5, 0, 10)).toBe(0);
    expect(clampInteger(15, 0, 10)).toBe(10);
    expect(clampInteger(5, 0, 10)).toBe(5);
  });
  it('idempotent', () => {
    expect(clampInteger(clampInteger(99, 0, 10), 0, 10)).toBe(10);
  });
  it('result always inside [min, max]', () => {
    for (let v = -20; v <= 20; v += 1) {
      const r = clampInteger(v, -3, 7);
      expect(r).toBeGreaterThanOrEqual(-3);
      expect(r).toBeLessThanOrEqual(7);
    }
  });
  it('min > max blocks with P12_RANGE', () => {
    expect(() => clampInteger(1, 10, 0)).toThrow('P12_RANGE');
  });
});
