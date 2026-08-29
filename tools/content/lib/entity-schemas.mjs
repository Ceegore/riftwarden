import { z } from "zod";
import { fail } from "./diagnostic.mjs";
// Boundary units — runtime mirror of content/schemas/common.ts.
// `.brand()` is intentionally omitted: it is compile-time only in the .ts
// source and has no runtime parse behavior; the effective constraints match.
const ContentId = z.string().regex(/^[a-z][a-z0-9_]*$/);
const LocalizationKey = z.string().regex(/^(content|ui)\.[a-z0-9_.]+$/);
const MilliValue = z.number().int();
const NonNegativeMilliValue = MilliValue.refine((value) => value >= 0);
const BasisPoints = z.number().int().min(0).max(50000);
const CurrencyAmount = z.number().int().nonnegative();
// Nested shapes — runtime mirror of the corresponding .ts schema files.
const UnitStats = z.object({
  maxHp: NonNegativeMilliValue,
  armor: z.number().int(),
  resistance: z.number().int(),
  attackPower: NonNegativeMilliValue,
  attackIntervalSeconds: z.number().positive(),
  preparationSeconds: z.number().nonnegative(),
  rangeX100: z.number().int().nonnegative(),
  movementX100PerSecond: z.number().int().nonnegative(),
  controlResistanceBps: BasisPoints,
}).strict();

const EffectSource = z.object({
  type: z.enum(["damage", "heal", "shield", "apply_status", "summon", "move"]),
  magnitude: z.number().int(),
  scalingSource: z.enum(["none", "attack_power", "max_hp", "target_max_hp"]),
  damageType: z.enum(["physical", "magical", "true"]).nullable(),
  durationSeconds: z.number().nonnegative().nullable(),
  radiusX100: z.number().int().nonnegative().nullable(),
  statusId: ContentId.nullable(),
  summonId: ContentId.nullable(),
  sourceAttribution: z.enum(["owner", "summon_owner", "effect_source"]),
}).strict();
// Two distinct modifier shapes, mirroring the .ts source exactly:
// status.statModifiers carry `operation` (status.ts), while item
// baseStatMods/polishMods do not (progression.ts).
const StatusStatModifier = z.object({
  stat: z.string().min(1),
  operation: z.enum(["add", "multiply_bps"]),
  value: z.number().int(),
}).strict();
const ItemStatModifier = z.object({
  stat: z.string().min(1),
  value: z.number().int(),
}).strict();

const PeriodicEffect = z.object({
  intervalSeconds: z.number().positive(),
  effectAbilityId: ContentId,
}).strict();

const EnemySlot = z.object({
  unitId: ContentId,
  lane: z.enum(["top", "middle", "bottom"]),
  depth: z.enum(["front", "middle", "back"]),
  eliteId: ContentId.nullable(),
}).strict();

const ReinforcementWave = z.object({
  atSeconds: z.number().nonnegative(),
  encounterId: ContentId,
}).strict();

const NodeRule = z.object({
  nodeType: z.string().min(1),
  minimum: z.number().int().nonnegative(),
}).strict();

const Prerequisite = z.object({
  kind: z.string().min(1),
  value: z.string().min(1),
}).strict();

const EventOption = z.object({
  id: z.string().regex(/^[a-z][a-z0-9_]*$/),
  labelKey: LocalizationKey,
  resultKey: LocalizationKey,
  rollSlot: z.string().regex(/^[a-z][a-z0-9_.]*$/).nullable(),
}).strict();

const RewardEntry = z.object({
  rewardType: z.enum(["gold", "item", "relic", "unlock"]),
  contentId: ContentId.nullable(),
  amount: CurrencyAmount,
  weight: z.number().int().positive(),
  rollSlot: z.string().regex(/^[a-z][a-z0-9_.]*$/),
}).strict();

