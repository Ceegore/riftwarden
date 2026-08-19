import type { BattlePresentationFrame, RenderFailureReason } from './types.js';
import type { RecoveryState } from './lifecycle.js';
import { beginInitialize, beginRestore, completeInitialize, completeRestore, dispose, INITIAL_RECOVERY_STATE, onContextLost } from './lifecycle.js';
import type { SnapshotPresenter } from './snapshot-presenter.js';
import { RenderError } from './render-error.js';

/**
 * Context recovery contract (CONTEXT_RECOVERY_CONTRACT):
 * Loss -> preventDefault, freeze, save/snapshot request, teardown.
 * Restore -> local assets only, rebuild from the last authoritative snapshot,
 * ready-gate for renderer/audio/input, no auto-resume. Two failed rebuilds
 * enter failed_safe (safe compatibility/recovery screen).
 */
export type ContextLossStep =
  | 'prevent_default'
  | 'freeze'
  | 'snapshot_request'
  | 'teardown'
  | 'rebuild_from_snapshot'
  | 'ready_gate'
  | 'failed_safe';

export interface ContextRecoveryOptions {
  readonly presenter: SnapshotPresenter;
  readonly requestSnapshot: () => void;
  readonly teardownResources: () => void;
  /** Rebuilds the scene graph from the authoritative snapshot; null on failure. */
  readonly rebuildFromSnapshot: (frame: BattlePresentationFrame) => BattlePresentationFrame | null;
}

export interface ContextRecovery {
  readonly lifecycle: RecoveryState;
  readonly steps: readonly ContextLossStep[];
  readonly snapshotRequested: boolean;
  readonly frozenFrame: BattlePresentationFrame | null;
  readonly endGameplayHash: string | null;
  beginInitialize(): void;
  completeInitialize(ok: boolean, failureReason?: RenderFailureReason): void;
  onContextLost(): void;
  attemptRestore(): 'ready' | 'retry' | 'failed_safe';
  /** Explicit user/operator continue after the ready gate; no auto-resume. */
  resumeAfterReadyGate(): void;
  dispose(): void;
}

export function createContextRecovery(options: ContextRecoveryOptions): ContextRecovery {
  let state: RecoveryState = INITIAL_RECOVERY_STATE;
  let steps: ContextLossStep[] = [];
  let snapshotRequested = false;
  let frozenFrame: BattlePresentationFrame | null = null;
  let endGameplayHash: string | null = null;

  return {
    get lifecycle() {
      return state;
    },
    get steps() {
      return Object.freeze([...steps]);
    },
    get snapshotRequested() {
      return snapshotRequested;
    },
    get frozenFrame() {
      return frozenFrame;
    },
    get endGameplayHash() {
      return endGameplayHash;
    },
    beginInitialize() {
      state = beginInitialize(state);
    },
    completeInitialize(ok, failureReason) {
      state = completeInitialize(state, ok, failureReason);
    },
    onContextLost() {
      const frozen = options.presenter.next;
      if (frozen === null) throw new RenderError('RECOVERY_NO_SNAPSHOT', { reason: 'no-confirmed-frame' });
      state = onContextLost(state);
      frozenFrame = frozen;
      steps = [...steps, 'prevent_default', 'freeze', 'snapshot_request', 'teardown'];
      options.presenter.pause();
      snapshotRequested = true;
      options.requestSnapshot();
      options.teardownResources();
    },
    attemptRestore() {
      if (state.lifecycle !== 'context_lost') throw new RenderError('RESTORE_INVALID_STATE', { lifecycle: state.lifecycle });
      if (frozenFrame === null) throw new RenderError('RECOVERY_NO_SNAPSHOT', { reason: 'no-frozen-frame' });
      state = beginRestore(state);
      const rebuilt = options.rebuildFromSnapshot(frozenFrame);
      steps = [...steps, 'rebuild_from_snapshot'];
      if (rebuilt !== null && rebuilt.gameplayHash === frozenFrame.gameplayHash) {
        state = completeRestore(state, true);
        steps = [...steps, 'ready_gate'];
        endGameplayHash = rebuilt.gameplayHash;
        return 'ready';
      }
      state = completeRestore(state, false, 'rebuild_failed');
      if (state.lifecycle === 'failed_safe') {
        steps = [...steps, 'failed_safe'];
        return 'failed_safe';
      }
      return 'retry';
    },
    resumeAfterReadyGate() {
      if (state.lifecycle !== 'ready') throw new RenderError('LIFECYCLE_INVALID_TRANSITION', { from: state.lifecycle, to: 'resume' });
      options.presenter.resume();
    },
    dispose() {
      state = dispose(state);
    },
  };
}
