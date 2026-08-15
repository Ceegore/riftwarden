import { fail } from "./diagnostic.mjs";
const envelopeFields=["schemaVersion","entityType","entities"];
export function strictObject(value, fields, context) {
  if(!value || typeof value!=="object" || Array.isArray(value)) fail("P09_SCHEMA_TYPE","Expected object",context);
  for(const field of fields) if(!(field in value)) fail("P09_SCHEMA_MISSING_FIELD",`Missing ${field}`,{...context,field});
  for(const field of Object.keys(value)) if(!fields.includes(field)) fail("P09_SCHEMA_UNKNOWN_FIELD",`Unknown ${field}`,{...context,field});
}
export function validateEnvelope(value, expectedType, sourcePath) {
  strictObject(value,envelopeFields,{sourcePath});
  if(value.schemaVersion!==1 || value.entityType!==expectedType || !Array.isArray(value.entities)) fail("P09_SCHEMA_TYPE","Invalid source envelope",{sourcePath});
}
export function requireString(value, field, context){ if(typeof value[field]!=="string" || !value[field]) fail("P09_SCHEMA_TYPE",`Expected string ${field}`,{...context,field}); }
export function requireArray(value, field, context){ if(!Array.isArray(value[field])) fail("P09_SCHEMA_TYPE",`Expected array ${field}`,{...context,field}); }
export function requireInteger(value, field, context, min=-Infinity, max=Infinity){ const n=value[field]; if(!Number.isInteger(n)||n<min||n>max) fail("P09_SCHEMA_RANGE",`Invalid integer ${field}`,{...context,field,value:n}); }
export function rejectUnexpectedNull(value, nullableFields, context){ for(const [key,item] of Object.entries(value)) if(item===null&&!nullableFields.includes(key)) fail("P09_SCHEMA_NULL_FORBIDDEN",`Null forbidden for ${key}`,{...context,field:key}); }
