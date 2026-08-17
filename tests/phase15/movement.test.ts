import { describe, it, expect } from 'vitest';
import { advanceLaneChange, laneThreatQualifies, startLaneChange } from '../../src/game/sim/movement/lane-change.js';
import { clampToField, movementStep } from '../../src/game/sim/movement/movement-step.js';
import { asFieldX100, asX100 } from '../../src/game/sim/geometry/x100.js';
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

describe('movement step', () => {
  it('conserves exactly one second of speed over 30 ticks', () => {
    for (const speed of [0, 1, 29, 30, 31, 100, 999]) {
      let remainder = 0;
      let sum = 0;
      for (let i = 0; i < 30; i++) {
        const n = movementStep(speed, remainder);
        sum += n.stepX100;
        remainder = n.remainder;
      }
      expect(sum).toBe(speed);
      expect(remainder).toBe(0);
    }
  });

  it('keeps the remainder in 0..29 and the step integer', () => {
    const n = movementStep(100, 29);
    expect(n.stepX100).toBe(4);
    expect(n.remainder).toBe(9);
  });

  it('rejects invalid speed and remainder', () => {
    expect(codeOf(() => movementStep(1.5, 0))).toBe('P15_X100_NOT_INTEGER');
    expect(codeOf(() => movementStep(-1, 0))).toBe('P15_X100_NOT_INTEGER');
    expect(codeOf(() => movementStep(30, -1))).toBe('P15_MOVE_REMAINDER_INVALID');
    expect(codeOf(() => movementStep(30, 30))).toBe('P15_MOVE_REMAINDER_INVALID');
  });

  it('clamps to the field boundary in both directions', () => {
    expect(clampToField(asFieldX100(5), asX100(20), -1)).toBe(0);
    expect(clampToField(asFieldX100(9995), asX100(20), 1)).toBe(10000);
    expect(clampToField(asFieldX100(5000), asX100(100), -1)).toBe(4900);
  });
});

describe('lane change', () => {
  it('switches the logical lane at 18 and completes at 36', () => {
    let state: ReturnType<typeof startLaneChange> | null = startLaneChange('top', 'middle', tick(0), 'entity_a');
    let logicalLane: 'top' | 'middle' | 'bottom' = 'top';
    let switched = 0;
    let completed = 0;
    for (let i = 0; i < 36 && state !== null; i++) {
      const r = advanceLaneChange(state, logicalLane);
      logicalLane = r.logicalLane;
      state = r.state;
      if (r.switched) switched++;
      if (r.completed) completed++;
      if (i === 16) expect(logicalLane).toBe('top');
      if (i === 17) expect(logicalLane).toBe('middle');
    }
    expect(switched).toBe(1);
    expect(completed).toBe(1);
  });

  it('rejects non-adjacent top↔bottom changes', () => {
    expect(codeOf(() => startLaneChange('top', 'bottom', tick(0), 'entity_a'))).toBe('P15_LANECHANGE_DIRECT_NON_ADJACENT');
  });

  it('rejects an out-of-range progress', () => {
    const lane = startLaneChange('top', 'middle', tick(0), 'entity_a');
    expect(codeOf(() => advanceLaneChange({ ...lane, progressTicks: 36 }, 'top'))).toBe('P15_LANECHANGE_STATE_INVALID');
  });

  it('applies the 20% integer threat rule', () => {
    expect(laneThreatQualifies(100, 120)).toBe(true);
    expect(laneThreatQualifies(100, 119)).toBe(false);
    expect(codeOf(() => laneThreatQualifies(1.5, 120))).toBe('P15_X100_NOT_INTEGER');
  });
});
