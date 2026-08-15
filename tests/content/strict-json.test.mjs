import test from "node:test";import assert from "node:assert/strict";import fs from "node:fs/promises";import path from "node:path";import { parseStrictJson } from "../../tools/content/lib/strict-json.mjs";import { starterRoot } from "./test-helpers.mjs";
const neg=(n)=>fs.readFile(path.join(starterRoot,"tests/fixtures/content/negative",n),"utf8");
test("valid strict JSON parses",()=>assert.equal(parseStrictJson('{"a":1}').a,1));
test("duplicate keys block",async()=>{const text=await neg("duplicate-key.json.invalid.txt");assert.throws(()=>parseStrictJson(text),/P09_JSON_DUPLICATE_KEY/);});
test("syntax blocks",async()=>{const text=await neg("malformed.json.invalid.txt");assert.throws(()=>parseStrictJson(text),/P09_JSON_SYNTAX/);});
test("unicode control blocks",async()=>{const text=await neg("control-char.json.invalid.txt");assert.throws(()=>parseStrictJson(text),/P09_JSON_CONTROL_CHAR/);});
test("nested duplicate blocks",()=>assert.throws(()=>parseStrictJson('{"a":{"x":1,"x":2}}'),/P09_JSON_DUPLICATE_KEY/));
test("byte-order mark blocks",()=>assert.throws(()=>parseStrictJson("\uFEFF{\"a\":1}"),/P09_JSON_BOM/));
test("same key in sibling objects allowed",()=>assert.deepEqual(parseStrictJson('{"a":{"x":1},"b":{"x":2}}').b,{x:2}));
