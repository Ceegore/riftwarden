import { describe, expect, it } from 'vitest';
import {
  createInitialBootState,
  reduceBootState,
} from '../../src/app/boot/boot-state';

describe('Phase-05 boot integration contract', () => {
  it.each([
    ['first_run', 'FIRST_RUN'],
    ['title', 'TITLE'],
  ] as const)('maps save outcome %s to %s', (kind, expected) => {
    let state = createInitialBootState(0);
    state = reduceBootState(state, { type: 'STEP_SUCCEEDED', step: 'BOOT_NATIVE' });
    state = reduceBootState(state, { type: 'STEP_SUCCEEDED', step: 'BOOT_WEB' });
    state = reduceBootState(state, { type: 'STEP_SUCCEEDED', step: 'LOAD_SETTINGS' });
    state = reduceBootState(state, { type: 'STEP_SUCCEEDED', step: 'VALIDATE_CONTENT' });
    state = reduceBootState(state, {
      type: 'LOAD_SAVE_RESOLVED',
      outcome: { kind },
    });
    expect(state.step).toBe(expected);
  });

  it('routes invalid save outcome to recovery without changing a save', () => {
    const failure = {
      code: 'SAVE_INVALID' as const,
      sourceStep: 'LOAD_SAVE' as const,
      recoverable: true,
      safeContext: { recoveryReason: 'newest_slot_invalid' },
    };
    const state = {
      ...createInitialBootState(0),
      step: 'LOAD_SAVE' as const,
    };
    const next = reduceBootState(state, {
      type: 'LOAD_SAVE_RESOLVED',
      outcome: { kind: 'recovery', failure },
    });
    expect(next.step).toBe('RECOVERY_REQUIRED');
    expect(next.failure).toEqual(failure);
  });
});
