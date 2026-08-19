import type { BattleModel } from '../core/battle-model.js';
import { asciiCompare } from '../core/primitives.js';
import { validateEntity } from '../core/entity.js';
import { KernelInvariantError } from '../core/invariant-error.js';
import { compareScheduled } from '../scheduler/event-order.js';
import { createStatusCollection } from '../status/status-collection.js';
import { createAbilityCollection } from '../ability/ability-collection.js';
import { canonicalizeEffectBatch } from '../ability/effect-executor.js';
import { createTemporaryCollection } from '../summon/temporary-registry.js';
import { canonicalizeSynergyTiers } from '../synergy/synergy-counter.js';
import { createModifierCollection } from '../world/modifier-system.js';
import { createHazardCollection } from '../world/hazard-system.js';
import { createObjectiveCollection } from '../objectives/combat-objective.js';
import { canonicalUtf8 } from './canonical-json.js';
import { sha256Hex } from './sha256.js';
export interface BattleSnapshotData extends BattleModel { readonly checksum:string; }
export function snapshotPayload(state:BattleModel):Omit<BattleSnapshotData,'checksum'>{
  const entities=[...state.entities].sort((a,b)=>asciiCompare(a.id,b.id));const ids=new Set<string>();for(const entity of entities){validateEntity(entity);if(ids.has(entity.id))throw new KernelInvariantError('P14_DUPLICATE_ENTITY',{id:entity.id});ids.add(entity.id);}
  const streams=Object.freeze({map:state.authoritativeStreams.map,encounter:state.authoritativeStreams.encounter,rewards:state.authoritativeStreams.rewards,eventChoices:state.authoritativeStreams.eventChoices});
  const extras:Record<string,unknown>={};
  if(state.globalNoProgressTicks!==undefined)extras['globalNoProgressTicks']=state.globalNoProgressTicks;
  if(state.riftCollapseTicks!==undefined)extras['riftCollapseTicks']=state.riftCollapseTicks;
  if(state.riftCollapseWarningEmitted!==undefined)extras['riftCollapseWarningEmitted']=state.riftCollapseWarningEmitted;
  if(state.projectiles!==undefined)extras['projectiles']=state.projectiles;
  if(state.pendingCombatApplications!==undefined)extras['pendingCombatApplications']=state.pendingCombatApplications;
  if(state.combatApplicationSeq!==undefined)extras['combatApplicationSeq']=state.combatApplicationSeq;
  if(state.statuses!==undefined)extras['statuses']=createStatusCollection(state.statuses);
  if(state.pendingCleanses!==undefined)extras['pendingCleanses']=state.pendingCleanses;
  if(state.abilities!==undefined)extras['abilities']=createAbilityCollection(state.abilities);
  if(state.plannedEffects!==undefined)extras['plannedEffects']=canonicalizeEffectBatch(state.plannedEffects);
  if(state.previousTickLp!==undefined)extras['previousTickLp']=Object.freeze({...state.previousTickLp});
  if(state.previousTickEvents!==undefined)extras['previousTickEvents']=Object.freeze(state.previousTickEvents.map((e)=>Object.freeze({type:e.type,sourceId:e.sourceId,targetIds:Object.freeze([...e.targetIds])})));
  if(state.temporaryEntities!==undefined)extras['temporaryEntities']=createTemporaryCollection(state.temporaryEntities);
  if(state.synergyTiers!==undefined)extras['synergyTiers']=canonicalizeSynergyTiers(state.synergyTiers);
  if(state.bossPhase!==undefined)extras['bossPhase']=Object.freeze({bossId:state.bossPhase.bossId,phaseId:state.bossPhase.phaseId,transition:state.bossPhase.transition===null?null:Object.freeze({from:state.bossPhase.transition.from,to:state.bossPhase.transition.to,startTick:state.bossPhase.transition.startTick,commitTick:state.bossPhase.transition.commitTick}),visited:Object.freeze([...state.bossPhase.visited].sort(asciiCompare)),invulnerableUntilTick:state.bossPhase.invulnerableUntilTick});
  if(state.modifiers!==undefined)extras['modifiers']=createModifierCollection(state.modifiers);
  if(state.hazards!==undefined)extras['hazards']=createHazardCollection(state.hazards);
  if(state.objectives!==undefined)extras['objectives']=createObjectiveCollection(state.objectives);
  if(state.spawnedWaves!==undefined)extras['spawnedWaves']=Object.freeze([...state.spawnedWaves].sort(asciiCompare));
  return Object.freeze({schemaVersion:1,simulationVersion:state.simulationVersion,battleId:state.battleId,tick:state.tick,nextSequence:state.nextSequence,emittedEventCount:state.emittedEventCount,phase:Object.freeze({...state.phase}),entities:Object.freeze(entities.map((e)=>Object.freeze({...e,phase:Object.freeze({...e.phase}),timers:Object.freeze({...e.timers})}))),scheduledEvents:Object.freeze([...state.scheduledEvents].sort(compareScheduled)),authoritativeStreams:streams,endReason:state.endReason,...extras});
}
export function createSnapshot(state:BattleModel):BattleSnapshotData{const payload=snapshotPayload(state);return Object.freeze({...payload,checksum:sha256Hex(canonicalUtf8(payload))});}
export function verifySnapshot(snapshot:BattleSnapshotData):boolean{
  const {checksum,...payload}=snapshot;
  // Re-run the same canonicalization/validation as createSnapshot so unsorted
  // seeds (e.g. raw status collections) verify symmetrically.
  const canonical=snapshotPayload(payload);
  return sha256Hex(canonicalUtf8(canonical))===checksum;
}
export function shouldCheckpoint(tick:number,terminal:boolean):boolean{return tick%30===0||terminal;}
