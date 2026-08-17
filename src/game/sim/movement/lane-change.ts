import { KernelInvariantError } from '../core/invariant-error.js';
import type { Tick } from '../core/primitives.js';
import { LANE_ORDINAL, type Lane } from '../geometry/x100.js';

export const LANE_CHANGE_DURATION_TICKS = 36;
export const LANE_LOGICAL_SWITCH_TICK = 18;
export const NORMAL_LANE_CHANGE_COOLDOWN_TICKS = 90;

export interface LaneChange {
  readonly from: Lane;
  readonly to: Lane;
  readonly progressTicks: number;
  readonly initiatedTick: Tick;
  readonly reason: 'normal' | 'ability';
  readonly sourceId: string;
}

export interface LaneAdvance {
  readonly state: LaneChange | null;
  readonly logicalLane: Lane;
  readonly switched: boolean;
  readonly completed: boolean;
}

/** Starts a lane change; only adjacent lanes are legal (top↔bottom is not). */
export function startLaneChange(
  from: Lane,
  to: Lane,
  initiatedTick: Tick,
  sourceId: string,
  reason: 'normal' | 'ability' = 'normal',
  progressTicks = 0,
): LaneChange {
  if (Math.abs(LANE_ORDINAL[from] - LANE_ORDINAL[to]) !== 1) {
    throw new KernelInvariantError('P15_LANECHANGE_DIRECT_NON_ADJACENT', { from, to });
  }
  return Object.freeze({ from, to, progressTicks, initiatedTick, reason, sourceId });
}

/** Advances one tick; the logical lane switches at 18, completes at 36. */
export function advanceLaneChange(s: LaneChange, logicalLane: Lane): LaneAdvance {
  if (s.progressTicks < 0 || s.progressTicks >= LANE_CHANGE_DURATION_TICKS) {
    throw new KernelInvariantError('P15_LANECHANGE_STATE_INVALID', { progressTicks: s.progressTicks });
  }
  const progressTicks = s.progressTicks + 1;
  const switched = progressTicks === LANE_LOGICAL_SWITCH_TICK;
  const completed = progressTicks === LANE_CHANGE_DURATION_TICKS;
  return Object.freeze({
    state: completed ? null : Object.freeze({ ...s, progressTicks }),
    logicalLane: switched ? s.to : logicalLane,
    switched,
    completed,
  });
}

/** 20% threat qualification using integer arithmetic (candidate*100 >= current*120). */
export function laneThreatQualifies(current: number, candidate: number): boolean {
  if (!Number.isSafeInteger(current) || !Number.isSafeInteger(candidate) || current < 0 || candidate < 0) {
    throw new KernelInvariantError('P15_X100_NOT_INTEGER', { current, candidate });
  }
  return candidate * 100 >= current * 120;
}
