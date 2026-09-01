import type { SaveCommitReason } from './schema/types.js';
import { SaveError } from './save-error.js';

export interface CommitRequest {
  readonly reason: SaveCommitReason;
  readonly idempotencyKey: string;
  readonly commitId: number;
  readonly payload: unknown;
}

export type CommitOutcome = 'committed' | 'duplicate';

/**
 * Serialized commit gate: every commit carries an exact SaveCommitReason, a
 * strictly monotonic commitId and a stable idempotency key. Duplicate events
 * (double click, doubled lifecycle event, retry) are rejected without side
 * effects; a non-monotonic commitId is a hard error.
 */
export class CommitCoordinator {
  private readonly seen = new Set<string>();
  private lastCommitId = 0;

  commit(request: CommitRequest): CommitOutcome {
    if (request.idempotencyKey.length === 0) throw new SaveError('INVALID_ARGUMENT', { field: 'idempotencyKey' });
    if (this.seen.has(request.idempotencyKey)) return 'duplicate';
    if (!Number.isSafeInteger(request.commitId) || request.commitId <= this.lastCommitId) {
      throw new SaveError('NON_MONOTONIC_COMMIT', { commitId: request.commitId, last: this.lastCommitId });
    }
    this.lastCommitId = request.commitId;
    this.seen.add(request.idempotencyKey);
    return 'committed';
  }

  getLastCommitId(): number {
    return this.lastCommitId;
  }
}
