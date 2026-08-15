import { fail } from "./diagnostic.mjs";
const forbidden = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/u;
export function assertNoForbiddenControls(text, sourcePath) {
  if (forbidden.test(text)) fail("P09_JSON_CONTROL_CHAR", "Forbidden Unicode control character", { sourcePath });
}
export function detectDuplicateKeys(text, sourcePath) {
  const stack=[]; let i=0;
  const ws=()=>{ while (/\s/.test(text[i] ?? "")) i++; };
  const string=()=>{ let out=""; i++; while(i<text.length){ const c=text[i++]; if(c==='"') return out; if(c==='\\'){ const e=text[i++]; if(e==='u'){ out+=String.fromCharCode(parseInt(text.slice(i,i+4),16)); i+=4; } else out+=e; } else out+=c; } fail("P09_JSON_SYNTAX","Unterminated string",{sourcePath}); };
  while(i<text.length){ ws(); const c=text[i];
    if(c==='{'){ stack.push(new Set()); i++; continue; }
    if(c==='}'){ stack.pop(); i++; continue; }
    if(c==='"'){ const start=i; const key=string(); ws(); if(text[i]===':'){ const set=stack.at(-1); if(set?.has(key)) fail("P09_JSON_DUPLICATE_KEY",`Duplicate key ${key}`,{sourcePath,key,offset:start}); set?.add(key); } continue; }
    i++;
  }
}
function assertParsedStrings(value, sourcePath, pointer="") {
  if (typeof value === "string") { if (forbidden.test(value)) fail("P09_JSON_CONTROL_CHAR", "Forbidden Unicode control character", { sourcePath, pointer }); return; }
  if (Array.isArray(value)) { value.forEach((item,index)=>assertParsedStrings(item,sourcePath,`${pointer}/${index}`)); return; }
  if (value && typeof value === "object") for (const [key,item] of Object.entries(value)) { if (forbidden.test(key)) fail("P09_JSON_CONTROL_CHAR", "Forbidden Unicode control character in key", { sourcePath, pointer: `${pointer}/${key}` }); assertParsedStrings(item,sourcePath,`${pointer}/${key}`); }
}
export function parseStrictJson(text, sourcePath="<memory>") {
  if (text.charCodeAt(0) === 0xfeff) fail("P09_JSON_BOM", "Byte-order mark not allowed", { sourcePath });
  assertNoForbiddenControls(text, sourcePath); detectDuplicateKeys(text, sourcePath);
  try { const value=JSON.parse(text); assertParsedStrings(value,sourcePath); return value; } catch (error) { if (error?.code) throw error; fail("P09_JSON_SYNTAX", error.message, { sourcePath }); }
}
