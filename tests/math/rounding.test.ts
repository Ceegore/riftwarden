import { describe, expect, it } from 'vitest';
import { roundDivHalfAwayFromZero } from '../../src/game/sim/math/rounding';
import { bigRoundDiv } from '../../tools/math/reference-oracle.mjs';

const table: readonly [number, number, number][] = [
  [1, 2, 1],
  [-1, 2, -1],
  [3, 2, 2],
  [-3, 2, -2],
  [1, 3, 0],
  [-1, 3, 0],
  [2, 3, 1],
  [-2, 3, -1],
  [5, -2, -3],
  [-5, -2, 3],
  [0, 7, 0],
];

describe('roundDivHalfAwayFromZero truth table', () => {
  for (const [n, d, expected] of table) {
    it(`round ${String(n)}/${String(d)} = ${String(expected)}`, () => {
      expect(roundDivHalfAwayFromZero(n, d)).toBe(expected);
    });
  }
});

describe('roundDivHalfAwayFromZero guards', () => {
  it('denominator zero blocks with P12_DIVIDE_BY_ZERO', () => {
    expect(() => roundDivHalfAwayFromZero(1, 0)).toThrow('P12_DIVIDE_BY_ZERO');
  });
  it('negative zero operand blocks with P12_NEGATIVE_ZERO', () => {
    expect(() => roundDivHalfAwayFromZero(-0, 2)).toThrow('P12_NEGATIVE_ZERO');
  });
  it('-1/3 normalizes to 0, never -0', () => {
    expect(Object.is(roundDivHalfAwayFromZero(-1, 3), -0)).toBe(false);
    expect(roundDivHalfAwayFromZero(-1, 3)).toBe(0);
  });
  it('large quotient near safe-integer boundary', () => {
    expect(roundDivHalfAwayFromZero(Number.MAX_SAFE_INTEGER, 1)).toBe(Number.MAX_SAFE_INTEGER);
  });
});

describe('roundDivHalfAwayFromZero oracle (1000 cases)', () => {
  it('matches the BigInt oracle', () => {
    let seed = 0x12345678 >>> 0;
    const lcg = (): number => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed;
    };
    for (let i = 0; i < 1000; i += 1) {
      const n = (lcg() % 2 ? 1 : -1) * (lcg() % 1_000_000);
      let d = (lcg() % 999_999) + 1;
      if (lcg() % 2) d = -d;
      expect(roundDivHalfAwayFromZero(n, d)).toBe(bigRoundDiv(n, d));
    }
  });
});
