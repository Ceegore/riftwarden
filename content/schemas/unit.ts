import { z } from "zod";
import { BasisPointsSchema, ContentIdSchema, LocalizationKeySchema, NonNegativeMilliValueSchema } from "./common";

export const UnitStatsSourceSchema = z.object({
  maxHp: NonNegativeMilliValueSchema,
  armor: z.number().int(),
  resistance: z.number().int(),
  attackPower: NonNegativeMilliValueSchema,
  attackIntervalSeconds: z.number().positive(),
  preparationSeconds: z.number().nonnegative(),
  rangeX100: z.number().int().nonnegative(),
  movementX100PerSecond: z.number().int().nonnegative(),
  controlResistanceBps: BasisPointsSchema,
}).strict();

export const UnitSourceSchema = z.object({
  id: ContentIdSchema,
  category: z.enum(["hero", "troop", "summon", "enemy", "boss", "boss_object"]),
  displayNameKey: LocalizationKeySchema,
  roleTags: z.array(z.enum(["defender","fighter","breaker","duelist","marksman","mage","healer","support","summoner","controller","constructor"])).min(1),
  traitIds: z.array(ContentIdSchema).max(2),
  baseStats: UnitStatsSourceSchema,
  collisionRadiusX100: z.number().int().positive(),
  preferredDepths: z.array(z.enum(["front", "middle", "back"])).min(1),
  basicAttackId: ContentIdSchema,
  passiveAbilityIds: z.array(ContentIdSchema),
  activeAbilityIds: z.array(ContentIdSchema),
  targetProfileId: ContentIdSchema,
  visualId: ContentIdSchema,
  audioId: ContentIdSchema,
  codexId: ContentIdSchema,
  deprecated: z.boolean(),
  replacementId: ContentIdSchema.nullable(),
}).strict();