// Entity schemas — field sets, enums, ranges and nullability mirror the .ts
// source 1:1. `act`/`minVisitedNodes`/`maxVisitedNodes` are expressed as
// integer ranges so diagnostics stay stable (P09_SCHEMA_RANGE).
export const ENTITY_SCHEMAS = Object.freeze({
  unit: z.object({
    id: ContentId,
    category: z.enum(["hero", "troop", "summon", "enemy", "boss", "boss_object"]),
    displayNameKey: LocalizationKey,
    roleTags: z.array(z.enum(["defender", "fighter", "breaker", "duelist", "marksman", "mage", "healer", "support", "summoner", "controller", "constructor"])).min(1),
    traitIds: z.array(ContentId).max(2),
    baseStats: UnitStats,
    collisionRadiusX100: z.number().int().positive(),
    preferredDepths: z.array(z.enum(["front", "middle", "back"])).min(1),
    basicAttackId: ContentId,
    passiveAbilityIds: z.array(ContentId),
    activeAbilityIds: z.array(ContentId),
    targetProfileId: ContentId,
    visualId: ContentId,
    audioId: ContentId,
    codexId: ContentId,
    deprecated: z.boolean(),
    replacementId: ContentId.nullable(),
  }).strict(),

  ability: z.object({
    id: ContentId,
    ownerId: ContentId,
    kind: z.enum(["passive", "basic_attack", "signature", "level3_once", "boss", "modifier", "item"]),
    triggerType: z.enum(["always", "interval", "battle_start", "hp_threshold", "ally_state", "enemy_state", "event"]),
    targetProfileId: ContentId,
    chargeSeconds: z.number().nonnegative().nullable(),
    cooldownSeconds: z.number().nonnegative().nullable(),
    castSeconds: z.number().nonnegative(),
    recoverySeconds: z.number().nonnegative(),
    interruptPolicy: z.enum(["interruptible", "cast_committed", "uninterruptible"]),
    usesPerBattle: z.number().int().positive().nullable(),
    effects: z.array(EffectSource).min(1),
    telegraphId: ContentId,
    visibilityTextKey: LocalizationKey,
    invalidTargetPolicy: z.enum(["wait", "retarget", "consume_without_effect"]),
    logTags: z.array(z.string().regex(/^[a-z][a-z0-9_]*$/)),
    deprecated: z.boolean(),
    replacementId: ContentId.nullable(),
  }).strict(),

  status: z.object({
    id: ContentId,
    kind: z.enum(["shield", "attack_up", "attack_speed_up", "move_speed_up", "resistance_up", "regeneration", "burn", "poison", "slow", "weaken", "silence", "stun", "mark", "confusion"]),
    stackPolicy: z.enum(["replace_if_stronger", "refresh_duration", "extend_duration_capped", "independent_by_source", "no_reapply"]),
    maxStacks: z.number().int().min(1),
    durationCapSeconds: z.number().nonnegative().nullable(),
    dispelCategory: z.enum(["positive", "negative", "control", "none"]),
    bossPolicy: z.enum(["normal", "duration_reduced", "convert_to_interrupt", "immune"]),
    statModifiers: z.array(StatusStatModifier),
    periodicEffects: z.array(PeriodicEffect),
    deprecated: z.boolean(),
    replacementId: ContentId.nullable(),
  }).strict(),

  targetProfile: z.object({
    id: ContentId,
    targetKind: z.enum(["enemy_unit", "allied_unit", "self", "ground_position", "summon_slot", "boss_object"]),
    lanePolicy: z.enum(["same", "adjacent_allowed", "any"]),
    selection: z.enum(["nearest", "lowest_hp", "highest_threat", "stable_id"]),
    maxRangeX100: z.number().int().nonnegative(),
  }).strict(),

  encounter: z.object({
    id: ContentId,
    regionId: ContentId,
    kind: z.enum(["normal", "elite", "boss", "survival", "reinforcement"]),
    enemySlots: z.array(EnemySlot).min(1),
    modifierIds: z.array(ContentId),
    reinforcementWaves: z.array(ReinforcementWave),
    objective: z.enum(["defeat_all", "survive", "defeat_boss", "protect_object"]),
    bossUnitId: ContentId.nullable().default(null),
    survivalDurationSeconds: z.number().nonnegative().nullable().default(null),
    bossObjects: z.array(z.object({
      entityId: ContentId,
      side: z.enum(["player", "enemy"]),
      ownerId: ContentId,
      sourceId: ContentId,
      slotId: z.enum(["boss_slot_0", "boss_slot_1", "boss_slot_2", "boss_slot_3"]),
      lane: z.enum(["top", "middle", "bottom"]),
      x100: z.number().int().nonnegative().max(10000),
      targetable: z.boolean(),
      objectiveLink: ContentId.nullable(),
      damagePolicy: z.enum(["normal", "immune", "shield_only"]),
      statusPolicy: z.enum(["allow", "block"]),
      cleanupPolicy: z.enum(["on_objective", "on_battle_end", "manual"]),
      fallback: z.enum(["FAIL", "DEFER"]),
      maxLp: z.number().int().positive(),
      radiusX100: z.number().int().positive(),
    }).strict()).default([]),
    rewardTableId: ContentId,
    previewDisclosureKey: LocalizationKey,
    allowedModes: z.array(z.enum(["campaign", "campaign_replay", "ascension", "beyond", "endless"])).min(1),
  }).strict(),

  modifier: z.object({
    id: ContentId,
    previewDisclosureKey: LocalizationKey,
    hooks: z.array(z.enum(["on_phase_entry", "on_phase_exit", "on_damage_applied", "on_spawn", "on_battle_start", "on_entity_defeated"])).min(1),
    incompatibilityTags: z.array(z.string().regex(/^[a-z][a-z0-9_]*(?:[._][a-z0-9_]+)*$/)),
    params: z.record(z.string().regex(/^[a-z][a-z0-9_]*(?:[._][a-z0-9_]+)*$/), z.number().int()),
  }).strict(),

  mission: z.object({
    id: ContentId,
    act: z.number().int().min(1).max(4),
    sequence: z.number().int().min(1).max(5),
    titleKey: LocalizationKey,
    objective: z.enum(["complete_route", "defeat_boss", "survive"]),
    mapProfileId: ContentId,
    mandatoryNodeRules: z.array(NodeRule),
    encounterPoolIds: z.array(ContentId).min(1),
    firstCompletionRewardTableId: ContentId,
    repeatRewardTableId: ContentId,
    unlockFlags: z.array(z.string().regex(/^[a-z][a-z0-9_]*$/)),
    storyEntryKeys: z.array(LocalizationKey),
    minVisitedNodes: z.number().int().min(5).max(5),
    maxVisitedNodes: z.number().int().min(8).max(8),
  }).strict(),

  event: z.object({
    id: ContentId,
    regionTags: z.array(ContentId).min(1),
    riskTier: z.number().int().min(0).max(3),
    titleKey: LocalizationKey,
    bodyKey: LocalizationKey,
    prerequisites: z.array(Prerequisite),
    options: z.array(EventOption).min(2).max(3),
    deterministicRollSlots: z.array(z.string().regex(/^[a-z][a-z0-9_.]*$/)),
    repeatPolicy: z.enum(["once_per_run", "history_limited"]),
  }).strict(),

  rewardTable: z.object({
    id: ContentId,
    entries: z.array(RewardEntry).min(1),
  }).strict(),

  item: z.object({
    id: ContentId,
    category: z.enum(["item", "talisman", "kit", "banner"]),
    displayNameKey: LocalizationKey,
    compatibilityUnitIds: z.array(ContentId),
    baseStatMods: z.array(ItemStatModifier),
    effectAbilityId: ContentId.nullable(),
    polishMods: z.array(ItemStatModifier),
    acquisitionPoolIds: z.array(ContentId).min(1),
    duplicateGold: CurrencyAmount,
    deprecated: z.boolean(),
    replacementId: ContentId.nullable(),
  }).strict(),

  relic: z.object({
    id: ContentId,
    displayNameKey: LocalizationKey,
    rarity: z.enum(["common", "uncommon", "rare", "legendary"]),
    effectAbilityIds: z.array(ContentId).min(1),
    maxCopies: z.number().int().min(1).max(8),
    durationScope: z.enum(["battle", "expedition", "run"]),
    poolTags: z.array(z.string().regex(/^[a-z][a-z0-9_]*$/)).min(1),
    unlockCondition: z.string().min(1),
    merchantValue: CurrencyAmount,
  }).strict(),

  screen: z.object({
    id: ContentId,
    screenKey: z.string().regex(/^[a-z][a-z0-9_.]*$/),
    titleKey: LocalizationKey,
    iconVisualId: ContentId,
    happyPathTestId: z.string().regex(/^E2E-[A-Z0-9-]+$/),
  }).strict(),

  visual: z.object({
    id: ContentId,
    ownerPhase: z.string().regex(/^\d{2}$/),
    status: z.enum(["planned", "required_present"]),
    altTextKey: LocalizationKey,
  }).strict(),

  audio: z.object({
    id: ContentId,
    ownerPhase: z.string().regex(/^\d{2}$/),
    status: z.enum(["planned", "required_present"]),
    captionKey: LocalizationKey,
  }).strict(),
});

