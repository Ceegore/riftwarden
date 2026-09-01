import type { CommitRequest, CommitResult, NativeSaveStore } from './native-save-store.js';
import { SaveError } from './save-error.js';

interface Pending {
  request: CommitRequest;
  resolve: (value: CommitResult) => void;
  reject: (error: unknown) => void;
}

export interface CoordinatorStats {
  readonly active: boolean;
  readonly closed: boolean;
  readonly queued: number;
  readonly written: number;
  readonly failed: number;
}

/**
 * Serialized write coordinator: at most one active write, FIFO for all
 * non-coalescable transactions. Only waiting battle-snapshot requests of the
 * same family coalesce onto the newest tick; purchases, rewards, profile,
 * run and settings transactions are never dropped or merged. An already
 * active write is never cancelled. Each request gets its own promise; a
 * coalesced snapshot caller receives the result of the actually-written
 * newest snapshot.
 */
export class SaveWriteCoordinator {
  private active = false;
  private closed = false;
  private readonly queue: Pending[] = [];
  private writtenCount = 0;
  private failedCount = 0;

  constructor(private readonly store: NativeSaveStore) {}

  enqueue(request: CommitRequest): Promise<CommitResult> {
    if (this.closed) return Promise.reject(new SaveError('QUEUE_CLOSED'));
    return new Promise<CommitResult>((resolve, reject) => {
      const pending: Pending = { request, resolve, reject };
      if (request.reason === 'battle_snapshot') {
        const index = this.queue.findIndex(
          (candidate) => candidate.request.reason === 'battle_snapshot' && candidate.request.family === request.family,
        );
        if (index >= 0) {
          const existing = this.queue[index];
          if (existing) {
            // Keep the single waiting slot but write the newest request; fan
            // out the outcome to the superseded caller so both observe the
            // result of the actually-written newest snapshot.
            existing.request = request;
            existing.resolve = fanOut(existing.resolve, resolve);
            existing.reject = fanOutReject(existing.reject, reject);
          } else {
            this.queue.push(pending);
          }
        } else {
          this.queue.push(pending);
        }
      } else {
        this.queue.push(pending);
      }
      void this.pump();
    });
  }

  close(): void {
    this.closed = true;
  }

  getStats(): CoordinatorStats {
    return {
      active: this.active,
      closed: this.closed,
      queued: this.queue.length,
      written: this.writtenCount,
      failed: this.failedCount,
    };
  }

  private async pump(): Promise<void> {
    if (this.active) return;
    this.active = true;
    try {
      while (this.queue.length > 0) {
        const pending = this.queue.shift();
        if (!pending) break;
        try {
          const result = await this.store.commit(pending.request);
          this.writtenCount++;
          pending.resolve(result);
        } catch (error) {
          this.failedCount++;
          pending.reject(error);
        }
      }
    } finally {
      this.active = false;
    }
  }
}

function fanOut(first: (value: CommitResult) => void, second: (value: CommitResult) => void): (value: CommitResult) => void {
  return (value) => {
    first(value);
    second(value);
  };
}

function fanOutReject(first: (error: unknown) => void, second: (error: unknown) => void): (error: unknown) => void {
  return (error) => {
    first(error);
    second(error);
  };
}
