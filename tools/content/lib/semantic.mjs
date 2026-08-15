import { fail } from "./diagnostic.mjs";
export function validateSemantics(envelopes, registry){
 for(const env of envelopes) for(const e of env.entities){ const c={sourcePath:env.sourcePath,entityId:e.id};
  if(env.entityType==="unit"){
   const basic=registry.get(e.basicAttackId); if(!basic||basic.type!=="ability"||basic.entity.kind!=="basic_attack") fail("P09_SEMANTIC_UNIT","Unit requires exactly one basic attack",c);
   if(e.traitIds.length>2||e.preferredDepths.length===0) fail("P09_SEMANTIC_UNIT","Unit trait/depth contract invalid",c);
  }
  if(env.entityType==="ability" && (!e.invalidTargetPolicy||!e.telegraphId||e.effects.length===0)) fail("P09_SEMANTIC_ABILITY","Ability contract incomplete",c);
  if(env.entityType==="event"){ const used=new Set(); for(const slot of e.deterministicRollSlots){if(used.has(slot))fail("P09_SEMANTIC_EVENT","Duplicate rollslot",c);used.add(slot);} for(const o of e.options) if(o.rollSlot&&!used.has(o.rollSlot))fail("P09_SEMANTIC_EVENT","Option rollslot undeclared",c); }
  if(env.entityType==="mission" && (e.minVisitedNodes!==5||e.maxVisitedNodes!==8||e.encounterPoolIds.length===0)) fail("P09_SEMANTIC_MISSION","Mission constraints invalid",c);
 }
}
