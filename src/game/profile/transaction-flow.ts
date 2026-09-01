/**
 * Phase 31 transaction flow (kill-point matrix): records the protocol stages
 * so fault injection can verify that a kill at any boundary leaves either the
 * old or the new complete state — never a partial mutation. The mutation is
 * exactly-once (`committed_once` for after-commit and duplicate callbacks).
 */
export type KillPoint =
  | 'before-preview'
  | 'after-confirm-before-commit'
  | 'during-save-temp-write'
  | 'after-commit-before-feedback'
  | 'duplicate-callback';

export const KILL_POINT_ORDER: readonly KillPoint[] = [
  'before-preview',
  'after-confirm-before-commit',
  'during-save-temp-write',
  'after-commit-before-feedback',
  'duplicate-callback',
];

export interface KillRecord {
  readonly point: KillPoint;
  readonly mutation: 'none' | 'old_or_new_never_partial' | 'committed_once';
}

export class TransactionFlow {
  private readonly recorded: KillPoint[] = [];

  state(): readonly KillPoint[] {
    return [...this.recorded];
  }

  record(point: KillPoint): void {
    if (!this.recorded.includes(point)) this.recorded.push(point);
  }

  /** True when the pinned kill point has been reached (for fault injection). */
  reached(point: KillPoint): boolean {
    return this.recorded.includes(point);
  }
}

export const KILL_RECORDS: readonly KillRecord[] = [
  { point: 'before-preview', mutation: 'none' },
  { point: 'after-confirm-before-commit', mutation: 'none' },
  { point: 'during-save-temp-write', mutation: 'old_or_new_never_partial' },
  { point: 'after-commit-before-feedback', mutation: 'committed_once' },
  { point: 'duplicate-callback', mutation: 'committed_once' },
];
