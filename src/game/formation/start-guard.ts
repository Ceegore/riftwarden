import { FormationError } from './formation-error.js';

/**
 * Atomic start (DRAFT_APPLY_TRANSACTION_CONTRACT + PREBATTLE_DISCLOSURE):
 * lock input, commit, navigate, exactly once. Double-tap shares one pending
 * promise; a commit failure returns false and unlocks — no battle, no partial
 * commit, caller stays on the disclosure screen. A failed commit leaves the
 * previous committed loadout untouched.
 */
export interface AtomicStartOutcome {
  readonly committed: boolean;
  readonly navigated: boolean;
}

export class AtomicStartGuard {
  #pending: Promise<AtomicStartOutcome> | undefined;

  start(commit: () => Promise<void>, navigate: () => void): Promise<AtomicStartOutcome> {
    if (this.#pending !== undefined) return this.#pending;
    let settle: ((outcome: AtomicStartOutcome) => void) | undefined;
    const pending = new Promise<AtomicStartOutcome>((resolve) => {
      settle = resolve;
    });
    // #pending is registered before any async work runs, so a commit that
    // throws synchronously cannot leave a stale pending promise behind.
    this.#pending = pending;
    const run = async (): Promise<void> => {
      try {
        await commit();
        navigate();
        settle?.({ committed: true, navigated: true });
      } catch {
        settle?.({ committed: false, navigated: false });
      } finally {
        this.#pending = undefined;
      }
    };
    void run();
    return pending;
  }

  get pending(): boolean {
    return this.#pending !== undefined;
  }

  assertIdle(): void {
    if (this.#pending !== undefined) {
      throw new FormationError('START_GUARD_ALREADY_PENDING');
    }
  }
}
