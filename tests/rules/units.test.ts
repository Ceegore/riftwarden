import { describe, expect, it } from 'vitest';
import {
  tick,
  positionX100,
  milliValue,
  basisPoints,
  currency,
  commitId,
  sequence,
  addTicks,
  addMilli,
  subtractCurrency,
  nextSequence,
  unbrand,
} from '../../src/game/rules/units';

const constructors: [string, (v: number) => number, number][] = [
  ['tick', tick, 0],
  ['position', positionX100, 5000],
  ['milli', milliValue, -1000],
  ['bps', basisPoints, 10000],
  ['currency', currency, 0],
  ['commit', commitId, 0],
  ['sequence', sequence, 0],
];

describe('units accept valid integers', () => {
  for (const [name, fn, good] of constructors) {
    it(`${name} accepts valid integer`, () => {
      expect(unbrand(fn(good))).toBe(good);
    });
  }
});

describe('units reject invalid numbers', () => {
  for (const bad of [1.5, NaN, Infinity, -Infinity, -0]) {
    for (const [name, fn] of constructors) {
      it(`${name} rejects ${String(bad)}`, () => {
        expect(() => fn(bad)).toThrow();
      });
    }
  }
});

describe('units enforce domain boundaries', () => {
  it('tick rejects negative', () => {
    expect(() => tick(-1)).toThrow();
  });
  it('position rejects below', () => {
    expect(() => positionX100(-1)).toThrow();
  });
  it('position rejects above', () => {
    expect(() => positionX100(10001)).toThrow();
  });
  it('bps default lower bound', () => {
    expect(() => basisPoints(-1)).toThrow();
  });
  it('bps default upper bound', () => {
    expect(() => basisPoints(50001)).toThrow();
  });
  it('bps explicit signed domain', () => {
    expect(unbrand(basisPoints(-4000, -4000, 20000))).toBe(-4000);
  });
  it('currency rejects negative', () => {
    expect(() => currency(-1)).toThrow();
  });
});

describe('unit arithmetic', () => {
  it('add ticks', () => {
    expect(unbrand(addTicks(tick(2), tick(3)))).toBe(5);
  });
  it('add milli signed', () => {
    expect(unbrand(addMilli(milliValue(-2), milliValue(3)))).toBe(1);
  });
  it('currency underflow', () => {
    expect(() => subtractCurrency(currency(1), currency(2))).toThrow();
  });
  it('sequence increments', () => {
    expect(unbrand(nextSequence(sequence(8)))).toBe(9);
  });
  it('overflow blocks', () => {
    expect(() => addTicks(tick(Number.MAX_SAFE_INTEGER), tick(1))).toThrow();
  });
});
