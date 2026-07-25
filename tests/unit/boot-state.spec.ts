import { describe, expect, it } from 'vitest';
import {
  createInitialBootState,
  reduceBootState,
  toBootDiagnosticSnapshot,
} from '../../src/app/boot/boot-state';

describe('boot state reducer', () => {
  it('follows the success path and resolves first run', () => {
    let state = createInitialBootState(0);
    state = reduceBootState(state, { type: 'STEP_SUCCEEDED', step: 'BOOT_NATIVE' });
    state = reduceBootState(state, { type: 'STEP_SUCCEEDED', step: 'BOOT_WEB' });
    state = reduceBootState(state, { type: 'STEP_SUCCEEDED', step: 'LOAD_SETTINGS' });
    state = reduceBootState(state, { type: 'STEP_SUCCEEDED', step: 'VALIDATE_CONTENT' });
    state = reduceBootState(state, {
      type: 'LOAD_SAVE_RESOLVED',
      outcome: { kind: 'first_run' },
    });
    expect(state.step).toBe('FIRST_RUN');
  });

  it('ignores out-of-order success events', () => {
    const state = createInitialBootState(0);
    const next = reduceBootState(state, {
      type: 'STEP_SUCCEEDED',
      step: 'LOAD_SETTINGS',
    });
    expect(next).toBe(state);
  });

  it('preserves failure identity and increments retry count', () => {
    const initial = createInitialBootState(0);
    const failed = reduceBootState(initial, {
      type: 'STEP_FAILED',
      step: 'BOOT_NATIVE',
      failure: {
        code: 'BOOT_NATIVE_UNAVAILABLE',
        sourceStep: 'BOOT_NATIVE',
        recoverable: true,
        safeContext: {},
      },
    });
    const retried = reduceBootState(failed, {
      type: 'RETRY_REQUESTED',
      monotonicMs: 100,
    });
    expect(retried.step).toBe('BOOT_NATIVE');
    expect(retried.retryCount).toBe(1);
  });

  it('diagnostic snapshot excludes payloads', () => {
    const snapshot = toBootDiagnosticSnapshot(createInitialBootState(0));
    expect(Object.keys(snapshot).sort()).toEqual(
      ['failureCode', 'failureSourceStep', 'retryCount', 'sequence', 'step'].sort(),
    );
  });
});
