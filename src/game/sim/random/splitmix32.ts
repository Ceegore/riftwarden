import { u32, type UInt32 } from './uint32.js';
import type { RunSeed } from './run-seed.js';
import { runSeedWords } from './run-seed.js';
import { RandomInvariantError } from './invariant-error.js';

const GOLDEN_GAMMA = 0x9e37_79b9;

export function splitMix32Next(state: UInt32): Readonly<{ state: UInt32; value: UInt32 }> {
  const nextState = u32(state + GOLDEN_GAMMA);
  let z = nextState;
  z = u32(Math.imul(z ^ (z >>> 16), 0x21f0_aaad));
  z = u32(Math.imul(z ^ (z >>> 15), 0x735a_2d97));
  return Object.freeze({ state: nextState, value: u32(z ^ (z >>> 15)) });
}

export function expandRunSeedV1(seed: RunSeed): readonly [UInt32, UInt32, UInt32, UInt32] {
  const words = runSeedWords(seed);
  const output = words.map((word, index) => splitMix32Next(u32(word + Math.imul(index + 1, GOLDEN_GAMMA))).value) as unknown as readonly [UInt32, UInt32, UInt32, UInt32];
  if (output.every((word) => word === 0)) throw new RandomInvariantError('P13_PRNG_ALL_ZERO');
  return Object.freeze([...output]) as unknown as readonly [UInt32, UInt32, UInt32, UInt32];
}
