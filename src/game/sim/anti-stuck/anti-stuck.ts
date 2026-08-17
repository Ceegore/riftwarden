import { asX100, type X100 } from '../geometry/x100.js';

export const STUCK_TICKS = 30;
export const REPATH_COUNT = 3;
export const REPATH_WINDOW_TICKS = 120;
// §9.1 fix (GDD row: "Stopdistanz +0,1 X"): the repathed unit's legal stop
// point temporarily advances by 10 X100 — implemented as a 10-X100 reduction
// of the effective stop gap, so the unit may close the edge gap from 10 to 0
// (edges touching, never overlapping, §8.1) for this many ticks. Without the
// relief the unit at the stop point can never move, so the fix would be vacuous.
export const STUCK_RELIEF_X100 = 10;
export const STUCK_RELIEF_TICKS = 10;
export const GLOBAL_NO_PROGRESS_WARNING_TICKS = 300;
export const GLOBAL_NO_PROGRESS_RESOLVE_TICKS = 300;

/**
 * §9.1: the per-entity effective stop gap. While the repath relief window is
 * active the stop point closes by 10 X100 (gap never negative, so the unit can
 * touch the enemy edge but never overlap, §8.1). Shared by the movement system
 * and the anti-stuck recompute so they can never diverge.
 */
export function effectiveStopGap(baseStopGapX100: X100, bonusUntilTick: number | undefined, tick: number): X100 {
  if (bonusUntilTick !== undefined && bonusUntilTick > 0 && tick <= bonusUntilTick) {
    return asX100(Math.max(0, baseStopGapX100 - STUCK_RELIEF_X100));
  }
  return baseStopGapX100;
}

export interface StuckState {
  readonly noProgressTicks: number;
  readonly repathTicks: readonly number[];
  readonly laneFallbackUsed: boolean;
}

export interface StuckUpdate {
  readonly state: StuckState;
  readonly emitRepath: boolean;
  readonly requestLaneFallback: boolean;
}

/**
 * Entity anti-stuck (§9.1–9.2): 30 blocked MOVE ticks emit a repath; three
 * repaths within a rolling 120-tick window trigger a one-time neighboring-lane
 * fallback. Any real progress resets the counter.
 */
export function updateStuck(state: StuckState, tick: number, shouldMove: boolean, progressed: boolean): StuckUpdate {
  if (!shouldMove || progressed) {
    return { state: { noProgressTicks: 0, repathTicks: state.repathTicks, laneFallbackUsed: state.laneFallbackUsed }, emitRepath: false, requestLaneFallback: false };
  }
  const noProgressTicks = state.noProgressTicks + 1;
  if (noProgressTicks < STUCK_TICKS) {
    return { state: { ...state, noProgressTicks }, emitRepath: false, requestLaneFallback: false };
  }
  const repathTicks = [...state.repathTicks.filter((t) => tick - t < REPATH_WINDOW_TICKS), tick];
  const requestLaneFallback = repathTicks.length >= REPATH_COUNT && !state.laneFallbackUsed;
  return {
    state: { noProgressTicks: 0, repathTicks, laneFallbackUsed: state.laneFallbackUsed || requestLaneFallback },
    emitRepath: true,
    requestLaneFallback,
  };
}

export interface GlobalProgress {
  readonly noProgressTicks: number;
  readonly collapseTicks: number;
  readonly warned: boolean;
}

export interface GlobalProgressUpdate {
  readonly state: GlobalProgress;
  readonly warning: boolean;
  readonly endRequest: boolean;
}

/**
 * Global no-progress endcap (§9.4): 300 ticks without qualifying progress start
 * the rift-collapse timer and warn; 300 more without progress request the
 * stage-L time-limit resolution. Qualifying progress resets both counters.
 */
export function updateGlobalProgress(state: GlobalProgress, qualified: boolean): GlobalProgressUpdate {
  if (qualified) {
    return { state: { noProgressTicks: 0, collapseTicks: 0, warned: false }, warning: false, endRequest: false };
  }
  if (state.noProgressTicks < GLOBAL_NO_PROGRESS_WARNING_TICKS) {
    const noProgressTicks = state.noProgressTicks + 1;
    const warning = noProgressTicks === GLOBAL_NO_PROGRESS_WARNING_TICKS;
    return { state: { noProgressTicks, collapseTicks: warning ? 0 : state.collapseTicks, warned: state.warned || warning }, warning, endRequest: false };
  }
  const collapseTicks = state.collapseTicks + 1;
  return { state: { ...state, collapseTicks }, warning: false, endRequest: collapseTicks === GLOBAL_NO_PROGRESS_RESOLVE_TICKS };
}
