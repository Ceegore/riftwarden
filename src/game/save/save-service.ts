import type { JsonValue } from './canonical-json.js';
import type { SaveEnvelope } from './save-envelope.js';
import type { SaveCommitReason } from './schema/types.js';
import { SaveError } from './save-error.js';
import { CommitCoordinator } from './commit-coordinator.js';
import { payloadHash } from './save-envelope.js';
import type { CommitRequest, CommitResult, NativeSaveStore } from './native-save-store.js';
import { SaveWriteCoordinator } from './save-write-coordinator.js';

export interface SaveCommitInput {
  readonly family: 'profile' | 'run' | 'settings' | 'battle';
  readonly reason: SaveCommitReason;
  readonly idempotencyKey: string;
  readonly payload: JsonValue;
  readonly battleTick?: number;
}

/** Reasons whose waiting requests may coalesce onto the newest tick. */
const COALESCABLE_REASONS: readonly SaveCommitReason[] = ['battle_snapshot'];

/**
 * Phase 24 SaveService. Every commit carries a SaveCommitReason, a strictly
 * monotonic commitId and a stable idempotency key. Success is reported only
 * after the underlying atomic commit. Profile, reward and final-outcome
 * commits are never coalesced; only waiting battle-snapshot requests of the
 * same family may coalesce onto the newest tick.
 */
export class SaveService {
  private readonly coordinator: CommitCoordinator;
  private readonly writes: SaveWriteCoordinator;
  private nextCommitId = 1;

  constructor(store: NativeSaveStore) {
    this.coordinator = new CommitCoordinator();
    this.writes = new SaveWriteCoordinator(store);
  }

  async commit(input: SaveCommitInput): Promise<CommitResult> {
    const commitId = this.nextCommitId;
    this.nextCommitId++;
    const outcome = this.coordinator.commit({
      reason: input.reason,
      idempotencyKey: input.idempotencyKey,
      commitId,
      payload: input.payload,
    });
    if (outcome === 'duplicate') throw new SaveError('DUPLICATE_COMMIT', { idempotencyKey: input.idempotencyKey });

    const request: CommitRequest = input.battleTick !== undefined
      ? {
          family: input.family,
          reason: COALESCABLE_REASONS.includes(input.reason) ? 'battle_snapshot' : input.reason,
          battleTick: input.battleTick,
          envelope: this.envelope(input, commitId),
        }
      : {
          family: input.family,
          reason: COALESCABLE_REASONS.includes(input.reason) ? 'battle_snapshot' : input.reason,
          envelope: this.envelope(input, commitId),
        };
    return this.writes.enqueue(request);
  }

  getLastCommitId(): number {
    return this.coordinator.getLastCommitId();
  }

  private envelope(input: SaveCommitInput, commitId: number): SaveEnvelope<JsonValue> {
    const payload = input.payload;
    return {
      magic: 'RIFTWARDEN_SAVE',
      formatVersion: 1,
      schemaVersion: 1,
      simulationVersion: 1,
      contentVersion: 'content_fixture',
      appVersion: '1.0.0',
      commitId,
      committedAtUtc: '1970-01-01T00:00:00Z',
      payloadSha256: payloadHash(payload),
      payload,
    };
  }
}
