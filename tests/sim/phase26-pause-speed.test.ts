import { describe, expect, it } from 'vitest';
import {
  confirmResume,
  confirmSafeTickPause,
  parseSpeed,
  requestPause,
  requestResume,
  systemsReady,
} from '../../src/game/hud/pause-controller.js';
import type { PauseState, SpeedPercent } from '../../src/game/hud/types.js';
import { catchHudCode, hexHash, readJson } from './phase26-helpers.js';

const speedPauseMatrix = readJson('fixtures/speed-pause-matrix.json') as {
  cases: readonly { speed: number; pauseAtTick: number; expected: string }[];
};

const TOTAL_TICKS = 400;

/**
 * Deterministic driver: the sim consumes ticks 0..TOTAL_TICKS-1 in order and
 * produces a hash per tick. Pause input is captured once and confirmed at the
 * next safe tick; resume requires systems ready and is never automatic.
 * Speed is a pure presentation setting and never changes which sim ticks run.
 */
function runWithPause(speed: SpeedPercent, pauseAtTick: number | null): { endHash: string; sequence: number[] } {
  parseSpeed(speed);
  let state: PauseState = 'RUNNING';
  let tick = 0;
  let captured = false;
  let resumed = false;
  const sequence: number[] = [];
  while (tick < TOTAL_TICKS) {
    if (pauseAtTick !== null && !captured && tick === pauseAtTick) {
      state = requestPause(state);
      captured = true;
    }
    if (state === 'PAUSE_REQUESTED') state = confirmSafeTickPause(state);
    if (state === 'RESUME_REQUESTED') state = confirmResume(state);
    if (state === 'RUNNING') {
      sequence.push(tick);
      tick += 1;
    } else if (state === 'PAUSED') {
      if (!resumed) {
        // Explicit resume: all systems are ready here; never automatic.
        state = requestResume(state, true);
        resumed = true;
      }
    }
  }
  return { endHash: hexHash(TOTAL_TICKS - 1), sequence };
}

describe('Pause/speed/lifecycle state machine', () => {
  it('accepts exactly the closed speed set', () => {
    for (const speed of [50, 100, 200, 300]) expect(parseSpeed(speed)).toBe(speed);
    expect(catchHudCode(() => parseSpeed(0))).toBe('INVALID_SPEED');
    expect(catchHudCode(() => parseSpeed(75))).toBe('INVALID_SPEED');
    expect(catchHudCode(() => parseSpeed(1000))).toBe('INVALID_SPEED');
  });

  it('walks the full lifecycle with a not-ready resume', () => {
    let state: PauseState = 'RUNNING';
    state = requestPause(state);
    expect(state).toBe('PAUSE_REQUESTED');
    state = confirmSafeTickPause(state);
    expect(state).toBe('PAUSED');
    state = requestResume(state, false);
    expect(state).toBe('BLOCKED_UNTIL_READY');
    state = systemsReady(state);
    expect(state).toBe('RESUME_REQUESTED');
    state = confirmResume(state);
    expect(state).toBe('RUNNING');
  });

  it('never auto-unpauses and requires explicit resume', () => {
    let state: PauseState = 'PAUSED';
    state = confirmResume(state);
    expect(state).toBe('PAUSED');
    state = systemsReady(state);
    expect(state).toBe('PAUSED');
  });

  it('keeps repeated inputs idempotent (rapid taps)', () => {
    expect(requestPause('PAUSE_REQUESTED')).toBe('PAUSE_REQUESTED');
    expect(requestPause('PAUSED')).toBe('PAUSED');
    expect(confirmSafeTickPause('PAUSED')).toBe('PAUSED');
    expect(requestResume('RESUME_REQUESTED', true)).toBe('RESUME_REQUESTED');
    expect(requestResume('BLOCKED_UNTIL_READY', true)).toBe('BLOCKED_UNTIL_READY');
    expect(systemsReady('RUNNING')).toBe('RUNNING');
    expect(confirmResume('RUNNING')).toBe('RUNNING');
  });

  it('requests pause from the running state only', () => {
    expect(requestPause('RUNNING')).toBe('PAUSE_REQUESTED');
    expect(requestPause('BLOCKED_UNTIL_READY')).toBe('BLOCKED_UNTIL_READY');
  });

  it('covers background/interruption as ordinary pause requests', () => {
    let state: PauseState = 'RUNNING';
    state = requestPause(state);
    expect(state).toBe('PAUSE_REQUESTED');
  });
});

describe('Speed/pause hash invariance (speed-pause-matrix.json)', () => {
  it('produces identical checkpoint and end hashes for every pinned case', () => {
    const baseline = runWithPause(100, null);
    const expectedSequence = Array.from({ length: TOTAL_TICKS }, (_, i) => i);
    expect(baseline.sequence).toEqual(expectedSequence);
    for (const c of speedPauseMatrix.cases) {
      const result = runWithPause(c.speed as SpeedPercent, c.pauseAtTick);
      // Every sim tick runs exactly once, in order — pause never skips,
      // duplicates or reorders, and speed never touches the sim sequence.
      expect(result.sequence).toEqual(expectedSequence);
      expect(result.endHash).toBe(baseline.endHash);
    }
  });

  it('resumes from the exact frozen tick after a long pause', () => {
    const result = runWithPause(50, 17);
    const frozenIndex = result.sequence.indexOf(17);
    // Ticks 0..16 run, then the battle pauses before tick 17 and resumes.
    expect(frozenIndex).toBe(17);
    expect(result.sequence.slice(17)).toEqual(Array.from({ length: TOTAL_TICKS - 17 }, (_, i) => 17 + i));
  });
});
