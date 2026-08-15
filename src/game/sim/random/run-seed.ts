import { RandomInvariantError } from './invariant-error.js';
import { asUInt32, hexUInt32, type UInt32 } from './uint32.js';

export type HexUInt32 = string & { readonly __brand: 'HexUInt32' };
export type RunSeed = readonly [HexUInt32, HexUInt32, HexUInt32, HexUInt32];
const HEX_WORD = /^[0-9a-f]{8}$/;

export function parseRunSeed(value: unknown): RunSeed {
  if (!Array.isArray(value) || value.length !== 4) throw new RandomInvariantError('P13_SEED_FORMAT');
  const words = value as unknown[];
  if (words.some((word) => typeof word !== 'string' || !HEX_WORD.test(word))) throw new RandomInvariantError('P13_SEED_FORMAT');
  return Object.freeze([...words as string[]]) as unknown as RunSeed;
}

export function runSeedWords(seed: RunSeed): readonly [UInt32, UInt32, UInt32, UInt32] {
  return seed.map((word) => asUInt32(Number.parseInt(word, 16))) as unknown as readonly [UInt32, UInt32, UInt32, UInt32];
}

export function runSeedFromWords(words: readonly [UInt32, UInt32, UInt32, UInt32]): RunSeed {
  return Object.freeze(words.map(hexUInt32)) as unknown as RunSeed;
}
