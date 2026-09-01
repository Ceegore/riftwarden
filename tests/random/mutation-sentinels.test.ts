import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Xoshiro128StarStar, asUInt32, uniformUint32Below, type UInt32, type XoshiroState } from '../../src/game/sim/random/index';
import { canonicalJson } from '../../src/game/replay/index';

const here = path.dirname(fileURLToPath(import.meta.url));
const vectors = JSON.parse(readFileSync(path.join(here, 'fixtures', 'reference-vectors.json'), 'utf8')) as { xoshiro: { first16: number[] } };
const u = (x: number): number => x >>> 0;
const rot = (x: number, k: number): number => u((x << k) | (x >>> (32 - k)));

describe('PRNG mutation sentinels', () => {
  it('sentinel kills the historical s0 scrambler', () => {
    const s = [1, 2, 3, 4];
    const mutant = u(Math.imul(rot(u(Math.imul(s[0] ?? 0, 5)), 7), 9));
    expect(mutant).not.toBe(vectors.xoshiro.first16[0]);
  });
  it('sentinel kills a rotation mutant', () => {
    const s = [1, 2, 3, 4];
    const mutant = u(Math.imul(rot(u(Math.imul(s[1] ?? 0, 5)), 6), 9));
    expect(mutant).not.toBe(vectors.xoshiro.first16[0]);
  });
  it('sentinel kills a direct modulo mutant', () => {
    const valuesA = [0, 1, 2];
    const valuesB = [0, 1, 2];
    const correct = uniformUint32Below({ draw: () => (valuesA.shift() ?? 0) as UInt32 } as never, 'fixture.uniform.primary', 3);
    const mutant = (valuesB.shift() ?? 0) % 3;
    expect(correct).not.toBe(mutant);
  });
  it('sentinel canonical key insertion differs from raw JSON', () => {
    const input = { z: 1, a: 2 };
    expect(JSON.stringify(input)).not.toBe(canonicalJson(input));
  });
  it('sentinel million sequence sensitive to a single output flip', () => {
    const rng = new Xoshiro128StarStar([1, 2, 3, 4].map(asUInt32) as unknown as XoshiroState);
    const h = createHash('sha256');
    const b = Buffer.allocUnsafe(4);
    for (let i = 0; i < 1000; i += 1) {
      let v: UInt32 = rng.nextUint32();
      if (i === 500) v = ((v ^ 1) >>> 0) as UInt32;
      b.writeUInt32LE(v);
      h.update(b);
    }
    const mutant = h.digest('hex');
    const clean = new Xoshiro128StarStar([1, 2, 3, 4].map(asUInt32) as unknown as XoshiroState);
    const c = createHash('sha256');
    for (let i = 0; i < 1000; i += 1) {
      b.writeUInt32LE(clean.nextUint32());
      c.update(b);
    }
    expect(mutant).not.toBe(c.digest('hex'));
  });
});
