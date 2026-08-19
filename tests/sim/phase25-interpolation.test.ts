import { describe, expect, it } from 'vitest';
import { clampAlpha1000, interpolateInt } from '../../src/game/render/interpolation.js';
import { catchRenderCode } from './phase25-helpers.js';

describe('clampAlpha1000', () => {
  it('keeps integer values in 0..1000 unchanged', () => {
    for (const alpha of [0, 1, 250, 500, 750, 999, 1000]) {
      expect(clampAlpha1000(alpha)).toBe(alpha);
    }
  });

  it('clamps below zero and above 1000', () => {
    expect(clampAlpha1000(-1)).toBe(0);
    expect(clampAlpha1000(-1000)).toBe(0);
    expect(clampAlpha1000(1001)).toBe(1000);
    expect(clampAlpha1000(2000)).toBe(1000);
  });

  it('rejects non-integer alpha as a contract violation', () => {
    expect(catchRenderCode(() => clampAlpha1000(0.5))).toBe('ALPHA_NOT_INTEGER');
    expect(catchRenderCode(() => clampAlpha1000(Number.NaN))).toBe('ALPHA_NOT_INTEGER');
    expect(catchRenderCode(() => clampAlpha1000(Number.POSITIVE_INFINITY))).toBe('ALPHA_NOT_INTEGER');
  });
});

describe('interpolateInt', () => {
  it('returns the exact endpoints at alpha 0 and 1000', () => {
    expect(interpolateInt(0, 100, 0)).toBe(0);
    expect(interpolateInt(0, 100, 1000)).toBe(100);
    expect(interpolateInt(10, 20, 0)).toBe(10);
    expect(interpolateInt(10, 20, 1000)).toBe(20);
  });

  it('interpolates the midpoint exactly', () => {
    expect(interpolateInt(0, 100, 500)).toBe(50);
    expect(interpolateInt(-100, 100, 500)).toBe(0);
    expect(interpolateInt(7, 11, 500)).toBe(9);
  });

  it('works on descending ranges', () => {
    expect(interpolateInt(20, 10, 0)).toBe(20);
    expect(interpolateInt(20, 10, 500)).toBe(15);
    expect(interpolateInt(20, 10, 1000)).toBe(10);
  });

  it('never extrapolates: out-of-range alpha clamps to endpoints', () => {
    expect(interpolateInt(10, 20, -7)).toBe(10);
    expect(interpolateInt(10, 20, 2000)).toBe(20);
  });

  it('rounds half away from zero', () => {
    expect(interpolateInt(0, 1, 499)).toBe(0);
    expect(interpolateInt(0, 1, 500)).toBe(1);
    expect(interpolateInt(0, 1, 999)).toBe(1);
    expect(interpolateInt(0, -1, 500)).toBe(-1);
    expect(interpolateInt(0, -1, 499)).toBe(0);
  });

  it('is safe across large integer ranges', () => {
    const from = -1_000_000_000;
    const to = 1_000_000_000;
    expect(interpolateInt(from, to, 0)).toBe(from);
    expect(interpolateInt(from, to, 1000)).toBe(to);
    expect(interpolateInt(from, to, 500)).toBe(0);
  });

  it('rejects non-integer alpha', () => {
    expect(catchRenderCode(() => interpolateInt(0, 100, 1.5))).toBe('ALPHA_NOT_INTEGER');
  });

  it('is deterministic and bounded for the pinned boundary grid', () => {
    const from = -500;
    const to = 700;
    for (let alpha = 0; alpha <= 1000; alpha += 1) {
      const result = interpolateInt(from, to, alpha);
      expect(Number.isInteger(result)).toBe(true);
      expect(result).toBeGreaterThanOrEqual(from);
      expect(result).toBeLessThanOrEqual(to);
      expect(interpolateInt(from, to, alpha)).toBe(result);
    }
  });

  it('is monotonic in alpha', () => {
    let previous = interpolateInt(-300, 900, 0);
    for (let alpha = 1; alpha <= 1000; alpha += 1) {
      const current = interpolateInt(-300, 900, alpha);
      expect(current >= previous).toBe(true);
      previous = current;
    }
  });

  it('matches the integer rounding formula across a property sweep', () => {
    for (let delta = -200; delta <= 200; delta += 13) {
      for (const alpha of [0, 1, 499, 500, 501, 999, 1000]) {
        const scaled = delta * alpha;
        const q = Math.trunc(scaled / 1000);
        const r = Math.abs(scaled % 1000);
        const rounded = r >= 500 ? q + (scaled >= 0 ? 1 : -1) : q;
        const expected = Object.is(rounded, -0) ? 0 : rounded;
        expect(interpolateInt(0, delta, alpha)).toBe(expected);
      }
    }
  });
});
