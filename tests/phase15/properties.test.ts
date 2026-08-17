import { describe, it, expect } from 'vitest';
import { separateAllies } from '../../src/game/sim/collision/separation.js';
import { edgeDistanceX100, type Body } from '../../src/game/sim/geometry/distance.js';
import { asX100, type Lane } from '../../src/game/sim/geometry/x100.js';
import { updateStuck, type StuckState } from '../../src/game/sim/anti-stuck/anti-stuck.js';
import { validatePhase15EntitySnapshot, type Phase15EntitySnapshot } from '../../src/game/sim/snapshot/phase15-projection.js';

const body = (id: string, x100: number, r: number, lane: Lane = 'middle'): Body => ({ id, x100: asX100(x100), radiusX100: asX100(r), lane });

describe('metamorphic properties', () => {
  it('edge distance is invariant under translation within the field', () => {
    for (let shift = 0; shift <= 1000; shift += 250) {
      const a = body('a', 100, 20);
      const b = body('b', 300, 30);
      const ta = { ...a, x100: asX100(a.x100 + shift) };
      const tb = { ...b, x100: asX100(b.x100 + shift) };
      expect(edgeDistanceX100(ta, tb)).toBe(edgeDistanceX100(a, b));
    }
  });

  it('snapshot validation is a stable round-trip through JSON', () => {
    const snapshot: Phase15EntitySnapshot = {
      id: 'e1', x100: asX100(500), radiusX100: asX100(20), lane: 'middle', movementRemainder: 17,
      laneChange: null, normalLaneChangeCooldownUntilTick: 90, overtakeGrant: null,
      noProgressTicks: 3, repathTicks: [10, 20], laneFallbackUsed: false, deadlockBuffConsumed: false, frontDeadlockBlockedTicks: 0,
    };
    const revived = JSON.parse(JSON.stringify(snapshot)) as Phase15EntitySnapshot;
    expect(() => {
      validatePhase15EntitySnapshot(revived);
    }).not.toThrow();
    expect(revived).toEqual(snapshot);
  });

  it('separation keeps every center inside the field 0..10000', () => {
    const result = separateAllies([body('a', 2, 20), body('b', 8, 20), body('c', 9998, 20), body('d', 9992, 20)]);
    for (const b of result.bodies) {
      expect(b.x100).toBeGreaterThanOrEqual(0);
      expect(b.x100).toBeLessThanOrEqual(10000);
    }
  });

  it('anti-stuck fallback is one-time (no unbounded repath cascade)', () => {
    let state: StuckState = { noProgressTicks: 30, repathTicks: [10, 40], laneFallbackUsed: false };
    const first = updateStuck(state, 70, true, false);
    expect(first.requestLaneFallback).toBe(true);
    expect(first.state.laneFallbackUsed).toBe(true);
    state = { noProgressTicks: 30, repathTicks: [...first.state.repathTicks], laneFallbackUsed: true };
    const second = updateStuck(state, 160, true, false);
    expect(second.requestLaneFallback).toBe(false);
  });

  it('movement speed is conserved across 30 ticks for a representative range', () => {
    const move = (speed: number) => {
      let remainder = 0;
      let sum = 0;
      for (let i = 0; i < 30; i++) {
        const n = Math.floor((remainder + speed) / 30);
        remainder = (remainder + speed) % 30;
        sum += n;
      }
      return sum;
    };
    for (const speed of [0, 1, 7, 29, 30, 31, 60, 137, 999]) {
      expect(move(speed)).toBe(speed);
    }
  });
});
