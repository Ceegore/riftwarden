import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { RollSlotRegistry, RandomSession, RngStreamMap, parseRunSeed, uniformUint32Below, uniformIntInclusive, weightedChoiceIndex, shuffled, type RandomSession as RandomSessionType } from '../../src/game/sim/random/index';

const here = path.dirname(fileURLToPath(import.meta.url));
const cfg = JSON.parse(readFileSync(path.join(here, '..', '..', 'config', 'roll-slots.dev.json'), 'utf8')) as { slots: ConstructorParameters<typeof RollSlotRegistry>[0] };
const make = (): RandomSessionType => new RandomSession(RngStreamMap.fromRunSeed(parseRunSeed(['00000000', '00000001', '00000002', '00000003'])), new RollSlotRegistry(cfg.slots));

describe('uniformUint32Below', () => {
  it('deterministic across identical sessions', () => {
    for (const bound of [1, 2, 3, 10, 65537, 0x1_0000_0000]) {
      expect(uniformUint32Below(make(), 'fixture.uniform.primary', bound)).toBe(uniformUint32Below(make(), 'fixture.uniform.primary', bound));
    }
  });
  for (const bound of [0, -1, 1.5, 0x1_0000_0001]) {
    it(`rejects invalid bound ${String(bound)}`, () => {
      expect(() => uniformUint32Below(make(), 'fixture.uniform.primary', bound)).toThrow('P13_RANDOM_BOUND');
    });
  }
});

describe('uniformIntInclusive', () => {
  it('stays within the inclusive range', () => {
    const value = uniformIntInclusive(make(), 'fixture.uniform.primary', -5, 5);
    expect(value).toBeGreaterThanOrEqual(-5);
    expect(value).toBeLessThanOrEqual(5);
  });
});

describe('weightedChoiceIndex', () => {
  it('zero-weight entries never win', () => {
    const s = make();
    for (let i = 0; i < 100; i += 1) expect(weightedChoiceIndex(s, 'fixture.weighted.primary', [0, 5, 0, 7])).not.toBe(0);
  });
  it('all-zero and overflowing totals block', () => {
    expect(() => weightedChoiceIndex(make(), 'fixture.weighted.primary', [0, 0])).toThrow('P13_WEIGHT_TOTAL');
    expect(() => weightedChoiceIndex(make(), 'fixture.weighted.primary', [0x1_0000_0000, 1])).toThrow('P13_WEIGHT_TOTAL');
  });
});

describe('shuffled', () => {
  it('deterministic and immutable', () => {
    const input = Object.freeze([1, 2, 3, 4, 5]);
    const a = shuffled(make(), 'fixture.shuffle.primary', input);
    const b = shuffled(make(), 'fixture.shuffle.primary', input);
    expect(a).toEqual(b);
    expect(input).toEqual([1, 2, 3, 4, 5]);
  });
});
