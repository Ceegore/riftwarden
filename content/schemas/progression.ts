import { z } from "zod";
import { ContentIdSchema, CurrencyAmountSchema, LocalizationKeySchema } from "./common";

export const ItemSourceSchema = z.object({
  id: ContentIdSchema,
  category: z.enum(["item", "talisman", "kit", "banner"]),
  displayNameKey: LocalizationKeySchema,
  compatibilityUnitIds: z.array(ContentIdSchema),
  baseStatMods: z.array(z.object({ stat: z.string().min(1), value: z.number().int() }).strict()),
  effectAbilityId: ContentIdSchema.nullable(),
  polishMods: z.array(z.object({ stat: z.string().min(1), value: z.number().int() }).strict()),
  acquisitionPoolIds: z.array(ContentIdSchema).min(1),
  duplicateGold: CurrencyAmountSchema,
  deprecated: z.boolean(),
  replacementId: ContentIdSchema.nullable(),
}).strict();

export const RelicSourceSchema = z.object({
  id: ContentIdSchema,
  displayNameKey: LocalizationKeySchema,
  rarity: z.enum(["common", "uncommon", "rare", "legendary"]),
  effectAbilityIds: z.array(ContentIdSchema).min(1),
  maxCopies: z.number().int().min(1).max(8),
  durationScope: z.enum(["battle", "expedition", "run"]),
  poolTags: z.array(z.string().regex(/^[a-z][a-z0-9_]*$/)).min(1),
  unlockCondition: z.string().min(1),
  merchantValue: CurrencyAmountSchema,
}).strict();

export const RewardTableSourceSchema = z.object({
  id: ContentIdSchema,
  entries: z.array(z.object({ rewardType: z.enum(["gold", "item", "relic", "unlock"]), contentId: ContentIdSchema.nullable(), amount: CurrencyAmountSchema, weight: z.number().int().positive(), rollSlot: z.string().regex(/^[a-z][a-z0-9_.]*$/) }).strict()).min(1),
}).strict();
