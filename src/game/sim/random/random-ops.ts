import { RandomInvariantError } from './invariant-error.js';
import type { RandomSession } from './random-session.js';
import { UINT32_SIZE } from './uint32.js';

const MAX_REJECTIONS = 128;

export function uniformUint32Below(session: RandomSession, slot: string, boundExclusive: number): number {
  if (!Number.isInteger(boundExclusive) || boundExclusive <= 0 || boundExclusive > UINT32_SIZE) throw new RandomInvariantError('P13_RANDOM_BOUND', { boundExclusive });
  if (boundExclusive === UINT32_SIZE) return session.draw(slot);
  const threshold = UINT32_SIZE % boundExclusive;
  for (let attempt = 0; attempt < MAX_REJECTIONS; attempt += 1) {
    const value = session.draw(slot);
    if (value >= threshold) return value % boundExclusive;
  }
  throw new RandomInvariantError('P13_RANDOM_REJECTION_CAP', { slot, boundExclusive });
}

export function uniformIntExclusive(session: RandomSession, slot: string, minInclusive: number, maxExclusive: number): number {
  if (!Number.isSafeInteger(minInclusive) || !Number.isSafeInteger(maxExclusive) || maxExclusive <= minInclusive) throw new RandomInvariantError('P13_RANDOM_BOUND');
  const span = maxExclusive - minInclusive;
  if (span > UINT32_SIZE) throw new RandomInvariantError('P13_RANDOM_BOUND', { span });
  return minInclusive + uniformUint32Below(session, slot, span);
}

export function uniformIntInclusive(session: RandomSession, slot: string, minInclusive: number, maxInclusive: number): number {
  if (!Number.isSafeInteger(maxInclusive) || maxInclusive === Number.MAX_SAFE_INTEGER) throw new RandomInvariantError('P13_RANDOM_BOUND');
  return uniformIntExclusive(session, slot, minInclusive, maxInclusive + 1);
}

export function weightedChoiceIndex(session: RandomSession, slot: string, weights: readonly number[]): number {
  if (weights.length === 0 || weights.some((weight) => !Number.isSafeInteger(weight) || weight < 0)) throw new RandomInvariantError('P13_WEIGHT_TOTAL');
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  if (!Number.isSafeInteger(total) || total <= 0 || total > UINT32_SIZE) throw new RandomInvariantError('P13_WEIGHT_TOTAL', { total });
  const roll = uniformUint32Below(session, slot, total);
  let cursor = 0;
  for (let index = 0; index < weights.length; index += 1) { cursor += weights[index] ?? 0; if (roll < cursor) return index; }
  throw new RandomInvariantError('P13_WEIGHT_TOTAL');
}

export function shuffled<T>(session: RandomSession, slotFamily: string, input: readonly T[]): readonly T[] {
  const output = [...input];
  for (let index = output.length - 1; index > 0; index -= 1) {
    const swapIndex = uniformUint32Below(session, slotFamily, index + 1);
    [output[index], output[swapIndex]] = [output[swapIndex] as T, output[index] as T];
  }
  return Object.freeze(output);
}
