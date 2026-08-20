import { compareCodeUnit } from '../expedition/stable.js';
import { SliceError } from './slice-error.js';
import type { HashSample, Quality } from './types.js';

/**
 * Hash matrix validation (RELIABILITY_GOLDEN_CONTRACT): canonical seeds run
 * across every speed multiplier and quality level must end on identical
 * hashes — presentation speed and quality never change the simulation result.
 * Divergences are reported with seed, speed and quality; nothing is repaired.
 */
export const QUALITIES: readonly Quality[] = ['LOW', 'REDUCED', 'STANDARD', 'HIGH'];
const QUALITY_SET: ReadonlySet<string> = new Set(QUALITIES);

export const SPEED_MULTIPLIERS_X10: readonly number[] = [5, 10, 20, 30];

export interface HashDivergence {
  readonly seed: string;
  readonly speedX10: number;
  readonly quality: Quality;
  readonly expected: string;
  readonly actual: string;
}

export function isQuality(value: unknown): value is Quality {
  return typeof value === 'string' && QUALITY_SET.has(value);
}

export function assertQuality(value: unknown): asserts value is Quality {
  if (!isQuality(value)) {
    throw new SliceError('UNKNOWN_QUALITY', { quality: value });
  }
}

export function validateHashMatrix(samples: readonly HashSample[]): readonly HashDivergence[] {
  const bySeed = new Map<string, string>();
  const divergences: HashDivergence[] = [];
  for (const sample of samples) {
    const prior = bySeed.get(sample.seed);
    if (prior === undefined) {
      bySeed.set(sample.seed, sample.endHash);
    } else if (prior !== sample.endHash) {
      divergences.push({ seed: sample.seed, speedX10: sample.speedX10, quality: sample.quality, expected: prior, actual: sample.endHash });
    }
  }
  return divergences.sort((a, b) => compareCodeUnit(a.seed, b.seed));
}

/** Expects every (seed x speed x quality) combination to be present exactly once. */
export function expectedSampleCount(seedCount: number): number {
  return seedCount * SPEED_MULTIPLIERS_X10.length * QUALITIES.length;
}
