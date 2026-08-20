import { describe, expect, it } from 'vitest';
import { createDraftStore } from '../../src/game/formation/draft-store.js';
import { catchFormationCode, entry, formation, unit } from './phase27-helpers.js';

function committedFormation() {
  return formation([entry('lane_0:front', unit('c0'))]);
}

describe('phase27 draft store', () => {
  it('starts clean against the committed loadout', () => {
    const store = createDraftStore({ committed: committedFormation(), persistCommitted: () => Promise.resolve() });
    expect(store.dirty).toBe(false);
    expect(store.pending).toBe(false);
  });

  it('edits mark the draft dirty without touching the commit', () => {
    const store = createDraftStore({ committed: committedFormation(), persistCommitted: () => Promise.resolve() });
    store.edit(formation([entry('lane_0:front', unit('c0')), entry('lane_0:middle', unit('c1'))]));
    expect(store.dirty).toBe(true);
    expect(store.committed.entries).toHaveLength(1);
    expect(store.draft.entries).toHaveLength(2);
  });

  it('discard restores the committed loadout', () => {
    const store = createDraftStore({ committed: committedFormation(), persistCommitted: () => Promise.resolve() });
    store.edit(formation([]));
    expect(store.dirty).toBe(true);
    store.discard();
    expect(store.dirty).toBe(false);
    expect(store.draft.entries).toHaveLength(1);
  });

  it('apply commits atomically and clears dirty', async () => {
    let persisted: unknown = null;
    const store = createDraftStore({
      committed: committedFormation(),
      persistCommitted: (f) => {
        persisted = f;
        return Promise.resolve();
      },
    });
    const next = formation([entry('lane_0:front', unit('c0')), entry('lane_0:middle', unit('c1'))]);
    store.edit(next);
    const ok = await store.apply();
    expect(ok).toBe(true);
    expect(persisted).toEqual(next);
    expect(store.dirty).toBe(false);
    expect(store.committed.entries).toHaveLength(2);
  });

  it('a failed apply leaves the previous commit and the draft editable', async () => {
    const store = createDraftStore({
      committed: committedFormation(),
      persistCommitted: () => {
        throw new Error('disk full');
      },
    });
    const next = formation([entry('lane_0:front', unit('c0')), entry('lane_0:middle', unit('c1'))]);
    store.edit(next);
    const ok = await store.apply();
    expect(ok).toBe(false);
    expect(store.committed.entries).toHaveLength(1);
    expect(store.draft.entries).toHaveLength(2);
    expect(store.pending).toBe(false);
    expect(() => {
      store.edit(formation([]));
    }).not.toThrow();
  });

  it('apply with an unchanged draft is a no-op success', async () => {
    let persisted = 0;
    const store = createDraftStore({
      committed: committedFormation(),
      persistCommitted: () => {
        persisted += 1;
        return Promise.resolve();
      },
    });
    const ok = await store.apply();
    expect(ok).toBe(true);
    expect(persisted).toBe(0);
  });

  it('revalidation keeps valid entries and drops the rest, persisting the pruned draft', () => {
    let drafts = 0;
    const store = createDraftStore({
      committed: committedFormation(),
      persistCommitted: () => Promise.resolve(),
      persistDraft: () => {
        drafts += 1;
      },
    });
    store.edit(formation([entry('lane_0:front', unit('c0')), entry('lane_0:middle', unit('gone')), entry('lane_1:front', unit('kept'))]));
    const kept = store.revalidate((e) => e.unit.instanceId !== 'gone');
    expect(kept.map((e) => e.unit.instanceId)).toEqual(['c0', 'kept']);
    expect(store.draft.entries.map((e) => e.unit.instanceId)).toEqual(['c0', 'kept']);
    expect(drafts).toBe(2);
  });

  it('restore reinstates the draft after route/resize/locale changes', () => {
    const store = createDraftStore({ committed: committedFormation(), persistCommitted: () => Promise.resolve() });
    store.edit(formation([entry('lane_0:front', unit('c0')), entry('lane_0:middle', unit('c1'))]));
    store.restore(formation([entry('lane_0:front', unit('c0')), entry('lane_0:middle', unit('c1'))]));
    expect(store.draft.entries.map((e) => e.unit.instanceId)).toEqual(['c0', 'c1']);
    expect(store.dirty).toBe(true);
  });

  it('guards mutations while a transaction is pending', async () => {
    let release: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const store = createDraftStore({
      committed: committedFormation(),
      persistCommitted: () => gate,
    });
    store.edit(formation([]));
    const pendingApply = store.apply();
    expect(store.pending).toBe(true);
    expect(catchFormationCode(() => {
      store.edit(formation([entry('lane_0:front', unit('c0'))]));
    })).toBe('DRAFT_ALREADY_PENDING');
    expect(catchFormationCode(() => {
      store.discard();
    })).toBe('DRAFT_ALREADY_PENDING');
    expect(catchFormationCode(() => {
      store.restore(committedFormation());
    })).toBe('DRAFT_ALREADY_PENDING');
    release?.();
    await pendingApply;
    expect(store.pending).toBe(false);
  });
});
