import { fail } from "./diagnostic.mjs";
export const PREFIXES = Object.freeze({
 unit: ["hero_","troop_","summon_","enemy_","boss_"], ability:["ability_","attack_"], status:["status_"],
 targetProfile:["target_"], encounter:["encounter_"], mission:["mission_"], event:["event_"], rewardTable:["reward_"],
 item:["item_","talisman_","kit_","banner_"], relic:["relic_"], screen:["screen_"], visual:["visual_"], audio:["audio_"]
});
export function validateId(id, entityType, sourcePath) {
  if(typeof id!=="string" || !/^[a-z][a-z0-9_]*$/.test(id)) fail("P09_ID_FORMAT",`Invalid ID ${String(id)}`,{sourcePath,entityId:id});
  const prefixes=PREFIXES[entityType];
  if(!prefixes?.some((p)=>id.startsWith(p))) fail("P09_ID_NAMESPACE",`ID ${id} does not match ${entityType}`,{sourcePath,entityId:id,expected:prefixes});
}
export function buildIdRegistry(envelopes) {
  const registry=new Map();
  for(const envelope of envelopes) for(const entity of envelope.entities){
    validateId(entity.id,envelope.entityType,envelope.sourcePath);
    if(registry.has(entity.id)) fail("P09_ID_COLLISION",`Duplicate global ID ${entity.id}`,{sourcePath:envelope.sourcePath,entityId:entity.id,first:registry.get(entity.id)});
    registry.set(entity.id,{type:envelope.entityType,entity,sourcePath:envelope.sourcePath});
  }
  return registry;
}
export function requireRef(registry,id,expectedTypes,context){
  const found=registry.get(id); if(!found) fail("P09_REF_MISSING",`Missing ref ${id}`,{...context,entityId:context.entityId,referenceId:id});
  if(!expectedTypes.includes(found.type)) fail("P09_REF_TYPE",`Ref ${id} has type ${found.type}`,{...context,referenceId:id,expectedTypes,actualType:found.type});
  return found;
}
