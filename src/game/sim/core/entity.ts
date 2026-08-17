import type { EntityPhaseState } from './entity-state.js';
import type { LaneChange } from '../movement/lane-change.js';
import { KernelInvariantError } from './invariant-error.js';

const ID=/^[a-z][a-z0-9_]*$/;
const LANES=['top','middle','bottom'] as const;
type Lane=(typeof LANES)[number];
const LANE_INDEX:Readonly<Record<Lane,number>>=Object.freeze({top:0,middle:1,bottom:2});

export interface KernelEntity {
  readonly id: string;
  readonly side: 'player'|'enemy';
  readonly phase: EntityPhaseState;
  readonly maxLp: number;
  readonly lp: number;
  readonly shield: number;
  readonly lane: 'top'|'middle'|'bottom';
  readonly x100: number;
  readonly targetId: string|null;
  readonly timers: Readonly<Record<string,number>>;
  // Phase 15 additive fields. Absent on Phase 14 fixtures; when present they
  // are authoritative and projected into the snapshot (§11).
  readonly radiusX100?: number;
  readonly movementRemainder?: number;
  readonly laneChange?: LaneChange|null;
  readonly normalLaneChangeCooldownUntilTick?: number;
  readonly noProgressTicks?: number;
  readonly repathTicks?: readonly number[];
  readonly laneFallbackUsed?: boolean;
  readonly stuckStopGapBonusUntilTick?: number;
  readonly frontDeadlockBlockedTicks?: number;
  readonly deadlockBuffConsumed?: boolean;
  readonly deadlockBuffedEntityId?: string|null;
}

function isLane(value:unknown):value is Lane { return typeof value==='string' && (LANES as readonly string[]).includes(value); }

export function validateLaneChange(lc: LaneChange): void {
  if (!isLane(lc.from) || !isLane(lc.to)) throw new KernelInvariantError('P14_SNAPSHOT_INVALID',{field:'laneChange.lane',from:lc.from,to:lc.to});
  if (Math.abs(LANE_INDEX[lc.from]-LANE_INDEX[lc.to])!==1) throw new KernelInvariantError('P14_SNAPSHOT_INVALID',{field:'laneChange.adjacency',from:lc.from,to:lc.to});
  if (!Number.isInteger(lc.progressTicks) || lc.progressTicks < 0 || lc.progressTicks >= 36) throw new KernelInvariantError('P14_SNAPSHOT_INVALID',{field:'laneChange.progressTicks',value:lc.progressTicks});
  if (!Number.isSafeInteger(lc.initiatedTick) || lc.initiatedTick < 0) throw new KernelInvariantError('P14_SNAPSHOT_INVALID',{field:'laneChange.initiatedTick',value:lc.initiatedTick});
  const reason: unknown = lc.reason;
  if (reason !== 'normal' && reason !== 'ability') throw new KernelInvariantError('P14_SNAPSHOT_INVALID',{field:'laneChange.reason',value:lc.reason});
  if (!ID.test(lc.sourceId)) throw new KernelInvariantError('P14_SNAPSHOT_INVALID',{field:'laneChange.sourceId',value:lc.sourceId});
}

