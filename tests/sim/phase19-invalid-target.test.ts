import { describe, expect, it } from 'vitest';
import { KernelInvariantError } from '../../src/game/sim/core/invariant-error.js';
import {
  isDamageOrStatusMeaningful,
  isHealMeaningful,
  isShieldMeaningful,
  resolveInvalidTarget,
  shouldConsumeOnceMarker,
  type InvalidTargetContext,
} from '../../src/game/sim/ability/invalid-target-policy.js';

function ctx(overrides: Partial<InvalidTargetContext> = {}): InvalidTargetContext {
  return { tick: 10, policy: 'wait', retargetedThisTick: false, consumeAuthorized: false, ...overrides };
}

describe('P19-T05 invalid-target policy — resolution', () => {
  it('wait consumes nothing', () => {
    expect(resolveInvalidTarget('wait', ctx())).toEqual({ action: 'wait', consumeUses: false });
  });

  it('retarget_once_then_wait retargets exactly once then waits', () => {
    expect(resolveInvalidTarget('retarget_once_then_wait', ctx())).toEqual({ action: 'retarget', consumeUses: false });
    expect(resolveInvalidTarget('retarget_once_then_wait', ctx({ retargetedThisTick: true }))).toEqual({ action: 'wait', consumeUses: false });
  });

  it('consume_without_effect requires explicit authorization', () => {
    expect(() => {
      resolveInvalidTarget('consume_without_effect', ctx());
    }).toThrow(KernelInvariantError);
    expect(resolveInvalidTarget('consume_without_effect', ctx({ consumeAuthorized: true }))).toEqual({ action: 'consume_without_effect', consumeUses: true });
  });

  it('rejects unknown policies and bad ticks', () => {
    expect(() => {
      resolveInvalidTarget('nope' as never, ctx());
    }).toThrow(KernelInvariantError);
    expect(() => {
      resolveInvalidTarget('wait', ctx({ tick: -1 }));
    }).toThrow(KernelInvariantError);
  });
});

describe('P19-T05 meaningful-use defaults', () => {
  it('heal is meaningful from ≥12% missing max LP (boundary minus/equal/plus)', () => {
    // max 1000: 12% = 120. Missing 119 → not meaningful; 120 → meaningful.
    expect(isHealMeaningful(1000, 881)).toBe(false); // missing 119
    expect(isHealMeaningful(1000, 880)).toBe(true); // missing 120
    expect(isHealMeaningful(1000, 500)).toBe(true); // missing 500
  });

  it('shield is meaningful while below the defined threshold', () => {
    expect(isShieldMeaningful(0, 100)).toBe(true);
    expect(isShieldMeaningful(99, 100)).toBe(true);
    expect(isShieldMeaningful(100, 100)).toBe(false); // threshold reached
  });

  it('damage/status needs a valid target or an authorized ground snapshot', () => {
    expect(isDamageOrStatusMeaningful(true, false)).toBe(true);
    expect(isDamageOrStatusMeaningful(false, true)).toBe(true);
    expect(isDamageOrStatusMeaningful(false, false)).toBe(false);
  });

  it('once marker is consumed only when the effect committed', () => {
    expect(shouldConsumeOnceMarker(true)).toBe(true);
    expect(shouldConsumeOnceMarker(false)).toBe(false);
  });

  it('rejects invalid LP and threshold values', () => {
    expect(() => {
      isHealMeaningful(1000, 1200);
    }).toThrow(KernelInvariantError);
    expect(() => {
      isHealMeaningful(1000, 500, -1);
    }).toThrow(KernelInvariantError);
  });
});
