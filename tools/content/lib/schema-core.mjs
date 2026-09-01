import { fail } from "./diagnostic.mjs";
const envelopeFields = ["schemaVersion", "entityType", "entities"];
export function strictObject(value, fields, context) {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail("P09_SCHEMA_TYPE", "Expected object", context);
  for (const field of fields) if (!(field in value)) fail("P09_SCHEMA_MISSING_FIELD", `Missing ${field}`, { ...context, field });
  for (const field of Object.keys(value)) if (!fields.includes(field)) fail("P09_SCHEMA_UNKNOWN_FIELD", `Unknown ${field}`, { ...context, field });
}
export function validateEnvelope(value, expectedType, sourcePath) {
  strictObject(value, envelopeFields, { sourcePath });
  if (value.schemaVersion !== 1 || value.entityType !== expectedType || !Array.isArray(value.entities)) fail("P09_SCHEMA_TYPE", "Invalid source envelope", { sourcePath });
}
