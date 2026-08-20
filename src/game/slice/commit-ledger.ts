import { SliceError } from './slice-error.js';
import type { CommitKind, CommitLedger, Route } from './types.js';

/**
 * Commit ledger (RELIABILITY_GOLDEN_CONTRACT + E2E_FLOW_CONTRACT): battle,
 * result and reward commits are exactly-once — a repeated commit of the same
 * kind returns the prior receipt (the unchanged ledger); a different kind
 * under the same id is a hard conflict. Process kill resumes from the ledger,
 * which guarantees exactly one reward per run.
 */
export function emptyLedger(): CommitLedger {
  return { committed: {} };
}

export function commitOnce(ledger: CommitLedger, id: string, kind: CommitKind): CommitLedger {
  const prior = ledger.committed[id];
  if (prior !== undefined) {
    if (prior !== kind) {
      throw new SliceError('COMMIT_KIND_CONFLICT', { id, prior, kind });
    }
    return ledger;
  }
  return { committed: { ...ledger.committed, [id]: kind } };
}

export function hasCommitted(ledger: CommitLedger, id: string): boolean {
  return ledger.committed[id] !== undefined;
}

export function kindOf(ledger: CommitLedger, id: string): CommitKind | null {
  return ledger.committed[id] ?? null;
}

/**
 * Resume target (E2E_FLOW_CONTRACT): resume exactly at the last confirmed
 * commit point — the most advanced committed kind wins, so a process kill
 * never jumps past a boundary that was not durably committed.
 */
export function resumeFromKinds(kinds: readonly CommitKind[]): Route {
  if (kinds.includes('REWARD')) return 'REWARD_OR_ANCHOR';
  if (kinds.includes('RESULT')) return 'RESULT';
  if (kinds.includes('BATTLE_START')) return 'BATTLE';
  return 'TITLE';
}

/** Counts committed ids per kind; used to assert exactly-one reward. */
export function commitCounts(ledger: CommitLedger): Readonly<Record<CommitKind, number>> {
  let battleStart = 0;
  let result = 0;
  let reward = 0;
  for (const kind of Object.values(ledger.committed)) {
    if (kind === 'BATTLE_START') battleStart += 1;
    else if (kind === 'RESULT') result += 1;
    else reward += 1;
  }
  return { BATTLE_START: battleStart, RESULT: result, REWARD: reward };
}
