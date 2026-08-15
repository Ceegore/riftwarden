import { fail } from "./diagnostic.mjs";
export function validateAllowlist(value, today="2026-07-17"){
 if(!value||value.schemaVersion!==1||!Array.isArray(value.entries)) fail("P09_SCHEMA_TYPE","Invalid warning allowlist");
 for(const entry of value.entries){ for(const key of ["code","sourcePath","reason","owner","expiresOn"]) if(typeof entry[key]!=="string"||!entry[key]) fail("P09_SCHEMA_MISSING_FIELD",`Allowlist missing ${key}`); if(entry.reason.length<12) fail("P09_SCHEMA_RANGE","Allowlist reason too short"); if(entry.expiresOn<today) fail("P09_ALLOWLIST_EXPIRED",`Expired ${entry.code}`,{entry}); }
 return value;
}
export function assertWarningsAllowlisted(warnings,allowlist){
 for(const warning of warnings){ const match=allowlist.entries.find((e)=>e.code===warning.code&&e.sourcePath===warning.sourcePath&&(e.entityId??null)===(warning.entityId??null)); if(!match) fail("P09_WARNING_UNALLOWLISTED",`Warning not allowlisted ${warning.code}`,warning); }
}
