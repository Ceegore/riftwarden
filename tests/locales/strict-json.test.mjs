import test from 'node:test';
import assert from 'node:assert/strict';
import { parseStrictJson } from '../../tools/locales/lib/strict-json.mjs';

test('strict JSON accepts a normal document', () => {
  assert.deepEqual(parseStrictJson('{"a":1,"b":[true,null,"x"]}'), { a:1, b:[true,null,'x'] });
});

test('strict JSON rejects duplicate object keys', () => {
  assert.throws(() => parseStrictJson('{"a":1,"a":2}', 'duplicate.json'), error => error.code === 'L10N_JSON_DUPLICATE_KEY' && error.line === 1);
});

test('strict JSON rejects forbidden bidi controls after decoding', () => {
  assert.throws(() => parseStrictJson('{"a":"\\u202e"}', 'bidi.json'), error => error.code === 'L10N_JSON_FORBIDDEN_CONTROL');
});

test('strict JSON rejects trailing garbage', () => {
  assert.throws(() => parseStrictJson('{"a":1} nope'), error => error.code === 'L10N_SOURCE_SCHEMA');
});