export function validateEntity(entity: KernelEntity): void {
  if (!ID.test(entity.id)) throw new KernelInvariantError('P14_SNAPSHOT_INVALID',{field:'entity.id',value:entity.id});
  for (const [key,value] of Object.entries({maxLp:entity.maxLp,lp:entity.lp,shield:entity.shield,x100:entity.x100})) {
    if (!Number.isSafeInteger(value) || value < 0 || Object.is(value,-0)) throw new KernelInvariantError('P14_SNAPSHOT_INVALID',{entityId:entity.id,key,value});
  }
  if (entity.lp > entity.maxLp || entity.x100 > 10000) throw new KernelInvariantError('P14_SNAPSHOT_INVALID',{entityId:entity.id});
  if (entity.phase.phase === 'REMOVED' && (entity.lp !== 0 || entity.shield !== 0)) throw new KernelInvariantError('P14_SNAPSHOT_INVALID',{entityId:entity.id,reason:'removed-still-valued'});
  if (entity.radiusX100 !== undefined && (!Number.isSafeInteger(entity.radiusX100) || entity.radiusX100 < 0 || Object.is(entity.radiusX100, -0))) throw new KernelInvariantError('P14_SNAPSHOT_INVALID',{entityId:entity.id,field:'radiusX100',value:entity.radiusX100});
  if (entity.movementRemainder !== undefined && (!Number.isInteger(entity.movementRemainder) || entity.movementRemainder < 0 || entity.movementRemainder >= 30 || Object.is(entity.movementRemainder, -0))) throw new KernelInvariantError('P14_SNAPSHOT_INVALID',{entityId:entity.id,field:'movementRemainder',value:entity.movementRemainder});
  if (entity.laneChange !== undefined && entity.laneChange !== null) {
    validateLaneChange(entity.laneChange);
  }
  if (entity.normalLaneChangeCooldownUntilTick !== undefined && (!Number.isSafeInteger(entity.normalLaneChangeCooldownUntilTick) || entity.normalLaneChangeCooldownUntilTick < 0 || Object.is(entity.normalLaneChangeCooldownUntilTick, -0))) throw new KernelInvariantError('P14_SNAPSHOT_INVALID',{entityId:entity.id,field:'normalLaneChangeCooldownUntilTick',value:entity.normalLaneChangeCooldownUntilTick});
  if (entity.noProgressTicks !== undefined && (!Number.isSafeInteger(entity.noProgressTicks) || entity.noProgressTicks < 0 || Object.is(entity.noProgressTicks, -0))) throw new KernelInvariantError('P14_SNAPSHOT_INVALID',{entityId:entity.id,field:'noProgressTicks',value:entity.noProgressTicks});
  if (entity.repathTicks !== undefined) {
    if (!Array.isArray(entity.repathTicks)) throw new KernelInvariantError('P14_SNAPSHOT_INVALID',{entityId:entity.id,field:'repathTicks'});
    for (const value of entity.repathTicks) if (!Number.isSafeInteger(value) || value < 0) throw new KernelInvariantError('P14_SNAPSHOT_INVALID',{entityId:entity.id,field:'repathTicks',value});
  }
  if (entity.stuckStopGapBonusUntilTick !== undefined && (!Number.isSafeInteger(entity.stuckStopGapBonusUntilTick) || entity.stuckStopGapBonusUntilTick < 0 || Object.is(entity.stuckStopGapBonusUntilTick, -0))) throw new KernelInvariantError('P14_SNAPSHOT_INVALID',{entityId:entity.id,field:'stuckStopGapBonusUntilTick',value:entity.stuckStopGapBonusUntilTick});
  if (entity.laneFallbackUsed !== undefined && typeof entity.laneFallbackUsed !== 'boolean') throw new KernelInvariantError('P14_SNAPSHOT_INVALID',{entityId:entity.id,field:'laneFallbackUsed',value:entity.laneFallbackUsed});
  if (entity.frontDeadlockBlockedTicks !== undefined && (!Number.isSafeInteger(entity.frontDeadlockBlockedTicks) || entity.frontDeadlockBlockedTicks < 0 || Object.is(entity.frontDeadlockBlockedTicks, -0))) throw new KernelInvariantError('P14_SNAPSHOT_INVALID',{entityId:entity.id,field:'frontDeadlockBlockedTicks',value:entity.frontDeadlockBlockedTicks});
  if (entity.deadlockBuffConsumed !== undefined && typeof entity.deadlockBuffConsumed !== 'boolean') throw new KernelInvariantError('P14_SNAPSHOT_INVALID',{entityId:entity.id,field:'deadlockBuffConsumed',value:entity.deadlockBuffConsumed});
  if (entity.deadlockBuffedEntityId !== undefined && entity.deadlockBuffedEntityId !== null && !ID.test(entity.deadlockBuffedEntityId)) throw new KernelInvariantError('P14_SNAPSHOT_INVALID',{entityId:entity.id,field:'deadlockBuffedEntityId',value:entity.deadlockBuffedEntityId});
  for (const [key,value] of Object.entries(entity.timers)) if (!Number.isSafeInteger(value) || value < 0) throw new KernelInvariantError('P14_SNAPSHOT_INVALID',{entityId:entity.id,timer:key,value});
}
