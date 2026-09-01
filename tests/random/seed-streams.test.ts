import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseRunSeed, expandRunSeedV1, splitMix32Next, asUInt32, RngStreamMap, type UInt32 } from '../../src/game/sim/random/index';

const here = path.dirname(fileURLToPath(import.meta.url));
const vectors = JSON.parse(readFileSync(path.join(here, 'fixtures', 'reference-vectors.json'), 'utf8')) as {
  splitmix32: readonly { input: number; nextState: number; value: number }[];
  runSeed: { hex: readonly string[]; expandedState: readonly number[]; streamStates: Record<string, readonly number[]> };
};

describe('splitmix32', () => {
  it('reference vectors', () => {
    for (const v of vectors.splitmix32) {
      expect(splitMix32Next(asUInt32(v.input))).toEqual({ state: v.nextState, value: v.value });
    }
  });
});

describe('run seed', () => {
  it('strict format roundtrip', () => {
    expect(parseRunSeed(vectors.runSeed.hex)).toEqual(vectors.runSeed.hex);
  });
  for (const bad of [
    ['0', '00000001', '00000002', '00000003'],
    ['00000000', '00000001'],
    ['00000000', '00000001', '00000002', 'FFFFFFFF']
  ]) {
    it(`rejects malformed seed ${JSON.stringify(bad)}`, () => {
      expect(() => parseRunSeed(bad)).toThrow('P13_SEED_FORMAT');
    });
  }
  it('expansion vector', () => {
    expect(expandRunSeedV1(parseRunSeed(vectors.runSeed.hex))).toEqual(vectors.runSeed.expandedState);
  });
});

describe('stream map', () => {
  it('five stream states exact', () => {
    const map = RngStreamMap.fromRunSeed(parseRunSeed(vectors.runSeed.hex));
    expect(map.snapshotAll()).toEqual(vectors.runSeed.streamStates);
  });
  it('restore continues identically', () => {
    const original = RngStreamMap.fromRunSeed(parseRunSeed(vectors.runSeed.hex));
    original.require('map').nextUint32();
    const restored = RngStreamMap.restore(original.snapshotAll());
    expect(original.require('map').nextUint32()).toBe(restored.require('map').nextUint32());
  });
  it('cosmetic consumption cannot change authoritative snapshot', () => {
    const a = RngStreamMap.fromRunSeed(parseRunSeed(vectors.runSeed.hex));
    const b = RngStreamMap.fromRunSeed(parseRunSeed(vectors.runSeed.hex));
    for (let i = 0; i < 100; i += 1) b.require('combatCosmetic').nextUint32();
    expect(a.snapshotAuthoritative()).toEqual(b.snapshotAuthoritative());
    expect(a.snapshotAll()).not.toEqual(b.snapshotAll());
  });
});

describe('uint32', () => {
  it('rotl32 boundaries', () => {
    const r = asUInt32(0x80000000);
    // rotl32 by 1 of 0x80000000 is 0x00000001
    expect(rotl32(r, 1)).toBe(1);
  });
});

function rotl32(value: UInt32, shift: number): UInt32 {
  return (((value << shift) | (value >>> (32 - shift))) >>> 0) as UInt32;
}
