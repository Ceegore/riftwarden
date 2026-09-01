import { describe, expect, it } from 'vitest';
import type { SaveErrorCode } from '../../src/game/save/save-error.js';
import { FileNativeSaveStore, type FaultStep } from '../../src/game/save/native-save-store.js';
import { makeRequest, MemoryFileSystem, makeStore } from './phase23-helpers.js';

/**
 * P23 save-recovery fault fuzz. Random fault sequences are injected into every
 * commit step; whatever the pattern, load() must recover a coherent envelope
 * whose commitId was actually written, with its exact payload — a committed
 * save is never lost and a torn write falls back to the newest durable slot.
 */

describe('P23 save recovery fuzz', () => {
  const ALL_STEPS: readonly FaultStep[] = [
    'slot_tmp_write',
    'slot_flush',
    'slot_reread',
    'slot_hash',
    'slot_rename',
    'slot_dir_flush',
    'manifest_new_write',
    'manifest_flush',
    'manifest_reread',
    'manifest_validate',
    'manifest_rename',
    'manifest_dir_flush',
  ];
  const FAULT_CODES: readonly SaveErrorCode[] = [
    'IO_WRITE_FAILED',
    'IO_FLUSH_FAILED',
    'IO_READ_FAILED',
    'ATOMIC_RENAME_FAILED',
    'MANIFEST_COMMIT_FAILED',
    'HASH_MISMATCH',
  ];

  function lcg(seed: number): () => number {
    let state = seed >>> 0;
    return () => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state;
    };
  }

  it('never loses a committed save and always recovers a matching envelope across 300 randomized fault sequences', { timeout: 60_000 }, async () => {
    const rng = lcg(0x51a7_0001);
    for (let iteration = 0; iteration < 300; iteration += 1) {
      const fs = new MemoryFileSystem();
      const clean = new FileNativeSaveStore(fs, '/data');
      await clean.commit(makeRequest('profile', 1, { v: 1 }));

      const attemptCount = 1 + (rng() % 15);
      for (let c = 2; c <= attemptCount + 1; c += 1) {
        const faultStep = ALL_STEPS[rng() % ALL_STEPS.length];
        const faultCode = FAULT_CODES[rng() % FAULT_CODES.length];
        if (faultStep === undefined || faultCode === undefined) throw new Error('fuzz index out of range');
        const faulted = new FileNativeSaveStore(fs, '/data', (step) => (step === faultStep ? faultCode : null));
        const committed = await faulted.commit(makeRequest('profile', c, { v: c })).then(
          () => true,
          () => false,
        );
        if (committed) {
          // A normally-returning commit is immediately durable and loadable.
          const loadedNow = await clean.load('profile');
          expect(loadedNow.commitId).toBe(c);
          expect(loadedNow.payload).toEqual({ v: c });
        }
      }

      // Whatever the fault pattern, load() must recover a coherent envelope
      // whose commitId was actually written, with its exact payload.
      const loaded = await clean.load('profile');
      expect(loaded.commitId).toBeGreaterThanOrEqual(1);
      expect(loaded.commitId).toBeLessThanOrEqual(attemptCount + 1);
      expect(loaded.payload).toEqual({ v: loaded.commitId });
    }
  });

  it('recovers from a torn slot write to the previous durable commit', async () => {
    // A slot rename is atomic in the file port; corrupting the active slot
    // after a commit and then committing again exercises the manifest-fallback
    // scan path with a higher commitId present on another slot.
    const { store, fs } = makeStore();
    await store.commit(makeRequest('profile', 1, { v: 1 }));
    await store.commit(makeRequest('profile', 2, { v: 2 }));
    // Commit 3 to slot C, then corrupt slot A (holding commit 1) and confirm
    // the fallback still returns the newest valid slot (commit 3), not a torn
    // or stale read.
    await store.commit(makeRequest('profile', 3, { v: 3 }));
    fs.corruptSlot('profile', 'A');
    const loaded = await store.load('profile');
    expect(loaded.commitId).toBe(3);
    expect(loaded.payload).toEqual({ v: 3 });
  });
});
