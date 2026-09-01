import type { Candidate } from './types.js';

export type InvalidReason = 'dead'|'removed'|'unreachable';

/** First invalid reason, in contract order; undefined when the candidate is valid. */
export function invalidReason(c: Candidate): InvalidReason|undefined {
  if (!c.alive) return 'dead';
  if (c.removed) return 'removed';
  if (!c.reachable) return 'unreachable';
  return undefined;
}

/** Filters to valid candidates and returns them in stable id order. */
export function queryValidCandidates(input: readonly Candidate[]): Candidate[] {
  return input.filter((c) => invalidReason(c) === undefined).slice().sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}
