import { asX100, type Lane } from '../geometry/x100.js';

export const FRONT_DEADLOCK_TICKS = 60;
export const DEADLOCK_MELEE_BONUS_X100 = asX100(50);

export interface DeadlockCandidate {
  readonly entityId: string;
  readonly lane: Lane;
  readonly edgeDistanceX100: number;
}

export interface FrontDeadlockState {
  readonly blockedTicks: number;
  readonly buffedEntityId: string | null;
  readonly buffConsumed: boolean;
}

export interface FrontDeadlockUpdate {
  readonly state: FrontDeadlockState;
  readonly grantMeleeBuff: boolean;
  readonly buffEntityId: string | null;
}

const LANE_ORDINAL: Readonly<Record<Lane, number>> = Object.freeze({ top: 0, middle: 1, bottom: 2 });

/**
 * Selection per §9.3: smallest edge distance, then lane ordinal, then entity id.
 * Returns null when no candidate is available.
 */
export function selectDeadlockBuffTarget(candidates: readonly DeadlockCandidate[]): string | null {
  const sorted = [...candidates].sort(
    (a, b) =>
      a.edgeDistanceX100 - b.edgeDistanceX100 ||
      LANE_ORDINAL[a.lane] - LANE_ORDINAL[b.lane] ||
      (a.entityId < b.entityId ? -1 : a.entityId > b.entityId ? 1 : 0),
  );
  return sorted[0]?.entityId ?? null;
}

/**
 * Front-deadlock counter (§9.3): 60 consecutive ticks with both fronts blocked
 * and no damage/cast/progress grant the nearest regular unit per side a
 * temporary +50 X100 melee range until its first hit. The buff is snapshotable,
 * non-stacking and ends on first hit or battle end.
 */
export function updateFrontDeadlock(
  state: FrontDeadlockState,
  bothFrontsBlocked: boolean,
  qualified: boolean,
  candidates: readonly DeadlockCandidate[],
): FrontDeadlockUpdate {
  if (!bothFrontsBlocked || qualified || state.buffConsumed) {
    return { state: { blockedTicks: 0, buffedEntityId: null, buffConsumed: state.buffConsumed }, grantMeleeBuff: false, buffEntityId: null };
  }
  const blockedTicks = state.blockedTicks + 1;
  if (blockedTicks < FRONT_DEADLOCK_TICKS) {
    return { state: { ...state, blockedTicks }, grantMeleeBuff: false, buffEntityId: null };
  }
  const buffEntityId = selectDeadlockBuffTarget(candidates);
  return {
    state: { blockedTicks, buffedEntityId: buffEntityId, buffConsumed: false },
    grantMeleeBuff: true,
    buffEntityId,
  };
}
