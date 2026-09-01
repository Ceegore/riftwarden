import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { loadSource, loadLocaleKeys } from "../../tools/content/lib/source-loader.mjs";
import { compileGraph } from "../../tools/content/lib/compiler-core.mjs";
import { tempCopy, readJson, writeJson } from "./test-helpers.mjs";

async function mutateIndex(mutate) {
  const root = await tempCopy();
  const index = await readJson(root, "content/source/_index.json");
  mutate(index);
  await writeJson(root, "content/source/_index.json", index);
  return root;
}

test("path traversal in source index blocks", async () => {
  const r = await mutateIndex((i) => { i.files[0].path = "../evil.json"; });
  await assert.rejects(() => loadSource(r), /P09_JSON_SYNTAX/);
});

test("duplicate source path blocks", async () => {
  const r = await mutateIndex((i) => { i.files.push({ ...i.files[0] }); });
  await assert.rejects(() => loadSource(r), /P09_ID_COLLISION/);
});

test("non-json source extension blocks", async () => {
  const r = await mutateIndex((i) => { i.files[0].path = "units/units.txt"; });
  await assert.rejects(() => loadSource(r), /P09_JSON_SYNTAX/);
});

test("symlinked source file blocks", async (t) => {
  const r = await tempCopy();
  const outside = path.join(r, "outside.json");
  await fs.writeFile(outside, JSON.stringify({ schemaVersion: 1, entityType: "screen", entities: [] }));
  const link = path.join(r, "content", "source", "world", "leak.json");
  try {
    await fs.symlink(outside, link);
  } catch {
    t.skip("symlink creation not permitted on this platform");
    return;
  }
  const index = await readJson(r, "content/source/_index.json");
  index.files.push({ path: "world/leak.json", entityType: "screen" });
  await writeJson(r, "content/source/_index.json", index);
  await assert.rejects(() => loadSource(r), /P09_SYMLINK_ESCAPE/);
});

test("planned asset warning without allowlist blocks compile", async () => {
  const r = await tempCopy();
  await fs.rm(path.join(r, "content", "source", "_allowlist.json"));
  const out = await fs.mkdtemp(path.join(os.tmpdir(), "p09-nowl-"));
  await assert.rejects(
    () => compileGraph({ root: r, outDir: out, profile: "fixture", loadSource, loadLocaleKeys }),
    /P09_WARNING_UNALLOWLISTED/,
  );
});

test("development profile accepted for fixture content", async () => {
  const r = await tempCopy();
  const out = await fs.mkdtemp(path.join(os.tmpdir(), "p09-dev-"));
  await assert.doesNotReject(
    () => compileGraph({ root: r, outDir: out, profile: "development", loadSource, loadLocaleKeys }),
  );
});

test("unknown profile blocks", async () => {
  const r = await tempCopy();
  const out = await fs.mkdtemp(path.join(os.tmpdir(), "p09-unk-"));
  await assert.rejects(
    () => compileGraph({ root: r, outDir: out, profile: "production", loadSource, loadLocaleKeys }),
    /P09_RELEASE_PROFILE/,
  );
});

test("invalid UTF-8 encoding blocks", async () => {
  const r = await tempCopy();
  await fs.writeFile(path.join(r, "content", "source", "units", "units.json"), Buffer.from([0x7b, 0x22, 0xff, 0xfe, 0x22, 0x3a, 0x31, 0x7d]));
  await assert.rejects(() => loadSource(r), /P09_JSON_ENCODING/);
});
