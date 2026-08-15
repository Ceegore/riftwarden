import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateFidelity } from '../../tools/content/extraction/lib/fidelity.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (n) => JSON.parse(readFileSync(path.join(here, 'fixtures', n), 'utf8'));

test('exact fidelity fixture passes', () => {
  assert.deepEqual(validateFidelity(read('positive/fidelity.json')), []);
});

test('numeric change blocks with P10_FIDELITY_NUMERIC', () => {
  assert.equal(validateFidelity(read('negative/fidelity-number-changed.json'))[0].code, 'P10_FIDELITY_NUMERIC');
});

test('manual tick conversion blocks', () => {
  assert.equal(validateFidelity(read('negative/fidelity-manual-ticks.json')).some((x) => x.code === 'P10_MANUAL_TICK_CONVERSION'), true);
});

test('approved text defect permits changed text', () => {
  const value = read('positive/fidelity.json');
  value.extractedTextSha256 = 'c'.repeat(64);
  value.approvedDefectId = 'DEF-17';
  assert.deepEqual(validateFidelity(value), []);
});

test('unapproved text change blocks with P10_FIDELITY_TEXT', () => {
  const value = read('positive/fidelity.json');
  value.extractedTextSha256 = 'c'.repeat(64);
  assert.equal(validateFidelity(value).some((x) => x.code === 'P10_FIDELITY_TEXT'), true);
});
