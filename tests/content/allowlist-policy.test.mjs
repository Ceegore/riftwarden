import test from "node:test";import assert from "node:assert/strict";import fs from "node:fs/promises";import path from "node:path";import { validateAllowlist,assertWarningsAllowlisted } from "../../tools/content/lib/allowlist.mjs";import { starterRoot } from "./test-helpers.mjs";
const read=async(n)=>JSON.parse(await fs.readFile(path.join(starterRoot,"tests/fixtures/content",n),"utf8"));
test("active allowlist passes",async()=>{const value=await read("positive/active-allowlist.json");assert.doesNotThrow(()=>validateAllowlist(value));});
test("expired allowlist blocks",async()=>{const value=await read("negative/expired-allowlist.json");assert.throws(()=>validateAllowlist(value),/P09_ALLOWLIST_EXPIRED/);});
test("unallowlisted warning blocks",async()=>assert.throws(()=>assertWarningsAllowlisted([{code:"X",sourcePath:"x"}],{entries:[]}),/P09_WARNING_UNALLOWLISTED/));
test("matching warning passes",async()=>{const a=validateAllowlist(await read("positive/active-allowlist.json"));assert.doesNotThrow(()=>assertWarningsAllowlisted([{code:"P09_TEST_WARNING",sourcePath:"fixture.json",entityId:null}],a));});
test("entity-specific mismatch blocks",async()=>{const a=validateAllowlist(await read("positive/active-allowlist.json"));assert.throws(()=>assertWarningsAllowlisted([{code:"P09_TEST_WARNING",sourcePath:"fixture.json",entityId:"hero_x"}],a),/P09_WARNING_UNALLOWLISTED/);});
