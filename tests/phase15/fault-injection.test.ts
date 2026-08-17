import { describe, it, expect } from 'vitest';
import { selectDeadlockBuffTarget } from '../../src/game/sim/anti-stuck/deadlock.js';
import { separationPairKey, validateOvertakeGrant } from '../../src/game/sim/collision/separation.js';
import { edgeDistanceX100, type Body } from '../../src/game/sim/geometry/distance.js';
import { asX100, type Lane } from '../../src/game/sim/geometry/x100.js';
import { advanceLaneChange, startLaneChange } from '../../src/game/sim/movement/lane-change.js';
import { movementStep } from '../../src/game/sim/movement/movement-step.js';
import { validatePhase15EntitySnapshot, type Phase15EntitySnapshot } from '../../src/game/sim/snapshot/phase15-projection.js';
import { tick } from '../../src/game/sim/core/primitives.js';
import { KernelInvariantError } from '../../src/game/sim/core/invariant-error.js';

function codeOf(fn: () => unknown): string {
  try {
    fn();
  } catch (error) {
    return error instanceof KernelInvariantError ? error.code : String(error);
  }
  return '';
}

const body = (id: string, x100: number, lane: Lane = 'middle'): Body => ({ id, x100: asX100(x100), radiusX100: asX100(20), lane });

describe('fault injection', () => {
  it('rejects an unknown lane in the separation pair key', () => {
    const unknown = { ...body('a', 100), lane: 'sideways' as Lane };
    expect(codeOf(() => separationPairKey(unknown, body('b', 200)))).toBe('P15_LANE_INVALID');
  });

  it('rejects an unknown lane in deadlock target selection', () => {
    expect(codeOf(() => selectDeadlockBuffTarget([{ entityId: 'a', lane: 'sideways' as Lane, edgeDistanceX100: 1 }]))).toBe('P15_LANE_INVALID');
  });

  it('rejects non-safe-integer positions', () => {
    expect(codeOf(() => asX100(1.5))).toBe('P15_X100_NOT_INTEGER');
    expect(codeOf(() => asX100(Number.MAX_SAFE_INTEGER + 1))).toBe('P15_X100_NOT_INTEGER');
  });

  it('rejects a corrupt movement remainder', () => {
    expect(codeOf(() => movementStep(30, 30))).toBe('P15_MOVE_REMAINDER_INVALID');
    expect(codeOf(() => movementStep(30, -1))).toBe('P15_MOVE_REMAINDER_INVALID');
  });

  it('rejects an impossible lane-change progress', () => {
    const lane = startLaneChange('top', 'middle', tick(0), 'a');
    expect(codeOf(() => advanceLaneChange({ ...lane, progressTicks: 36 }, 'top'))).toBe('P15_LANECHANGE_STATE_INVALID');
  });

  it('rejects an unauthorized overtake window', () => {
    expect(codeOf(() => {
      validateOvertakeGrant({ entityId: 'a', effectId: 'fx', startTick: 20, endTick: 10 });
    })).toBe('P15_OVERTAKE_UNAUTHORIZED');
  });

  it('rejects a snapshot with an out-of-field x100', () => {
    const base: Phase15EntitySnapshot = {
      id: 'e1', x100: asX100(500), radiusX100: asX100(20), lane: 'middle', movementRemainder: 0,
      laneChange: null, normalLaneChangeCooldownUntilTick: 0, overtakeGrant: null,
      noProgressTicks: 0, repathTicks: [], laneFallbackUsed: false, deadlockBuffConsumed: false, frontDeadlockBlockedTicks: 0,
    };
    expect(codeOf(() => {
      validatePhase15EntitySnapshot({ ...base, x100: asX100(10001) });
    })).toBe('P15_SNAPSHOT_INCOMPATIBLE');
  });

  it('keeps edge distance symmetric for touching and disjoint bodies', () => {
    const a = body('a', 100);
    const b = body('b', 140);
    expect(edgeDistanceX100(a, b)).toBe(0);
    expect(edgeDistanceX100(a, b)).toBe(edgeDistanceX100(b, a));
  });
});
