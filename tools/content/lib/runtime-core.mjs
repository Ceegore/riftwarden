import fs from "node:fs/promises"; import path from "node:path";
import { parseStrictJson } from "./strict-json.mjs"; import { sha256 } from "./manifest.mjs"; import { canonicalJson, stableCompare } from "./canonical-json.mjs"; import { fail } from "./diagnostic.mjs";
function deepFreeze(v) { if (v && typeof v === "object" && !Object.isFrozen(v)) { Object.freeze(v); for (const x of Object.values(v)) deepFreeze(x); } return v; }
function freezeMap(map) { for (const key of ["set", "delete", "clear"]) map[key] = () => { throw new Error("P09_IMMUTABLE_BUNDLE"); }; return Object.freeze(map); }
export async function loadVerifiedBundle(outDir) {
  const root = path.resolve(outDir);
  const manifest = parseStrictJson(await fs.readFile(path.join(root, "manifest.json"), "utf8"), "manifest.json");
  const byType = new Map(); let total = 0;
  for (const rec of manifest.files) {
    if (!rec || typeof rec.path !== "string" || typeof rec.sha256 !== "string" || typeof rec.byteLength !== "number" || typeof rec.entityType !== "string") fail("P09_MANIFEST_HASH", "Invalid generated file record", { sourcePath: rec?.path ?? "(manifest)" });
    if (rec.path.includes("..") || rec.path.includes("/") || rec.path.includes("\\")) fail("P09_MANIFEST_HASH", "Unsafe generated path", { sourcePath: rec.path });
    const bytes = await fs.readFile(path.join(root, rec.path));
    if (bytes.length !== rec.byteLength || sha256(bytes) !== rec.sha256) fail("P09_MANIFEST_HASH", `Hash mismatch ${rec.path}`, { sourcePath: rec.path });
    const file = parseStrictJson(bytes.toString("utf8"), rec.path);
    if (file.generatedBy !== "riftwarden-content-compiler-v1" || file.schemaVersion !== manifest.schemaVersion || file.entityType !== rec.entityType) fail("P09_SCHEMA_TYPE", "Generated header mismatch", { sourcePath: rec.path });
    if (!Array.isArray(file.entities)) fail("P09_SCHEMA_TYPE", "Generated entities not an array", { sourcePath: rec.path });
    const map = new Map();
    for (const entity of file.entities) { if (!entity || typeof entity.id !== "string") fail("P09_ID_COLLISION", "Runtime entity without string id", { sourcePath: rec.path }); if (map.has(entity.id)) fail("P09_ID_COLLISION", `Runtime duplicate ${entity.id}`, { sourcePath: rec.path }); map.set(entity.id, deepFreeze(structuredClone(entity))); }
    byType.set(rec.entityType, freezeMap(map)); total += map.size;
  }
  // §9.7: contentVersion is SHA-256 over canonical, sorted file records. The
  // manifest is the root of trust, so the loader must reject a manifest whose
  // contentVersion does not match its own (already validated) records.
  const derived = sha256(Buffer.from(canonicalJson(
    [...manifest.files].sort((a, b) => stableCompare(a.path, b.path))
      .map(({ path: p, sha256: h, byteLength: b, entityType: t }) => ({ path: p, sha256: h, byteLength: b, entityType: t })),
  )));
  if (derived !== manifest.contentVersion) fail("P09_CONTENT_VERSION", "Content version mismatch", { sourcePath: "manifest.json" });
  const countTotal = Object.values(manifest.counts ?? {}).reduce((a, b) => a + b, 0);
  if (total !== countTotal) fail("P09_MANIFEST_COUNT", "Runtime count mismatch");
  return deepFreeze({ manifest: deepFreeze(manifest), byType: freezeMap(byType) });
}
