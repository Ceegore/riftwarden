import { requireRef } from "./ids.mjs";
import { fail } from "./diagnostic.mjs";
function refsFor(type,e){
 const r=[]; const add=(id,types,field)=>{if(id!==null&&id!==undefined)r.push([id,types,field]);}; const adds=(ids,types,field)=>{for(const id of ids??[])add(id,types,field);};
 if(type==="unit"){add(e.basicAttackId,["ability"],"basicAttackId");adds(e.passiveAbilityIds,["ability"],"passiveAbilityIds");adds(e.activeAbilityIds,["ability"],"activeAbilityIds");add(e.targetProfileId,["targetProfile"],"targetProfileId");add(e.visualId,["visual"],"visualId");add(e.audioId,["audio"],"audioId");add(e.codexId,["screen"],"codexId");add(e.replacementId,["unit"],"replacementId");}
 if(type==="ability"){add(e.ownerId,["unit","item","relic"],"ownerId");add(e.targetProfileId,["targetProfile"],"targetProfileId");add(e.telegraphId,["visual"],"telegraphId");add(e.replacementId,["ability"],"replacementId");for(const x of e.effects??[]){add(x.statusId,["status"],"effects.statusId");add(x.summonId,["unit"],"effects.summonId");}}
 if(type==="status"){add(e.replacementId,["status"],"replacementId");for(const x of e.periodicEffects??[])add(x.effectAbilityId,["ability"],"periodicEffects.effectAbilityId");}
 if(type==="encounter"){for(const x of e.enemySlots??[])add(x.unitId,["unit"],"enemySlots.unitId");add(e.rewardTableId,["rewardTable"],"rewardTableId");for(const x of e.reinforcementWaves??[])add(x.encounterId,["encounter"],"reinforcementWaves.encounterId");}
 if(type==="mission"){adds(e.encounterPoolIds,["encounter"],"encounterPoolIds");add(e.firstCompletionRewardTableId,["rewardTable"],"firstCompletionRewardTableId");add(e.repeatRewardTableId,["rewardTable"],"repeatRewardTableId");}
 if(type==="item"){adds(e.compatibilityUnitIds,["unit"],"compatibilityUnitIds");add(e.effectAbilityId,["ability"],"effectAbilityId");adds(e.acquisitionPoolIds,["rewardTable"],"acquisitionPoolIds");add(e.replacementId,["item"],"replacementId");}
 if(type==="relic")adds(e.effectAbilityIds,["ability"],"effectAbilityIds");
 if(type==="screen")add(e.iconVisualId,["visual"],"iconVisualId");
 return r;
}
function localizationKeys(value, out=[]){ if(Array.isArray(value)) value.forEach((x)=>localizationKeys(x,out)); else if(value&&typeof value==="object") for(const [k,v] of Object.entries(value)){ if(k.endsWith("Key")&&typeof v==="string")out.push(v); else if(k.endsWith("Keys")&&Array.isArray(v))out.push(...v); localizationKeys(v,out); } return out; }
export function validateCrossReferences(envelopes, registry, localeKeys){
 for(const env of envelopes) for(const entity of env.entities){ const context={sourcePath:env.sourcePath,entityId:entity.id}; for(const [id,types,field] of refsFor(env.entityType,entity)) requireRef(registry,id,types,{...context,field}); for(const key of localizationKeys(entity)) if(!localeKeys.de.has(key)||!localeKeys.en.has(key)) fail("P09_LOCALIZATION_KEY_MISSING",`Missing locale key ${key}`,{...context,key}); }
}
