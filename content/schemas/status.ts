import { z } from "zod";
import { ContentIdSchema } from "./common";

export const StatusSourceSchema = z.object({
  id: ContentIdSchema,
  kind: z.enum(["shield","attack_up","attack_speed_up","move_speed_up","resistance_up","regeneration","burn","poison","slow","weaken","silence","stun","mark","confusion"]),
  stackPolicy: z.enum(["replace_if_stronger","refresh_duration","extend_duration_capped","independent_by_source","no_reapply"]),
  maxStacks: z.number().int().min(1),
  durationCapSeconds: z.number().nonnegative().nullable(),
  dispelCategory: z.enum(["positive", "negative", "control", "none"]),
  bossPolicy: z.enum(["normal", "duration_reduced", "convert_to_interrupt", "immune"]),
  statModifiers: z.array(z.object({ stat: z.string().min(1), operation: z.enum(["add", "multiply_bps"]), value: z.number().int() }).strict()),
  periodicEffects: z.array(z.object({ intervalSeconds: z.number().positive(), effectAbilityId: ContentIdSchema }).strict()),
  deprecated: z.boolean(),
  replacementId: ContentIdSchema.nullable(),
}).strict();
