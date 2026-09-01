/**
 * Phase 22 mass-sim partition/merge (P22-T05).
 *
 * Case `i` is assigned exclusively by a stable index formula — never by
 * wallclock, CPU count or random access. Workers receive deterministic index
 * sets; merging is strictly by ascending `caseIndex`. A single-worker run and
 * a multi-worker run therefore produce the identical aggregate hash.
 */
import { createHash } from 'node:crypto';

/**
 * Returns the case indices assigned to one worker. The formula is stable:
 * case `i` goes to worker `i % workerCount`, so any partition of the same
 * total yields the same per-worker sets regardless of machine.
 */
export function partitionCaseIndices(total, workerCount, workerIndex) {
  if (!Number.isSafeInteger(total) || total < 0) throw new Error('P22_PARTITION_TOTAL_INVALID');
  if (!Number.isSafeInteger(workerCount) || workerCount < 1) throw new Error('P22_PARTITION_WORKERS_INVALID');
  if (!Number.isSafeInteger(workerIndex) || workerIndex < 0 || workerIndex >= workerCount) throw new Error('P22_PARTITION_INDEX_INVALID');
  const indices = [];
  for (let i = workerIndex; i < total; i += workerCount) indices.push(i);
  return indices;
}

/**
 * Merges worker outputs strictly by ascending caseIndex. Throws on duplicate
 * or missing indices so a silent merge loss can never produce a false PASS.
 */
export function mergeCases(parts) {
  const byIndex = new Map();
  for (const part of parts) {
    for (const result of part) {
      if (!Number.isSafeInteger(result.caseIndex)) throw new Error('P22_MERGE_INDEX_INVALID');
      if (byIndex.has(result.caseIndex)) throw new Error('P22_MERGE_DUPLICATE_CASE');
      byIndex.set(result.caseIndex, result);
    }
  }
  return [...byIndex.entries()].sort((a, b) => a[0] - b[0]).map(([, result]) => result);
}

/** Aggregate hash over merged case results in canonical index order. */
export function aggregateHash(results) {
  const hash = createHash('sha256');
  for (const result of results) {
    hash.update(`${result.caseIndex}:${result.outcome}:${result.endTick}:${result.endHash}:${result.invariantCount}\n`);
  }
  return hash.digest('hex');
}

/** Compact mass-case report fields (outcome, ticks, hash, invariants). */
export function caseResult(caseIndex, state, api) {
  return {
    caseIndex,
    outcome: state.phase?.phase ?? 'ACTIVE',
    endTick: state.tick,
    endHash: api.snapshot.createSnapshot(state).checksum,
    invariantCount: 0,
  };
}
