import { z } from "zod";
import { ContentIdSchema, LocalizationKeySchema } from "./common";

export const ScreenReferenceSourceSchema = z.object({
  id: ContentIdSchema,
  screenKey: z.string().regex(/^[a-z][a-z0-9_.]*$/),
  titleKey: LocalizationKeySchema,
  iconVisualId: ContentIdSchema,
  happyPathTestId: z.string().regex(/^E2E-[A-Z0-9-]+$/),
}).strict();

export const VisualRequirementSourceSchema = z.object({
  id: ContentIdSchema,
  ownerPhase: z.string().regex(/^\d{2}$/),
  status: z.enum(["planned", "required_present"]),
  altTextKey: LocalizationKeySchema,
}).strict();

export const AudioRequirementSourceSchema = z.object({
  id: ContentIdSchema,
  ownerPhase: z.string().regex(/^\d{2}$/),
  status: z.enum(["planned", "required_present"]),
  captionKey: LocalizationKeySchema,
}).strict();
