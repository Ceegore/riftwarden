import { describe, it, expect } from 'vitest';
import { GLOBAL_NO_PROGRESS_RESOLVE_TICKS, GLOBAL_NO_PROGRESS_WARNING_TICKS, updateGlobalProgress, updateStuck, type GlobalProgress, type StuckState } from '../../src/game/sim/anti-stuck/anti-stuck.js';
import { DEADLOCK_MELEE_BONUS_X100, selectDeadlockBuffTarget, updateFrontDeadlock, type FrontDeadlockState } from '../../src/game/sim/anti-stuck/deadlock.js';
import { placeConstruct } from '../../src/game/sim/spawn/construct-placement.js';
import { baseBehindFront, resolveSpawn, spawnCandidates } from '../../src/game/sim/spawn/spawn-resolver.js';
import { validatePhase15BattleSnapshot, validatePhase15EntitySnapshot, type Phase15BattleSnapshot, type Phase15EntitySnapshot } from '../../src/game/sim/snapshot/phase15-projection.js';
import { asFieldX100, asX100 } from '../../src/game/sim/geometry/x100.js';
import { KernelInvariantError } from '../../src/game/sim/core/invariant-error.js';

describe('spawn candidates', () => {
  it('emits base then backoffs 50..400 within the field', () => {
    expect(spawnCandidates(asX100(1000), 1)).toEqual([1000, 1050, 1100, 1150, 1200, 1250, 1300, 1350, 1400].map(asFieldX100));
  });

  it('resolves the first valid candidate and rejects atomically', () => {
    const ok = resolveSpawn({ reservedId: 'sp1', baseX100: asX100(1000), backwardDirection: 1, valid: (x) => x === 1050 });
    expect(ok).toEqual({ reservedId: 'sp1', positionX100: 1050, rejected: false });
    const bad = resolveSpawn({ reservedId: 'sp1', baseX100: asX100(1000), backwardDirection: 1, valid: () => false });
    expect(bad).toEqual({ reservedId: 'sp1', positionX100: null, rejected: true });
  });

  it('places the base 100 behind the foremost ally', () => {
    expect(baseBehindFront(asX100(5000), 1)).toBe(4900);
    expect(baseBehindFront(asX100(5000), -1)).toBe(5100);
  });
});

describe('construct placement', () => {
  it('replaces only under an explicit replacement policy', () => {
    expect(placeConstruct({ slotId: 's1', x100: asX100(100), occupiedBy: null }, null).placed).toBe(true);
    expect(placeConstruct({ slotId: 's1', x100: asX100(100), occupiedBy: 'other' }, null).reasonCode).toBe('P15_CONSTRUCT_SLOT_OCCUPIED');
    expect(placeConstruct({ slotId: 's1', x100: asX100(100), occupiedBy: 'other' }, 'replace').placed).toBe(true);
  });
});

describe('entity anti-stuck', () => {
  it('emits a repath only at the 30th blocked tick', () => {
    let state: StuckState = { noProgressTicks: 0, repathTicks: [], laneFallbackUsed: false };
    for (let t = 0; t < 29; t++) state = updateStuck(state, t, true, false).state;
    expect(updateStuck(state, 29, true, false).emitRepath).toBe(true);
  });

  it('requests a lane fallback after three repaths in 120 ticks', () => {
    const state: StuckState = { noProgressTicks: 30, repathTicks: [10, 40], laneFallbackUsed: false };
    const r = updateStuck(state, 70, true, false);
    expect(r.emitRepath).toBe(true);
    expect(r.requestLaneFallback).toBe(true);
    expect(r.state.laneFallbackUsed).toBe(true);
  });

  it('resets the counter on progress', () => {
    const state: StuckState = { noProgressTicks: 29, repathTicks: [10], laneFallbackUsed: false };
    expect(updateStuck(state, 40, true, true).state.noProgressTicks).toBe(0);
  });
});

describe('front deadlock', () => {
  it('grants the melee buff at the 60th blocked tick', () => {
    const state: FrontDeadlockState = { blockedTicks: 59, buffedEntityId: null, buffConsumed: false };
    const r = updateFrontDeadlock(state, true, false, [{ entityId: 'e1', lane: 'middle', edgeDistanceX100: 5 }]);
    expect(r.grantMeleeBuff).toBe(true);
    expect(r.buffEntityId).toBe('e1');
  });

  it('selects the nearest entity by edge distance, then lane, then id', () => {
    const pick = selectDeadlockBuffTarget([
      { entityId: 'far', lane: 'top', edgeDistanceX100: 50 },
      { entityId: 'near', lane: 'middle', edgeDistanceX100: 5 },
      { entityId: 'near2', lane: 'middle', edgeDistanceX100: 5 },
    ]);
    expect(pick).toBe('near');
  });

  it('exposes the +50 melee range bonus constant', () => {
    expect(DEADLOCK_MELEE_BONUS_X100).toBe(50);
  });
});

describe('global no-progress endcap', () => {
  it('warns at 300 and requests the end resolution 300 ticks later', () => {
    let state: GlobalProgress = { noProgressTicks: 0, collapseTicks: 0, warned: false };
    for (let i = 0; i < GLOBAL_NO_PROGRESS_WARNING_TICKS - 1; i++) state = updateGlobalProgress(state, false).state;
    const warn = updateGlobalProgress(state, false);
    expect(warn.warning).toBe(true);
    let s = warn.state;
    for (let i = 0; i < GLOBAL_NO_PROGRESS_RESOLVE_TICKS - 1; i++) s = updateGlobalProgress(s, false).state;
    expect(updateGlobalProgress(s, false).endRequest).toBe(true);
  });

  it('resets both counters on qualifying progress', () => {
    const r = updateGlobalProgress({ noProgressTicks: 200, collapseTicks: 100, warned: true }, true);
    expect(r.state).toEqual({ noProgressTicks: 0, collapseTicks: 0, warned: false });
  });
});

describe('phase15 snapshot validation', () => {
  const validEntity: Phase15EntitySnapshot = {
    id: 'e1', x100: asFieldX100(500), radiusX100: asX100(20), lane: 'middle', movementRemainder: 0,
    laneChange: null, normalLaneChangeCooldownUntilTick: 0, overtakeGrant: null,
    noProgressTicks: 0, repathTicks: [], laneFallbackUsed: false, deadlockBuffConsumed: false, frontDeadlockBlockedTicks: 0,
  };

  it('accepts a valid entity snapshot', () => {
    expect(() => {
      validatePhase15EntitySnapshot(validEntity);
    }).not.toThrow();
  });

  it('rejects out-of-field x100 and invalid remainder', () => {
    expect(() => {
      validatePhase15EntitySnapshot({ ...validEntity, x100: asX100(10001) });
    }).toThrow(KernelInvariantError);
    expect(() => {
      validatePhase15EntitySnapshot({ ...validEntity, movementRemainder: 30 });
    }).toThrow(KernelInvariantError);
  });

  it('rejects invalid global counters', () => {
    const bad: Phase15BattleSnapshot = { globalNoProgressTicks: -1, riftCollapseTicks: 0, riftCollapseWarningEmitted: false };
    expect(() => {
      validatePhase15BattleSnapshot(bad);
    }).toThrow(KernelInvariantError);
  });
});
