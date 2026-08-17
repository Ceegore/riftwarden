import type { BattleModel } from '../core/battle-model.js';
import { asciiCompare } from '../core/primitives.js';
import { validateEntity } from '../core/entity.js';
import { KernelInvariantError } from '../core/invariant-error.js';
import { compareScheduled } from '../scheduler/event-order.js';
import { canonicalUtf8 } from './canonical-json.js';
import { sha256Hex } from './sha256.js';
export interface BattleSnapshotData extends BattleModel { readonly checksum:string; }
export function snapshotPayload(state:BattleModel):Omit<BattleSnapshotData,'checksum'>{
  const entities=[...state.entities].sort((a,b)=>asciiCompare(a.id,b.id));const ids=new Set<string>();for(const entity of entities){validateEntity(entity);if(ids.has(entity.id))throw new KernelInvariantError('P14_DUPLICATE_ENTITY',{id:entity.id});ids.add(entity.id);}
  const streams=Object.freeze({map:state.authoritativeStreams.map,encounter:state.authoritativeStreams.encounter,rewards:state.authoritativeStreams.rewards,eventChoices:state.authoritativeStreams.eventChoices});
  return Object.freeze({schemaVersion:1,simulationVersion:state.simulationVersion,battleId:state.battleId,tick:state.tick,nextSequence:state.nextSequence,emittedEventCount:state.emittedEventCount,phase:Object.freeze({...state.phase}),entities:Object.freeze(entities.map((e)=>Object.freeze({...e,phase:Object.freeze({...e.phase}),timers:Object.freeze({...e.timers})}))),scheduledEvents:Object.freeze([...state.scheduledEvents].sort(compareScheduled)),authoritativeStreams:streams,endReason:state.endReason});
}
export function createSnapshot(state:BattleModel):BattleSnapshotData{const payload=snapshotPayload(state);return Object.freeze({...payload,checksum:sha256Hex(canonicalUtf8(payload))});}
export function verifySnapshot(snapshot:BattleSnapshotData):boolean{const {checksum,...payload}=snapshot;return sha256Hex(canonicalUtf8(payload))===checksum;}
export function shouldCheckpoint(tick:number,terminal:boolean):boolean{return tick%30===0||terminal;}
