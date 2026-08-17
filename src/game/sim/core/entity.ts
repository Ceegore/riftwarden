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
}
export function validateEntity(entity: KernelEntity): void {
  if (!ID.test(entity.id)) throw new KernelInvariantError('P14_SNAPSHOT_INVALID',{field:'entity.id',value:entity.id});
  for (const [key,value] of Object.entries({maxLp:entity.maxLp,lp:entity.lp,shield:entity.shield,x100:entity.x100})) {
    if (!Number.isSafeInteger(value) || value < 0 || Object.is(value,-0)) throw new KernelInvariantError('P14_SNAPSHOT_INVALID',{entityId:entity.id,key,value});
  }
  if (entity.lp > entity.maxLp || entity.x100 > 10000) throw new KernelInvariantError('P14_SNAPSHOT_INVALID',{entityId:entity.id});
  if (entity.phase.phase === 'REMOVED' && (entity.lp !== 0 || entity.shield !== 0)) throw new KernelInvariantError('P14_SNAPSHOT_INVALID',{entityId:entity.id,reason:'removed-still-valued'});
  for (const [key,value] of Object.entries(entity.timers)) if (!Number.isSafeInteger(value) || value < 0) throw new KernelInvariantError('P14_SNAPSHOT_INVALID',{entityId:entity.id,timer:key,value});
}
