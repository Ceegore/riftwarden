import { FormationError } from './formation-error.js';
import { sameFormation } from './model.js';
import type { Formation, SlotEntry } from './types.js';

/**
 * Draft / apply / unsaved flow (DRAFT_APPLY_TRANSACTION_CONTRACT):
 * - The working draft changes locally immediately but the committed loadout
 *   changes only through apply (or atomic start).
 * - Apply is an atomic pending transaction: a failure leaves the previous
 *   commit unchanged and the draft editable.
 * - Route/resize/locale changes restore the draft; content/profile changes
 *   force revalidation that preserves valid user decisions where possible.
 * Persistence is injected (SaveService transaction for commits, a draft
 * callback for the working draft) so the state machine stays pure and
 * deterministic.
 */
export interface DraftStoreOptions {
  readonly committed: Formation;
  readonly persistCommitted: (formation: Formation) => Promise<void>;
  readonly persistDraft?: (formation: Formation) => void;
}

export interface DraftStore {
  readonly committed: Formation;
  readonly draft: Formation;
  readonly dirty: boolean;
  readonly pending: boolean;
  edit(formation: Formation): void;
  discard(): void;
  apply(): Promise<boolean>;
  /** Revalidation after content/profile changes: keep valid entries, drop the rest. */
  revalidate(keepEntry: (entry: SlotEntry) => boolean): readonly SlotEntry[];
  restore(formation: Formation): void;
}

export function createDraftStore(options: DraftStoreOptions): DraftStore {
  let committed = options.committed;
  let draft = options.committed;
  let pending = false;

  const dirty = (): boolean => !sameFormation(committed, draft);

  return {
    get committed() {
      return committed;
    },
    get draft() {
      return draft;
    },
    get dirty() {
      return dirty();
    },
    get pending() {
      return pending;
    },
    edit(formation) {
      if (pending) throw new FormationError('DRAFT_ALREADY_PENDING');
      draft = formation;
      options.persistDraft?.(formation);
    },
    discard() {
      if (pending) throw new FormationError('DRAFT_ALREADY_PENDING');
      draft = committed;
    },
    async apply() {
      if (pending) throw new FormationError('DRAFT_ALREADY_PENDING');
      if (!dirty()) return true;
      pending = true;
      try {
        await options.persistCommitted(draft);
        committed = draft;
        return true;
      } catch {
        return false;
      } finally {
        pending = false;
      }
    },
    revalidate(keepEntry) {
      if (pending) throw new FormationError('DRAFT_ALREADY_PENDING');
      const kept = draft.entries.filter(keepEntry);
      draft = { ...draft, entries: kept };
      options.persistDraft?.(draft);
      return kept;
    },
    restore(formation) {
      if (pending) throw new FormationError('DRAFT_ALREADY_PENDING');
      draft = formation;
    },
  };
}
