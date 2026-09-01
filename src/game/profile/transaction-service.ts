/**
 * Phase 31 transaction framework (TRANSACTION_FRAMEWORK_CONTRACT): every
 * mutation carries a `transactionId`, preview, explicit confirm, atomic commit
 * and result. Repeating the same id returns the same result without further
 * mutation. Insufficient funds or commit failure change nothing (except a
 * REJECTED ledger entry for the funds case); a throwing mutation propagates
 * with the old complete state untouched.
 */
import { assertNonNegativeInteger } from './integer.js';
import { validateProfile } from './profile-validator.js';
import type { Profile, TransactionRequest, TransactionResult } from './types.js';

export interface CommitOutcome {
  readonly profile: Profile;
  readonly result: TransactionResult;
  readonly replayed: boolean;
}

/** Immutable wallet debit; callers receive the new profile via mutation. */
function debitGold(profile: Profile, costGold: number): Profile {
  return { ...profile, wallet: { ...profile.wallet, gold: profile.wallet.gold - costGold } };
}

function recordResult(profile: Profile, result: TransactionResult): Profile {
  return { ...profile, transactionLedger: { ...profile.transactionLedger, [result.transactionId]: result } };
}

/**
 * Commits one transaction exactly once. A replayed id returns the stored
 * result with no mutation. Insufficient funds records a REJECTED entry.
 * Any other failure (throwing mutation) leaves the profile untouched.
 */
export function commitTransaction(profile: Profile, request: TransactionRequest): CommitOutcome {
  const previous = profile.transactionLedger[request.transactionId];
  if (previous !== undefined) {
    return { profile, result: previous, replayed: true };
  }
  assertNonNegativeInteger(request.costGold, 'costGold');
  if (profile.wallet.gold < request.costGold) {
    const result: TransactionResult = {
      transactionId: request.transactionId,
      status: 'REJECTED',
      reason: 'INSUFFICIENT_FUNDS',
    };
    return { profile: recordResult(profile, result), result, replayed: false };
  }
  const debited = debitGold(profile, request.costGold);
  const changed = request.mutate(debited);
  const result: TransactionResult = { transactionId: request.transactionId, status: 'COMMITTED' };
  const committed = recordResult(changed, result);
  validateProfile(committed);
  return { profile: committed, result, replayed: false };
}
