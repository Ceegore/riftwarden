import { fail } from "./diagnostic.mjs";

function checkUnit(entity, _type, registry, context) {
  const basic = registry.get(entity.basicAttackId);
  if (!basic || basic.type !== "ability" || basic.entity.kind !== "basic_attack") fail("P09_SEMANTIC_UNIT", "Unit requires exactly one basic attack", context);
  if (entity.traitIds.length > 2 || entity.preferredDepths.length === 0) fail("P09_SEMANTIC_UNIT", "Unit trait/depth contract invalid", context);
}

function checkAbility(entity, _type, _registry, context) {
  if (!entity.invalidTargetPolicy || !entity.telegraphId || entity.effects.length === 0) fail("P09_SEMANTIC_ABILITY", "Ability contract incomplete", context);
}

function checkEvent(entity, _type, _registry, context) {
  const used = new Set();
  for (const slot of entity.deterministicRollSlots) { if (used.has(slot)) fail("P09_SEMANTIC_EVENT", "Duplicate rollslot", context); used.add(slot); }
  for (const option of entity.options) if (option.rollSlot && !used.has(option.rollSlot)) fail("P09_SEMANTIC_EVENT", "Option rollslot undeclared", context);
}

// Warning (allowlist-able): a unit/ability referencing an asset that is only
// "planned" (not yet produced) must be tracked explicitly.
function warnPlannedAsset(entity, type, registry, context) {
  const refs = type === "unit"
    ? [["visualId", entity.visualId], ["audioId", entity.audioId]]
    : type === "ability"
      ? [["telegraphId", entity.telegraphId]]
      : [];
  const warnings = [];
  for (const [field, id] of refs) {
    const target = registry.get(id);
    if (target && (target.type === "visual" || target.type === "audio") && target.entity.status === "planned") {
      warnings.push({ code: "P09_WARNING_PLANNED_ASSET", sourcePath: context.sourcePath, entityId: context.entityId, field });
    }
  }
  return warnings;
}

// Deterministic: sorted once by code so validator order never depends on
// object insertion order.
const VALIDATORS = Object.freeze([
  { code: "P09_SEMANTIC_ABILITY", types: ["ability"], run: checkAbility },
  { code: "P09_SEMANTIC_EVENT", types: ["event"], run: checkEvent },
  { code: "P09_SEMANTIC_UNIT", types: ["unit"], run: checkUnit },
  { code: "P09_WARNING_PLANNED_ASSET", types: ["unit", "ability"], run: warnPlannedAsset },
].sort((a, b) => (a.code < b.code ? -1 : a.code > b.code ? 1 : 0)));

export function validateSemantics(envelopes, registry) {
  const warnings = [];
  for (const env of envelopes) for (const entity of env.entities) {
    const context = { sourcePath: env.sourcePath, entityId: entity.id };
    for (const validator of VALIDATORS) {
      if (!validator.types.includes(env.entityType)) continue;
      const result = validator.run(entity, env.entityType, registry, context) ?? [];
      if (Array.isArray(result)) warnings.push(...result);
    }
  }
  return { warnings };
}
