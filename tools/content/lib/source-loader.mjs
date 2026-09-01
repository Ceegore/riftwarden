import fs from "node:fs/promises"; import path from "node:path";
import { parseStrictJson } from "./strict-json.mjs"; import { validateEnvelope } from "./schema-core.mjs"; import { validateEntityShape } from "./entity-schemas.mjs"; import { validateAllowlist } from "./allowlist.mjs"; import { fail } from "./diagnostic.mjs";
function safeRelative(value) { if (typeof value !== "string" || value.startsWith("/") || value.includes("\\") || value.split("/").includes("..") || !value.endsWith(".json")) fail("P09_JSON_SYNTAX", "Unsafe source path", { sourcePath: value }); return value; }
async function assertNotSymlink(abs, sourcePath) { const stat = await fs.lstat(abs).catch(() => null); if (stat?.isSymbolicLink()) fail("P09_SYMLINK_ESCAPE", "Symbolic link forbidden in source", { sourcePath }); }
async function readUtf8(abs, sourcePath) { const bytes = await fs.readFile(abs); try { return new TextDecoder("utf-8", { fatal: true }).decode(bytes); } catch { fail("P09_JSON_ENCODING", "Invalid UTF-8 encoding", { sourcePath }); } }
export async function loadSource(root) {
  const sourceRoot = path.resolve(root, "content/source"); const indexPath = path.join(sourceRoot, "_index.json");
  await assertNotSymlink(indexPath, "content/source/_index.json");
  const index = parseStrictJson(await readUtf8(indexPath, "content/source/_index.json"), "content/source/_index.json");
  if (index.schemaVersion !== 1 || !Array.isArray(index.files)) fail("P09_SCHEMA_TYPE", "Invalid source index", { sourcePath: "content/source/_index.json" });
  const seen = new Set(); const envelopes = [];
  for (const entry of index.files) {
    const rel = safeRelative(entry.path); if (seen.has(rel)) fail("P09_ID_COLLISION", `Duplicate source path ${rel}`); seen.add(rel);
    const abs = path.resolve(sourceRoot, rel); if (!abs.startsWith(sourceRoot + path.sep)) fail("P09_JSON_SYNTAX", "Path traversal", { sourcePath: rel });
    await assertNotSymlink(abs, rel);
    const value = parseStrictJson(await readUtf8(abs, rel), `content/source/${rel}`);
    validateEnvelope(value, entry.entityType, rel);
    for (const entity of value.entities) validateEntityShape(entry.entityType, entity, { sourcePath: rel, entityId: entity?.id });
    envelopes.push({ ...value, sourcePath: rel });
  }
  return { index, envelopes };
}
export async function loadLocaleKeys(root) { const p = path.resolve(root, "content/locales/keys.fixture.json"); await assertNotSymlink(p, "content/locales/keys.fixture.json"); const value = parseStrictJson(await readUtf8(p, "content/locales/keys.fixture.json"), "content/locales/keys.fixture.json"); return { de: new Set(value.de), en: new Set(value.en), versions: value }; }
export async function loadAllowlist(root) { const p = path.resolve(root, "content/source/_allowlist.json"); const stat = await fs.lstat(p).catch(() => null); if (!stat) return { schemaVersion: 1, entries: [] }; await assertNotSymlink(p, "content/source/_allowlist.json"); return validateAllowlist(parseStrictJson(await readUtf8(p, "content/source/_allowlist.json"), "content/source/_allowlist.json")); }
