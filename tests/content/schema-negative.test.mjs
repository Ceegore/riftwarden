import test from "node:test";
import assert from "node:assert/strict";
import { loadSource } from "../../tools/content/lib/source-loader.mjs";
import { materializeTimes } from "../../tools/content/lib/ticks.mjs";
import { tempCopy, readJson, writeJson } from "./test-helpers.mjs";

async function mutateUnit(mutate) {
  const root = await tempCopy();
  const units = await readJson(root, "content/source/units/units.json");
  mutate(units.entities[0]);
  await writeJson(root, "content/source/units/units.json", units);
  return root;
}

test("invalid enum blocks", async () => {
  const r = await mutateUnit((u) => { u.category = "not_a_category"; });
  await assert.rejects(() => loadSource(r), /P09_SCHEMA_TYPE/);
});

test("nested wrong type blocks", async () => {
  const r = await mutateUnit((u) => { u.baseStats.maxHp = "banana"; });
  await assert.rejects(() => loadSource(r), /P09_SCHEMA_TYPE/);
});

test("basis points above 50000 block", async () => {
  const r = await mutateUnit((u) => { u.baseStats.controlResistanceBps = 50001; });
  await assert.rejects(() => loadSource(r), /P09_SCHEMA_RANGE/);
});

test("position X100 outside 0..10000 blocks", async () => {
  const r = await mutateUnit((u) => { u.baseStats.rangeX100 = -5; });
  await assert.rejects(() => loadSource(r), /P09_SCHEMA_RANGE/);
});

test("unknown nested field blocks", async () => {
  const r = await mutateUnit((u) => { u.baseStats.bogusField = 123; });
  await assert.rejects(() => loadSource(r), /P09_SCHEMA_UNKNOWN_FIELD/);
});

test("empty roleTags array blocks", async () => {
  const r = await mutateUnit((u) => { u.roleTags = []; });
  await assert.rejects(() => loadSource(r), /P09_SCHEMA_RANGE/);
});

test("nested null in non-nullable field blocks", async () => {
  const r = await mutateUnit((u) => { u.baseStats.maxHp = null; });
  await assert.rejects(() => loadSource(r), /P09_SCHEMA_NULL_FORBIDDEN/);
});

test("nested null in nullable field is allowed", async () => {
  const r = await tempCopy();
  const enc = await readJson(r, "content/source/world/encounters.json");
  enc.entities[0].enemySlots[0].eliteId = null;
  await writeJson(r, "content/source/world/encounters.json", enc);
  await assert.doesNotReject(() => loadSource(r));
});

test("decimal currency blocks", async () => {
  const r = await tempCopy();
  const items = await readJson(r, "content/source/progression/items.json");
  items.entities[0].duplicateGold = 1.5;
  await writeJson(r, "content/source/progression/items.json", items);
  await assert.rejects(() => loadSource(r), /P09_SCHEMA_TYPE/);
});

test("negative currency blocks", async () => {
  const r = await tempCopy();
  const items = await readJson(r, "content/source/progression/items.json");
  items.entities[0].duplicateGold = -1;
  await writeJson(r, "content/source/progression/items.json", items);
  await assert.rejects(() => loadSource(r), /P09_SCHEMA_RANGE/);
});

test("string Seconds field blocks materialization", () => {
  assert.throws(() => materializeTimes({ castSeconds: "0.2" }), /P09_SCHEMA_TYPE/);
});

test("null Seconds field materializes to null Ticks", () => {
  assert.deepEqual(materializeTimes({ chargeSeconds: null }), { chargeTicks: null });
});
