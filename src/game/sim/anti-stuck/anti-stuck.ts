export const STUCK_TICKS = 30;
export const REPATH_COUNT = 3;
export const REPATH_WINDOW_TICKS = 120;
export const GLOBAL_NO_PROGRESS_WARNING_TICKS = 300;
export const GLOBAL_NO_PROGRESS_RESOLVE_TICKS = 300;

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
