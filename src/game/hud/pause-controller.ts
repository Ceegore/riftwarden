import type { PauseState, SpeedPercent } from './types.js';
import { HudError } from './hud-error.js';

/**
 * Pause/speed/lifecycle state machine (PAUSE_SPEED_LIFECYCLE_CONTRACT).
 * Allowed speeds are exactly 50/100/200/300 percent. Pause input is captured
 * once and confirmed at the next safe tick; resume requires all systems ready
 * and is never automatic. Repeated inputs are idempotent — there is at most
 * one pending pause/resume request.
 */
const SPEED_VALUES: readonly number[] = Object.freeze([50, 100, 200, 300]);

export function parseSpeed(value: number): SpeedPercent {
  if (!SPEED_VALUES.includes(value)) throw new HudError('INVALID_SPEED', { value });
  return value as SpeedPercent;
}

export function requestPause(state: PauseState): PauseState {
  return state === 'RUNNING' ? 'PAUSE_REQUESTED' : state;
}

/** Pause becomes effective only at the next safe tick. */
export function confirmSafeTickPause(state: PauseState): PauseState {
  return state === 'PAUSE_REQUESTED' ? 'PAUSED' : state;
}

export function requestResume(state: PauseState, ready: boolean): PauseState {
  if (state !== 'PAUSED') return state;
  return ready ? 'RESUME_REQUESTED' : 'BLOCKED_UNTIL_READY';
}

/** Systems (simulation, renderer, audio, lifecycle adapter) became ready. */
export function systemsReady(state: PauseState): PauseState {
  return state === 'BLOCKED_UNTIL_READY' ? 'RESUME_REQUESTED' : state;
}

export function confirmResume(state: PauseState): PauseState {
  return state === 'RESUME_REQUESTED' ? 'RUNNING' : state;
}
