import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Xoshiro128StarStar, asUInt32, type XoshiroState } from '../../src/game/sim/random/index';

const here = path.dirname(fileURLToPath(import.meta.url));
const vectors = JSON.parse(readFileSync(path.join(here, 'fixtures', 'reference-vectors.json'), 'utf8')) as {
  xoshiro: { initialState: number[]; first16: number[]; stateAfter16: number[]; jumpStateFromInitial: number[]; longJumpStateFromInitial: number[] };
  millionDrawLittleEndianSha256: string;
};
const state = (values: readonly number[]): XoshiroState => values.map(asUInt32) as unknown as XoshiroState;

describe('xoshiro128**', () => {
  it('official transition vector first 16', () => {
    const rng = new Xoshiro128StarStar(state(vectors.xoshiro.initialState));
    expect(Array.from({ length: 16 }, () => rng.nextUint32())).toEqual(vectors.xoshiro.first16);
    expect(rng.snapshot()).toEqual(vectors.xoshiro.stateAfter16);
  });
  it('clone independent and restore exact', () => {
    const a = new Xoshiro128StarStar(state([1, 2, 3, 4]));
    const b = a.clone();
    expect(a.nextUint32()).toBe(b.nextUint32());
    a.nextUint32();
    expect(a.snapshot()).not.toEqual(b.snapshot());
  });
  it('all-zero state blocks', () => {
    expect(() => new Xoshiro128StarStar(state([0, 0, 0, 0]))).toThrow('P13_PRNG_ALL_ZERO');
  });
  it('jump vectors exact', () => {
    const a = new Xoshiro128StarStar(state(vectors.xoshiro.initialState));
    a.jump();
    expect(a.snapshot()).toEqual(vectors.xoshiro.jumpStateFromInitial);
    const b = new Xoshiro128StarStar(state(vectors.xoshiro.initialState));
    b.longJump();
    expect(b.snapshot()).toEqual(vectors.xoshiro.longJumpStateFromInitial);
  });
  it('one million draw hash matches the pinned digest', () => {
    const rng = new Xoshiro128StarStar(state([1, 2, 3, 4]));
    const h = createHash('sha256');
    const bytes = Buffer.allocUnsafe(4);
    for (let i = 0; i < 1_000_000; i += 1) {
      bytes.writeUInt32LE(rng.nextUint32());
      h.update(bytes);
    }
    expect(h.digest('hex')).toBe(vectors.millionDrawLittleEndianSha256);
  });
});
