import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { RollSlotRegistry, RandomSession, RngStreamMap, parseRunSeed, uniformUint32Below, uniformIntExclusive, weightedChoiceIndex, shuffled } from '../../src/game/sim/random/index';

const here = path.dirname(fileURLToPath(import.meta.url));
const cfg = JSON.parse(readFileSync(path.join(here, '..', '..', 'config', 'roll-slots.dev.json'), 'utf8')) as { slots: ConstructorParameters<typeof RollSlotRegistry>[0] };
const seed = parseRunSeed(['abcdef01', '23456789', 'deadbeef', '01020304']);
const make = (): RandomSession => new RandomSession(RngStreamMap.fromRunSeed(seed), new RollSlotRegistry(cfg.slots));

describe('random properties', () => {
  it('2000 deterministic bounded draws', () => {
    const a = make();
    const b = make();
    for (let i = 1; i <= 2000; i += 1) {
      const bound = ((i * 7919) % 100000) + 1;
      const av = uniformUint32Below(a, 'fixture.uniform.primary', bound);
      const bv = uniformUint32Below(b, 'fixture.uniform.primary', bound);
      expect(av).toBe(bv);
      expect(av).toBeGreaterThanOrEqual(0);
      expect(av).toBeLessThan(bound);
    }
  });
  it('1000 signed exclusive range draws stay in range', () => {
    const s = make();
    for (let i = 0; i < 1000; i += 1) {
      const min = -5000 + i;
      const max = min + 1 + (i % 997);
      const v = uniformIntExclusive(s, 'fixture.uniform.primary', min, max);
      expect(v).toBeGreaterThanOrEqual(min);
      expect(v).toBeLessThan(max);
    }
  });
  it('single positive weight always wins', () => {
    const s = make();
    for (let index = 0; index < 20; index += 1) {
      const weights = Array(20).fill(0);
      weights[index] = 1;
      for (let n = 0; n < 20; n += 1) expect(weightedChoiceIndex(s, 'fixture.weighted.primary', weights)).toBe(index);
    }
  });
  it('shuffle preserves content for sizes 0 through 128', () => {
    for (let size = 0; size <= 128; size += 1) {
      const input = Array.from({ length: size }, (_, i) => i);
      const out = shuffled(make(), 'fixture.shuffle.primary', input);
      expect(out.length).toBe(size);
      expect([...out].sort((a, b) => a - b)).toEqual(input);
      expect(input).toEqual(Array.from({ length: size }, (_, i) => i));
    }
  });
  it('scripted rejection consumes the discarded draw', () => {
    const values = [0, 1, 2, 3];
    const fake = { draw: () => values.shift() ?? 0 };
    expect(uniformUint32Below(fake as never, 'fixture.uniform.primary', 3)).toBe(1);
    expect(values.length).toBe(2);
  });
  it('rejection safety cap is visible', () => {
    const fake = { draw: () => 0 };
    expect(() => uniformUint32Below(fake as never, 'fixture.uniform.primary', 3)).toThrow('P13_RANDOM_REJECTION_CAP');
  });
});
