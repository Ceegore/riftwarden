import { describe, expect, it } from 'vitest';
import {
  bossResistanceBps,
  confusionResolution,
  effectiveControlDurationTicks,
  resolveAntiPermalock,
} from '../../src/game/sim/status/control-resolver.js';

describe('P18 T04 control resolver (§8)', () => {
  it('exposes the §8.2 boss resistance tiers', () => {
    expect(bossResistanceBps('normal')).toBe(7000);
    expect(bossResistanceBps('ascended')).toBe(8000);
    expect(bossResistanceBps('heart')).toBe(8500);
  });

  it('leaves control on regular targets unmodified', () => {
    const result = effectiveControlDurationTicks('stun', 100, 'regular');
    expect(result.effectiveTicks).toBe(100);
    expect(result.resistanceBps).toBe(0);
    expect(result.hardControlBossCapApplied).toBe(false);
  });

  it('applies tier resistance to soft control against bosses without the hard cap', () => {
    // 100 * (10000-7000)/10000 = 30.
    expect(effectiveControlDurationTicks('slow', 100, 'normal').effectiveTicks).toBe(30);
    expect(effectiveControlDurationTicks('slow', 100, 'normal').hardControlBossCapApplied).toBe(false);
  });

  it('applies tier resistance and the 0.65s cap to hard control against bosses', () => {
    // reduced to 30, capped at 20 ticks (0.65s @ 30 TPS).
    const stunNormal = effectiveControlDurationTicks('stun', 100, 'normal');
    expect(stunNormal.effectiveTicks).toBe(20);
    expect(stunNormal.hardControlBossCapApplied).toBe(true);

    // A short base duration stays below the cap.
    expect(effectiveControlDurationTicks('stun', 10, 'normal').effectiveTicks).toBe(3);

    // ascended 80% → 20; heart 85% → 15.
    expect(effectiveControlDurationTicks('stun', 100, 'ascended').effectiveTicks).toBe(20);
    expect(effectiveControlDurationTicks('stun', 100, 'heart').effectiveTicks).toBe(15);
  });

  it('rejects non-control kinds and invalid base ticks', () => {
    expect(() => effectiveControlDurationTicks('burn', 100, 'regular')).toThrow();
    expect(() => effectiveControlDurationTicks('stun', -1, 'regular')).toThrow();
    expect(() => effectiveControlDurationTicks('stun', 1.5, 'regular')).toThrow();
  });

  it('converts confusion against bosses, never friendly fire', () => {
    expect(confusionResolution('confusion', true)).toBe('converted_to_interrupt');
    expect(confusionResolution('confusion', false)).toBe('applied');
    expect(confusionResolution('stun', true)).toBe('applied');
  });

  it('blocks hard control without a content diminishing rule (§8.4)', () => {
    expect(resolveAntiPermalock(true)).toBe('ok');
    expect(resolveAntiPermalock(false)).toBe('BLOCKED_CONTENT_POLICY');
  });
});
