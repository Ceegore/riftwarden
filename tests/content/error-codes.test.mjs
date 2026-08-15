import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { starterRoot } from "./test-helpers.mjs";

const registry = JSON.parse(await fs.readFile(path.join(starterRoot, "contracts", "error-codes.json"), "utf8"));
const registered = new Set(registry.codes.map((c) => c.code));

async function collect(dir, ext) {
  const out = [];
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...await collect(p, ext));
    else if (p.endsWith(ext)) out.push(p);
  }
  return out;
}

async function usedCodes() {
  const used = new Set();
  const targets = [
    ...await collect(path.join(starterRoot, "tools", "content"), ".mjs"),
    ...await collect(path.join(starterRoot, "src", "game", "content"), ".ts"),
  ];
  for (const p of targets) {
    const text = await fs.readFile(p, "utf8");
    for (const match of text.matchAll(/\bP09_[A-Z0-9_]+\b/g)) used.add(match[0]);
  }
  return used;
}

test("every used error code is registered", async () => {
  const used = await usedCodes();
  for (const code of used) assert.ok(registered.has(code), `Unregistered error code ${code}`);
});

test("every registered error code is used", async () => {
  const used = await usedCodes();
  for (const code of registered) assert.ok(used.has(code), `Orphan registered code ${code}`);
});

test("registry has unique codes and valid severities", () => {
  assert.equal(registry.codes.length, new Set(registry.codes.map((c) => c.code)).size);
  for (const entry of registry.codes) assert.ok(["error", "warning"].includes(entry.severity), `${entry.code} severity invalid`);
});
