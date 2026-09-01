import { z } from "zod";
import { ContentIdSchema, LocalizationKeySchema } from "./common";

export const EffectSourceSchema = z.object({
  type: z.enum(["damage", "heal", "shield", "apply_status", "summon", "move"]),
  magnitude: z.number().int(),
  scalingSource: z.enum(["none", "attack_power", "max_hp", "target_max_hp"]),
  damageType: z.enum(["physical", "magical", "true"]).nullable(),
  durationSeconds: z.number().nonnegative().nullable(),
  radiusX100: z.number().int().nonnegative().nullable(),
  statusId: ContentIdSchema.nullable(),
  summonId: ContentIdSchema.nullable(),
  sourceAttribution: z.enum(["owner", "summon_owner", "effect_source"]),
}).strict();

export const AbilitySourceSchema = z.object({
  id: ContentIdSchema,
  ownerId: ContentIdSchema,
  kind: z.enum(["passive", "basic_attack", "signature", "level3_once", "boss", "modifier", "item"]),
  triggerType: z.enum(["always", "interval", "battle_start", "hp_threshold", "ally_state", "enemy_state", "event"]),
  targetProfileId: ContentIdSchema,
  chargeSeconds: z.number().nonnegative().nullable(),
  cooldownSeconds: z.number().nonnegative().nullable(),
  castSeconds: z.number().nonnegative(),
  recoverySeconds: z.number().nonnegative(),
  interruptPolicy: z.enum(["interruptible", "cast_committed", "uninterruptible"]),
  usesPerBattle: z.number().int().positive().nullable(),
  effects: z.array(EffectSourceSchema).min(1),
  telegraphId: ContentIdSchema,
  visibilityTextKey: LocalizationKeySchema,
  invalidTargetPolicy: z.enum(["wait", "retarget", "consume_without_effect"]),
  logTags: z.array(z.string().regex(/^[a-z][a-z0-9_]*$/)),
  deprecated: z.boolean(),
  replacementId: ContentIdSchema.nullable(),
}).strict();