function pathOf(issue) {
  return (issue.path ?? []).join(".");
}

function valueAtPath(value, path) {
  let current = value;
  for (const key of path) {
    if (current == null || typeof current !== "object") return undefined;
    current = current[key];
  }
  return current;
}

function mapZodIssue(issue, context, entity) {
  const field = pathOf(issue) || "(root)";
  switch (issue.code) {
    case "unrecognized_keys":
      return fail("P09_SCHEMA_UNKNOWN_FIELD", `Unknown field ${issue.keys?.[0] ?? field}`, { ...context, field: issue.keys?.[0] ?? field });
    case "too_small":
    case "too_big":
      return fail("P09_SCHEMA_RANGE", `Out of range ${field}`, { ...context, field });
    case "invalid_type": {
      const actual = valueAtPath(entity, issue.path ?? []);
      if (actual === undefined) return fail("P09_SCHEMA_MISSING_FIELD", `Missing ${field}`, { ...context, field });
      if (actual === null) return fail("P09_SCHEMA_NULL_FORBIDDEN", `Null forbidden for ${field}`, { ...context, field });
      return fail("P09_SCHEMA_TYPE", `Invalid type for ${field}`, { ...context, field });
    }
    case "invalid_string":
      if (field === "id") return fail("P09_ID_FORMAT", "Invalid ID format", { ...context, field: "id" });
      return fail("P09_SCHEMA_TYPE", `Invalid string format for ${field}`, { ...context, field });
    case "invalid_value":
    case "invalid_union":
    case "invalid_literal":
      return fail("P09_SCHEMA_TYPE", `Invalid value for ${field}`, { ...context, field });
    default:
      return fail("P09_SCHEMA_TYPE", `Schema violation at ${field}`, { ...context, field });
  }
}

export function validateEntityShape(type, entity, context = {}) {
  const schema = ENTITY_SCHEMAS[type];
  if (!schema) fail("P09_SCHEMA_TYPE", `Unknown entity type ${type}`, context);
  if (!entity || typeof entity !== "object" || Array.isArray(entity)) fail("P09_SCHEMA_TYPE", "Expected object", context);
  const result = schema.safeParse(entity);
  if (!result.success) return mapZodIssue(result.error.issues[0], context, entity);
  return undefined;
}
