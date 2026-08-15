import { strictObject, requireString, requireArray, requireInteger, rejectUnexpectedNull } from "./schema-core.mjs";
import { fail } from "./diagnostic.mjs";
const shapes={
 unit:["id","category","displayNameKey","roleTags","traitIds","baseStats","collisionRadiusX100","preferredDepths","basicAttackId","passiveAbilityIds","activeAbilityIds","targetProfileId","visualId","audioId","codexId","deprecated","replacementId"],
 ability:["id","ownerId","kind","triggerType","targetProfileId","chargeSeconds","cooldownSeconds","castSeconds","recoverySeconds","interruptPolicy","usesPerBattle","effects","telegraphId","visibilityTextKey","invalidTargetPolicy","logTags","deprecated","replacementId"],
 status:["id","kind","stackPolicy","maxStacks","durationCapSeconds","dispelCategory","bossPolicy","statModifiers","periodicEffects","deprecated","replacementId"],
 targetProfile:["id","targetKind","lanePolicy","selection","maxRangeX100"],
 encounter:["id","regionId","kind","enemySlots","modifierIds","reinforcementWaves","objective","rewardTableId","previewDisclosureKey","allowedModes"],
 mission:["id","act","sequence","titleKey","objective","mapProfileId","mandatoryNodeRules","encounterPoolIds","firstCompletionRewardTableId","repeatRewardTableId","unlockFlags","storyEntryKeys","minVisitedNodes","maxVisitedNodes"],
 event:["id","regionTags","riskTier","titleKey","bodyKey","prerequisites","options","deterministicRollSlots","repeatPolicy"],
 rewardTable:["id","entries"], item:["id","category","displayNameKey","compatibilityUnitIds","baseStatMods","effectAbilityId","polishMods","acquisitionPoolIds","duplicateGold","deprecated","replacementId"],
 relic:["id","displayNameKey","rarity","effectAbilityIds","maxCopies","durationScope","poolTags","unlockCondition","merchantValue"],
 screen:["id","screenKey","titleKey","iconVisualId","happyPathTestId"], visual:["id","ownerPhase","status","altTextKey"], audio:["id","ownerPhase","status","captionKey"]
};
const nullable={unit:["replacementId"],ability:["chargeSeconds","cooldownSeconds","usesPerBattle","replacementId"],status:["durationCapSeconds","replacementId"],item:["effectAbilityId","replacementId"]};
export function validateEntityShape(type, entity, context){ const fields=shapes[type]; if(!fields) fail("P09_SCHEMA_TYPE",`Unknown entity type ${type}`,context); strictObject(entity,fields,context); rejectUnexpectedNull(entity,nullable[type]??[],context); requireString(entity,"id",context);
  if(type==="unit"){ requireString(entity,"displayNameKey",context); requireArray(entity,"roleTags",context); requireArray(entity,"traitIds",context); requireArray(entity,"preferredDepths",context); requireArray(entity,"passiveAbilityIds",context); requireArray(entity,"activeAbilityIds",context); }
  if(type==="ability"){ requireArray(entity,"effects",context); if(entity.effects.length===0) fail("P09_SCHEMA_RANGE","Ability effects empty",context); }
  if(type==="event"){ requireArray(entity,"options",context); if(entity.options.length<2||entity.options.length>3) fail("P09_SEMANTIC_EVENT","Event requires 2 or 3 options",context); }
  if(type==="mission"){ requireInteger(entity,"minVisitedNodes",context,5,5); requireInteger(entity,"maxVisitedNodes",context,8,8); }
}
