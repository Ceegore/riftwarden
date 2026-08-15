import { z } from "zod";

export const GeneratedFileRecordSchema = z.object({
  path: z.string().regex(/^[a-z0-9_./-]+\.json$/),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
  byteLength: z.number().int().nonnegative(),
  entityType: z.string().regex(/^[a-z][a-zA-Z0-9]*$/),
}).strict();

export const ContentManifestSchema = z.object({
  schemaVersion: z.literal(1),
  contentVersion: z.string().regex(/^[a-f0-9]{64}$/),
  simulationVersion: z.number().int().nonnegative(),
  localeVersions: z.object({ de: z.string().min(1), en: z.string().min(1) }).strict(),
  validationProfile: z.enum(["fixture", "release"]),
  counts: z.record(z.string(), z.number().int().nonnegative()),
  files: z.array(GeneratedFileRecordSchema),
}).strict();
