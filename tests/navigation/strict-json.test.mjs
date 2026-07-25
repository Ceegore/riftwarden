import test from 'node:test';
import assert from 'node:assert/strict';
import { parseStrictJson } from '../../tools/navigation/lib/strict-json.mjs';

test('duplicate JSON keys are rejected',()=>assert.throws(()=>parseStrictJson('{"a":1,"a":2}'),(e)=>e.code==='NAV_JSON_DUPLICATE_KEY'));
test('malformed JSON is rejected with stable source code',()=>assert.throws(()=>parseStrictJson('{"a":'),(e)=>e.code==='NAV_SOURCE_SCHEMA'));
test('bidi override characters are rejected',()=>assert.throws(()=>parseStrictJson('{"a":"x\\u202ey"}'),(e)=>e.code==='NAV_JSON_FORBIDDEN_CONTROL'));
