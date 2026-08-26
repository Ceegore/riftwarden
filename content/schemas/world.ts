import { z } from "zod";
import { ContentIdSchema, LocalizationKeySchema } from "./common";

export const TargetProfileSourceSchema = z.object({
  id: ContentIdSchema,
  targetKind: z.enum(["enemy_unit", "allied_unit", "self", "ground_position", "summon_slot", "boss_object"]),
  lanePolicy: z.enum(["same", "adjacent_allowed", "any"]),
  selection: z.enum(["nearest", "lowest_hp", "highest_threat", "stable_id"]),
  maxRangeX100: z.number().int().nonnegative(),
}).strict();

export const BossObjectSourceSchema = z.object({
  entityId: ContentIdSchema,
  side: z.enum(["player", "enemy"]),
  ownerId: ContentIdSchema,
  sourceId: ContentIdSchema,
  slotId: z.enum(["boss_slot_0", "boss_slot_1", "boss_slot_2", "boss_slot_3"]),
  lane: z.enum(["top", "middle", "bottom"]),
  x100: z.number().int().nonnegative().max(10000),
  targetable: z.boolean(),
  objectiveLink: ContentIdSchema.nullable(),
  damagePolicy: z.enum(["normal", "immune", "shield_only"]),
  statusPolicy: z.enum(["allow", "block"]),
  cleanupPolicy: z.enum(["on_objective", "on_battle_end", "manual"]),
  fallback: z.enum(["FAIL", "DEFER"]),
  maxLp: z.number().int().positive(),
  radiusX100: z.number().int().positive(),
}).strict();

export const EncounterSourceSchema = z.object({
  id: ContentIdSchema,
  regionId: ContentIdSchema,
  kind: z.enum(["normal", "elite", "boss", "survival", "reinforcement"]),
  enemySlots: z.array(z.object({ unitId: ContentIdSchema, lane: z.enum(["top","middle","bottom"]), depth: z.enum(["front","middle","back"]), eliteId: ContentIdSchema.nullable() }).strict()).min(1),
  modifierIds: z.array(ContentIdSchema),
  reinforcementWaves: z.array(z.object({ atSeconds: z.number().nonnegative(), encounterId: ContentIdSchema }).strict()),
  objective: z.enum(["defeat_all", "survive", "defeat_boss"]),
  /** §P21-T03: boss objects placed into the battle registry (damage/status/cleanup policies). */
  bossObjects: z.array(BossObjectSourceSchema).default([]),
  rewardTableId: ContentIdSchema,
  previewDisclosureKey: LocalizationKeySchema,
  allowedModes: z.array(z.enum(["campaign","campaign_replay","ascension","beyond","endless"])).min(1),
}).strict();

export const MissionSourceSchema = z.object({
  id: ContentIdSchema,
  act: z.union([z.literal(1),z.literal(2),z.literal(3),z.literal(4)]),
  sequence: z.number().int().min(1).max(5),
  titleKey: LocalizationKeySchema,
  objective: z.enum(["complete_route", "defeat_boss", "survive"]),
  mapProfileId: ContentIdSchema,
  mandatoryNodeRules: z.array(z.object({ nodeType: z.string().min(1), minimum: z.number().int().nonnegative() }).strict()),
  encounterPoolIds: z.array(ContentIdSchema).min(1),
  firstCompletionRewardTableId: ContentIdSchema,
  repeatRewardTableId: ContentIdSchema,
  unlockFlags: z.array(z.string().regex(/^[a-z][a-z0-9_]*$/)),
  storyEntryKeys: z.array(LocalizationKeySchema),
  minVisitedNodes: z.literal(5),
  maxVisitedNodes: z.literal(8),
}).strict();

export const EventSourceSchema = z.object({
  id: ContentIdSchema,
  regionTags: z.array(ContentIdSchema).min(1),
  riskTier: z.number().int().min(0).max(3),
  titleKey: LocalizationKeySchema,
  bodyKey: LocalizationKeySchema,
  prerequisites: z.array(z.object({ kind: z.string().min(1), value: z.string().min(1) }).strict()),
  options: z.array(z.object({ id: z.string().regex(/^[a-z][a-z0-9_]*$/), labelKey: LocalizationKeySchema, resultKey: LocalizationKeySchema, rollSlot: z.string().regex(/^[a-z][a-z0-9_.]*$/).nullable() }).strict()).min(2).max(3),
  deterministicRollSlots: z.array(z.string().regex(/^[a-z][a-z0-9_.]*$/)),
  repeatPolicy: z.enum(["once_per_run", "history_limited"]),
}).strict();
