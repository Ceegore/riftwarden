import { KernelInvariantError } from '../core/invariant-error.js';
import type { Lane, X100 } from '../geometry/x100.js';
import type { LaneChange } from '../movement/lane-change.js';

export interface Phase15EntitySnapshot {
  readonly id: string;
  readonly x100: X100;
  readonly radiusX100: X100;
  readonly lane: Lane;
  readonly movementRemainder: number;
  readonly laneChange: LaneChange | null;
  readonly normalLaneChangeCooldownUntilTick: number;
  readonly overtakeGrant: { readonly effectId: string; readonly endTick: number } | null;
  readonly noProgressTicks: number;
  readonly repathTicks: readonly number[];
  readonly laneFallbackUsed: boolean;
  readonly deadlockBuffConsumed: boolean;
  readonly frontDeadlockBlockedTicks: number;
}

export interface Phase15BattleSnapshot {
  readonly globalNoProgressTicks: number;
  readonly riftCollapseTicks: number;
  readonly riftCollapseWarningEmitted: boolean;
}

/** Rejects invalid Phase 15 projections; no silent defaults on resume (§11). */
export function validatePhase15EntitySnapshot(snapshot: Phase15EntitySnapshot): void {
  if (!Number.isSafeInteger(snapshot.x100) || snapshot.x100 < 0 || snapshot.x100 > 10000) {
    throw new KernelInvariantError('P15_SNAPSHOT_INCOMPATIBLE', { field: 'x100', value: snapshot.x100 });
  }
  if (!Number.isSafeInteger(snapshot.radiusX100) || snapshot.radiusX100 < 0) {
    throw new KernelInvariantError('P15_SNAPSHOT_INCOMPATIBLE', { field: 'radiusX100', value: snapshot.radiusX100 });
  }
  if (!Number.isInteger(snapshot.movementRemainder) || snapshot.movementRemainder < 0 || snapshot.movementRemainder >= 30) {
    throw new KernelInvariantError('P15_SNAPSHOT_INCOMPATIBLE', { field: 'movementRemainder', value: snapshot.movementRemainder });
  }
  if (!Number.isSafeInteger(snapshot.normalLaneChangeCooldownUntilTick) || snapshot.normalLaneChangeCooldownUntilTick < 0) {
    throw new KernelInvariantError('P15_SNAPSHOT_INCOMPATIBLE', { field: 'normalLaneChangeCooldownUntilTick', value: snapshot.normalLaneChangeCooldownUntilTick });
  }
  for (const value of [snapshot.noProgressTicks, snapshot.frontDeadlockBlockedTicks]) {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new KernelInvariantError('P15_SNAPSHOT_INCOMPATIBLE', { value });
    }
  }
}

export function validatePhase15BattleSnapshot(snapshot: Phase15BattleSnapshot): void {
  for (const value of [snapshot.globalNoProgressTicks, snapshot.riftCollapseTicks]) {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new KernelInvariantError('P15_SNAPSHOT_INCOMPATIBLE', { value });
    }
  }
}
