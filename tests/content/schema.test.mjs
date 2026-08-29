import test from "node:test";import assert from "node:assert/strict";import { validateEnvelope } from "../../tools/content/lib/schema-core.mjs";import { validateEntityShape } from "../../tools/content/lib/entity-schemas.mjs";import { secondsToTicks,materializeTimes } from "../../tools/content/lib/ticks.mjs";import { readJson,starterRoot } from "./test-helpers.mjs";
const units=await readJson(starterRoot,"content/source/units/units.json");
const encounters=await readJson(starterRoot,"content/source/world/encounters.json");
test("valid envelope",()=>assert.doesNotThrow(()=>validateEnvelope(units,"unit","units.json")));
test("missing envelope field",()=>assert.throws(()=>validateEnvelope({schemaVersion:1,entityType:"unit"},"unit","x"),/P09_SCHEMA_MISSING_FIELD/));
test("unknown envelope field",()=>assert.throws(()=>validateEnvelope({...units,extra:true},"unit","x"),/P09_SCHEMA_UNKNOWN_FIELD/));
test("wrong entity type",()=>assert.throws(()=>validateEnvelope(units,"ability","x"),/P09_SCHEMA_TYPE/));
test("valid unit shape",()=>assert.doesNotThrow(()=>validateEntityShape("unit",units.entities[0],{})));
test("heal_sustain requirement above the bankability ceiling rejected by the MAIN content pipeline",()=>{
  const base=encounters.entities.find((e)=>e.healSustainCount!==undefined)??encounters.entities[0];
  // §8.3 SUSTAIN_BANKABILITY_CEILING = 200000: content above it is unwinnable by
  // construction, so content:validate (validateEntityShape) must REJECT it.
  assert.throws(()=>validateEntityShape("encounter",{...base,healSustainCount:200001},{}),/P09_SCHEMA_RANGE/);
  assert.doesNotThrow(()=>validateEntityShape("encounter",{...base,healSustainCount:200000},{}));
});
test("missing entity field",()=>{const x={...units.entities[0]};delete x.audioId;assert.throws(()=>validateEntityShape("unit",x,{}),/P09_SCHEMA_MISSING_FIELD/)});
test("unknown entity field",()=>assert.throws(()=>validateEntityShape("unit",{...units.entities[0],extra:1},{}),/P09_SCHEMA_UNKNOWN_FIELD/));
test("forbidden null",()=>assert.throws(()=>validateEntityShape("unit",{...units.entities[0],displayNameKey:null},{}),/P09_SCHEMA_NULL_FORBIDDEN/));
test("30Hz exact conversion",()=>assert.equal(secondsToTicks(0.2),6));
test("rounding over 0.01 blocks",()=>assert.throws(()=>secondsToTicks(0.015),/P09_TICK_ROUNDING/));
test("nested seconds materialized",()=>assert.deepEqual(materializeTimes({castSeconds:0.2,nested:{durationSeconds:null}}),{castTicks:6,nested:{durationTicks:null}}));
