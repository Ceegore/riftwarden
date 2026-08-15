import test from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import { ENTITY_SCHEMAS } from "../../tools/content/lib/entity-schemas.mjs";

const REQUIRED_FIELDS = {
  unit: ["id", "category", "baseStats", "basicAttackId", "visualId", "audioId", "codexId"],
  ability: ["id", "ownerId", "effects", "telegraphId", "castSeconds"],
  mission: ["id", "encounterPoolIds", "minVisitedNodes", "maxVisitedNodes"],
  event: ["id", "options", "deterministicRollSlots"],
};

test("every entity type is strictly exported with additionalProperties:false", () => {
  for (const [type, schema] of Object.entries(ENTITY_SCHEMAS)) {
    const js = z.toJSONSchema(schema);
    assert.equal(js.type, "object", `${type} must be an object`);
    assert.equal(js.additionalProperties, false, `${type} must forbid additional properties`);
    assert.ok(Array.isArray(js.required), `${type} must declare required fields`);
  }
});

test("required fields are exported", () => {
  for (const [type, fields] of Object.entries(REQUIRED_FIELDS)) {
    const js = z.toJSONSchema(ENTITY_SCHEMAS[type]);
    for (const field of fields) assert.ok(js.required.includes(field), `${type} must require ${field}`);
  }
});

test("basis points limit is exported", () => {
  const js = z.toJSONSchema(ENTITY_SCHEMAS.unit);
  assert.equal(js.properties.baseStats.properties.controlResistanceBps.maximum, 50000);
});

test("enums are exported with their values", () => {
  const js = z.toJSONSchema(ENTITY_SCHEMAS.unit);
  assert.ok(js.properties.category.enum.includes("hero"));
  assert.ok(js.properties.category.enum.includes("boss_object"));
  const event = z.toJSONSchema(ENTITY_SCHEMAS.event);
  assert.deepEqual(event.properties.repeatPolicy.enum, ["once_per_run", "history_limited"]);
});

test("nullable fields accept null", () => {
  const js = z.toJSONSchema(ENTITY_SCHEMAS.unit);
  assert.ok(JSON.stringify(js.properties.replacementId).includes("null"), "replacementId must allow null");
});
