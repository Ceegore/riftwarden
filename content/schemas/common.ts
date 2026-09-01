import { z } from "zod";

export const ContentIdSchema = z.string().regex(/^[a-z][a-z0-9_]*$/).brand();
export const LocalizationKeySchema = z.string().regex(/^(content|ui)\.[a-z0-9_.]+$/).brand();
export const TickSchema = z.number().int().nonnegative().brand();
export const MilliValueSchema = z.number().int().brand();
export const NonNegativeMilliValueSchema = MilliValueSchema.refine((value: number) => value >= 0);
export const BasisPointsSchema = z.number().int().min(0).max(50000).brand();
export const PositionX100Schema = z.number().int().min(0).max(10000).brand();
export const CurrencyAmountSchema = z.number().int().nonnegative().brand();
export const AuthoringSecondsSchema = z.number().nonnegative();

export const SourceEnvelopeSchema = z.object({
  schemaVersion: z.literal(1),
  entityType: z.string().min(1),
  entities: z.array(z.unknown()),
}).strict();
