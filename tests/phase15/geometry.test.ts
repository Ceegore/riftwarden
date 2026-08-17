import { describe, it, expect } from 'vitest';
import { edgeDistanceX100, isInRange, overlapDepthX100, requiredCenterDistanceX100, type Body } from '../../src/game/sim/geometry/distance.js';
import { asFieldX100, asX100, LANE_ORDINAL, LANES, nonNegativeX100 } from '../../src/game/sim/geometry/x100.js';
import { KernelInvariantError } from '../../src/game/sim/core/invariant-error.js';

function body(id: string, x100: number, radiusX100: number, lane: 'top' | 'middle' | 'bottom' = 'middle'): Body {
  return { id, x100: asFieldX100(x100), radiusX100: nonNegativeX100(radiusX100, 'P15_RADIUS_NEGATIVE'), lane };
}

function codeOf(fn: () => unknown): string {
  try {
    fn();
  } catch (error) {
    return error instanceof KernelInvariantError ? error.code : String(error);
  }
  return '';
}

describe('x100 guards', () => {
  it('accepts safe integers and brands the value', () => {
    expect(asX100(0)).toBe(0);
    expect(asX100(10000)).toBe(10000);
  });

  it('rejects non-safe-integer, float and negative-field values', () => {
    expect(codeOf(() => asX100(1.5))).toBe('P15_X100_NOT_INTEGER');
    expect(codeOf(() => asX100(Number.MAX_SAFE_INTEGER + 1))).toBe('P15_X100_NOT_INTEGER');
    expect(codeOf(() => asFieldX100(-1))).toBe('P15_POSITION_OUT_OF_FIELD');
    expect(codeOf(() => asFieldX100(10001))).toBe('P15_POSITION_OUT_OF_FIELD');
    expect(codeOf(() => nonNegativeX100(-1))).toBe('P15_RANGE_NEGATIVE');
  });

  it('defines the three lanes with stable ordinals', () => {
    expect(LANES).toEqual(['top', 'middle', 'bottom']);
    expect(LANE_ORDINAL.top).toBe(0);
    expect(LANE_ORDINAL.middle).toBe(1);
    expect(LANE_ORDINAL.bottom).toBe(2);
  });
});

describe('edge distance', () => {
  it('is symmetric and inclusive at the range boundary', () => {
    const a = body('a', 100, 20);
    const b = body('b', 160, 30);
    expect(edgeDistanceX100(a, b)).toBe(10);
    expect(edgeDistanceX100(a, b)).toBe(edgeDistanceX100(b, a));
    expect(isInRange(a, b, asX100(10))).toBe(true);
  });

  it('returns 0 for touching bodies and positive depth for overlap', () => {
    const a = body('a', 100, 20);
    const b = body('b', 150, 30);
    expect(edgeDistanceX100(a, b)).toBe(0);
    expect(overlapDepthX100(a, b)).toBe(0);
    const c = body('c', 120, 20);
    expect(overlapDepthX100(a, c)).toBe(20);
  });

  it('computes required center distance from radii plus gap', () => {
    const a = body('a', 100, 20);
    const b = body('b', 500, 30);
    expect(requiredCenterDistanceX100(a, b, asX100(10))).toBe(60);
  });

  it('rejects a negative range', () => {
    const a = body('a', 100, 20);
    const b = body('b', 160, 30);
    expect(codeOf(() => isInRange(a, b, asX100(-1)))).toBe('P15_RANGE_NEGATIVE');
  });
});

describe('mirror property', () => {
  it('mirrors position while preserving edge distance', () => {
    for (let ax = 0; ax <= 100; ax += 10) {
      for (let bx = 0; bx <= 100; bx += 10) {
        for (let ar = 0; ar <= 20; ar += 10) {
          for (let br = 0; br <= 20; br += 10) {
            const a = body('a', ax, ar);
            const b = body('b', bx, br);
            const ma = body('a', 100 - ax, ar);
            const mb = body('b', 100 - bx, br);
            expect(edgeDistanceX100(a, b)).toBe(edgeDistanceX100(ma, mb));
          }
        }
      }
    }
  });
});
