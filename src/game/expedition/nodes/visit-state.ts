/**
 * Node visit state machine (SAVE_RECOVERY_CONTRACT): OPEN → COMMITTING →
 * COMMITTED → RESOLVED. A saved COMMITTING resumes via the ledger (never a
 * re-roll); a COMMITTED visit replays presentation/navigation and may start
 * a NEW transaction (multi-action nodes such as the merchant) by returning
 * to COMMITTING; a storage failure keeps the old state and never shows
 * success UI. Unknown or illegal transitions are hard errors — the machine
 * is closed.
 */
import { ExpeditionError } from '../expedition-error.js';
import type { VisitStatus } from './types.js';

export const VISIT_STATUSES: readonly VisitStatus[] = ['OPEN', 'COMMITTING', 'COMMITTED', 'RESOLVED'];

const NEXT: Readonly<Record<VisitStatus, readonly VisitStatus[]>> = {
  OPEN: ['COMMITTING'],
  COMMITTING: ['COMMITTED', 'OPEN'],
  COMMITTED: ['RESOLVED', 'COMMITTING'],
  RESOLVED: [],
};

export type VisitCommand = 'open' | 'startCommit' | 'commit' | 'rollback' | 'resolve';

const COMMAND_TARGET: Readonly<Record<VisitCommand, VisitStatus>> = {
  open: 'OPEN',
  startCommit: 'COMMITTING',
  commit: 'COMMITTED',
  rollback: 'OPEN',
  resolve: 'RESOLVED',
};

export function transitionVisit(from: VisitStatus, to: VisitStatus): VisitStatus {
  if (!NEXT[from].includes(to)) {
    throw new ExpeditionError('VISIT_STATE_INVALID', { from, to });
  }
  return to;
}

export function applyVisitCommand(status: VisitStatus, command: VisitCommand): VisitStatus {
  return transitionVisit(status, COMMAND_TARGET[command]);
}

export function isVisitStatus(value: unknown): value is VisitStatus {
  return typeof value === 'string' && VISIT_STATUSES.includes(value as VisitStatus);
}

/**
 * Recovery decision (SAVE_RECOVERY_CONTRACT §58.5): a COMMITTING visit with a
 * ledger entry continues as COMMITTED (replay); without one it rolls back to
 * OPEN. COMMITTED only repeats presentation; RESOLVED only navigates.
 */
export function recoverVisit(
  status: VisitStatus,
  hasLedgerEntry: boolean,
): { readonly status: VisitStatus; readonly resumed: boolean } {
  if (status === 'COMMITTING') {
    return hasLedgerEntry ? { status: 'COMMITTED', resumed: true } : { status: 'OPEN', resumed: true };
  }
  return { status, resumed: false };
}
