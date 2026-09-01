import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { milliValue, basisPoints, tick } from '../../src/game/rules/units';
import { roundDivHalfAwayFromZero } from '../../src/game/sim/math/rounding';
import { applyBasisPoints } from '../../src/game/sim/math/fixed-math';
import { mitigatedDamage, cappedTrueDamage } from '../../src/game/sim/math/combat-formulas';
import { secondsToTicks, controlDurationTicks } from '../../src/game/sim/math/time-and-speed';

const here = path.dirname(fileURLToPath(import.meta.url));
const vectors = JSON.parse(
  readFileSync(path.join(here, 'fixtures', 'crossruntime-vectors.json'), 'utf8'),
) as { schemaVersion: number; vectors: readonly { id: string; expected: number }[] };

const operations: Record<string, () => number> = {
  'round:p-half': () => roundDivHalfAwayFromZero(1, 2),
  'round:n-half': () => roundDivHalfAwayFromZero(-1, 2),
  'round:third': () => roundDivHalfAwayFromZero(2, 3),
  'bps:1250': () => applyBasisPoints(1000, basisPoints(1250)),
  'defense:-40': () => mitigatedDamage(milliValue(1000), -40),
  'defense:200': () => mitigatedDamage(milliValue(1000), 200),
  'true:boss-cap': () => cappedTrueDamage(milliValue(9999), milliValue(10000), basisPoints(1800)),
  'time:045': () => secondsToTicks('0.45', true).ticks,
  'time:065': () => secondsToTicks('0.65', true).ticks,
  'control:70': () => controlDurationTicks(tick(75), basisPoints(7000), true),
};

describe('cross-runtime vectors (Node execution)', () => {
  for (const v of vectors.vectors) {
    it(`vector ${v.id} matches the pinned expectation`, () => {
      const run = operations[v.id];
      if (!run) throw new Error(`no operation for vector ${v.id}`);
      expect(run()).toBe(v.expected);
    });
  }
});
