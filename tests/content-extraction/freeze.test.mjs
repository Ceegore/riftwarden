import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createBaseline } from '../../tools/content/extraction/lib/freeze.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const input = JSON.parse(readFileSync(path.join(here, 'fixtures/positive/baseline-inputs.json'), 'utf8'));

test('baseline is deterministic', () => {
  assert.deepEqual(createBaseline(input), createBaseline(structuredClone(input)));
});

test('baseline hash is SHA-256', () => {
  assert.match(createBaseline(input).baselineSha256, /^[0-9a-f]{64}$/);
});

test('input change changes baseline', () => {
  const before = createBaseline(input).baselineSha256;
  assert.notEqual(createBaseline({ ...input, contentVersion: 'changed' }).baselineSha256, before);
});

test('missing hash blocks with P10_BASELINE_NOT_FREEZABLE', () => {
  assert.throws(() => createBaseline({ ...input, ledgerSha256: '' }), /P10_BASELINE_NOT_FREEZABLE/);
});
