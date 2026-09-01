import { describe, expect, it } from 'vitest';
import {
  cleanseCategoryOf,
  selectCleanseTarget,
  selectDispelTarget,
  shieldDispelCap,
} from '../../src/game/sim/status/cleanse-dispel.js';
import type { StatusInstance, StatusKind, StatusPolarity } from '../../src/game/sim/status/status-instance.js';

let seq = 0;
function status(kind: StatusKind, overrides: Partial<StatusInstance> = {}): StatusInstance {
  seq += 1;
  const polarity: StatusPolarity =
    kind === 'stun' || kind === 'silence' || kind === 'confusion' || kind === 'slow' ? 'control'
    : kind === 'regeneration' || kind === 'attack_up' ? 'positive'
    : 'negative';
  return Object.freeze({
    statusId: `st_${String(seq)}`,
    kind,
    polarity,
    targetId: 'unit_target',
    sourceId: 'unit_source',
    effectId: 'effect_x',
    startTick: 10,
    endTick: 40,
    strength: 100,
    stackGroup: 'group',
    sequence: seq,
    stackPolicy: 'replace_if_stronger',
    maxStacks: 1,
    flags: Object.freeze([]),
    ...overrides,
  });
}

describe('P18 T05 cleanse/dispel (§9)', () => {
  it('maps kinds to the §9.1 cleanse categories', () => {
    expect(cleanseCategoryOf('stun')).toBe('hard_control');
    expect(cleanseCategoryOf('silence')).toBe('hard_control');
    expect(cleanseCategoryOf('confusion')).toBe('hard_control');
    expect(cleanseCategoryOf('weaken')).toBe('weaken');
    expect(cleanseCategoryOf('poison')).toBe('poison_burn');
    expect(cleanseCategoryOf('burn')).toBe('poison_burn');
    expect(cleanseCategoryOf('slow')).toBe('slow');
    expect(cleanseCategoryOf('mark')).toBe('mark');
    expect(cleanseCategoryOf('attack_up')).toBeNull();
  });

  it('caps shield dispel at 35% of target max HP', () => {
    expect(shieldDispelCap(1000)).toBe(350);
    expect(shieldDispelCap(101)).toBe(35); // round-half-away-from-zero
  });

  it('cleanse picks hard control first, then strongest/longest/id within a category', () => {
    const hard = status('stun', { strength: 10 });
    const weaken = status('weaken', { strength: 500 });
    expect(selectCleanseTarget([weaken, hard], 20)?.kind).toBe('stun');

    const strongBurn = status('burn', { strength: 300 });
    const weakPoison = status('poison', { strength: 50 });
    expect(selectCleanseTarget([weakPoison, strongBurn], 20)?.kind).toBe('burn');

    const shortBurn = status('burn', { strength: 100, endTick: 30, statusId: 'st_short' });
    const longBurn = status('burn', { strength: 100, endTick: 80, statusId: 'st_long' });
    expect(selectCleanseTarget([shortBurn, longBurn], 20)?.statusId).toBe('st_long');
  });

  it('cleanse skips unremovable and returns undefined when nothing is cleansable', () => {
    const unremovable = status('stun', { flags: Object.freeze(['unremovable'] as const) });
    expect(selectCleanseTarget([unremovable], 20)).toBeUndefined();
    expect(selectCleanseTarget([status('regeneration'), status('attack_up')], 20)).toBeUndefined();
  });

  it('dispel picks positive by strength, remaining duration, then statusId', () => {
    const weak = status('attack_up', { strength: 10, statusId: 'st_weak' });
    const strong = status('regeneration', { strength: 500, statusId: 'st_strong' });
    expect(selectDispelTarget([weak, strong], 20)?.statusId).toBe('st_strong');

    const short = status('attack_up', { strength: 100, endTick: 30, statusId: 'st_short' });
    const long = status('attack_up', { strength: 100, endTick: 90, statusId: 'st_long' });
    expect(selectDispelTarget([short, long], 20)?.statusId).toBe('st_long');
  });

  it('dispel ignores negative/control and unremovable instances', () => {
    expect(selectDispelTarget([status('stun'), status('burn')], 20)).toBeUndefined();
    expect(selectDispelTarget([status('attack_up', { flags: Object.freeze(['unremovable'] as const) })], 20)).toBeUndefined();
  });
});
