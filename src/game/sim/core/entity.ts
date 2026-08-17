import type { EntityPhaseState } from './entity-state.js';
import { KernelInvariantError } from './invariant-error.js';

const ID=/^[a-z][a-z0-9_]*$/;
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
  for (const [key,value] of Object.entries(entity.timers)) if (!Number.isSafeInteger(value) || value < 0) throw new KernelInvariantError('P14_SNAPSHOT_INVALID',{entityId:entity.id,timer:key,value});
}
