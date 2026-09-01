import type { RendererLifecycle, RenderFailureReason } from './types.js';
import { RenderError } from './render-error.js';

/**
 * Renderer lifecycle state machine (WEBGL_CAPABILITY_LIFECYCLE_CONTRACT):
 * uninitialized -> initializing -> ready -> context_lost -> rebuilding ->
 * ready, or failed_safe after two failed restore attempts. 'disposed' is
 * terminal.
 */
export interface RecoveryState {
  readonly lifecycle: RendererLifecycle;
  readonly restoreAttempts: number;
  readonly failureReason?: RenderFailureReason;
}

export const INITIAL_RECOVERY_STATE: RecoveryState = { lifecycle: 'uninitialized', restoreAttempts: 0 };

function withReason(state: RecoveryState, failureReason?: RenderFailureReason): RecoveryState {
  if (failureReason === undefined) return { lifecycle: state.lifecycle, restoreAttempts: state.restoreAttempts };
  return { lifecycle: state.lifecycle, restoreAttempts: state.restoreAttempts, failureReason };
}

export function beginInitialize(state: RecoveryState): RecoveryState {
  if (state.lifecycle !== 'uninitialized') throw new RenderError('LIFECYCLE_INVALID_TRANSITION', { from: state.lifecycle, to: 'initializing' });
  return { lifecycle: 'initializing', restoreAttempts: 0 };
}

export function completeInitialize(state: RecoveryState, ok: boolean, failureReason?: RenderFailureReason): RecoveryState {
  if (state.lifecycle !== 'initializing') throw new RenderError('LIFECYCLE_INVALID_TRANSITION', { from: state.lifecycle, to: ok ? 'ready' : 'failed_safe' });
  if (ok) return { lifecycle: 'ready', restoreAttempts: 0 };
  return { lifecycle: 'failed_safe', restoreAttempts: 0, failureReason: failureReason ?? 'context_creation_failed' };
}

export function onContextLost(state: RecoveryState): RecoveryState {
  if (state.lifecycle !== 'ready') throw new RenderError('LIFECYCLE_INVALID_TRANSITION', { from: state.lifecycle, to: 'context_lost' });
  return { lifecycle: 'context_lost', restoreAttempts: state.restoreAttempts };
}

export function beginRestore(state: RecoveryState): RecoveryState {
  if (state.lifecycle !== 'context_lost') throw new RenderError('RESTORE_INVALID_STATE', { lifecycle: state.lifecycle });
  return { lifecycle: 'rebuilding', restoreAttempts: state.restoreAttempts + 1 };
}

/**
 * Completes a restore attempt. Success returns to 'ready' and resets the
 * attempt counter. Failure stays 'context_lost' for another attempt unless
 * the attempt limit (maxContextRestoreAttempts = 2) is exhausted, which
 * enters 'failed_safe' (safe compatibility/recovery screen).
 */
export function completeRestore(state: RecoveryState, ok: boolean, failureReason?: RenderFailureReason): RecoveryState {
  if (state.lifecycle !== 'rebuilding') throw new RenderError('COMPLETE_INVALID_STATE', { lifecycle: state.lifecycle });
  if (ok) return { lifecycle: 'ready', restoreAttempts: 0 };
  if (state.restoreAttempts >= 2) {
    return { lifecycle: 'failed_safe', restoreAttempts: state.restoreAttempts, failureReason: failureReason ?? 'restore_failed' };
  }
  return withReason({ lifecycle: 'context_lost', restoreAttempts: state.restoreAttempts }, failureReason ?? 'restore_failed');
}

export function dispose(state: RecoveryState): RecoveryState {
  if (state.lifecycle === 'disposed') return state;
  return { lifecycle: 'disposed', restoreAttempts: state.restoreAttempts };
}
