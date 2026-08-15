import test from 'node:test';
import assert from 'node:assert/strict';
import { loadJson, loadLedgers } from '../../tools/content/extraction/lib/load-ledgers.mjs';
import { validateCounts } from '../../tools/content/extraction/lib/counts.mjs';

test('all exact family counts pass', async () => {
  const counts = await loadJson('contracts/release-counts.json');
  const { index, ledgers } = await loadLedgers();
  assert.deepEqual(validateCounts(index, ledgers, counts), []);
});

test('gate-critical total is 288, supplementary 120, all 408', async () => {
  const counts = await loadJson('contracts/release-counts.json');
  assert.equal(counts.totals.gateCritical, 288);
  assert.equal(counts.totals.supplementaryAuthoritative, 120);
  assert.equal(counts.totals.allNamedSlots, 408);
});

test('no forbidden bucket family exists', async () => {
  const counts = await loadJson('contracts/release-counts.json');
  const { index } = await loadLedgers();
  assert.equal(index.families.some((x) => counts.forbiddenBuckets.includes(x.family)), false);
});

test('count mismatch blocks with P10_COUNT_MISMATCH', async () => {
  const counts = await loadJson('contracts/release-counts.json');
  const { index, ledgers } = await loadLedgers();
  const copy = structuredClone(ledgers);
  copy[0].data.entries.pop();
  assert.equal(validateCounts(index, copy, counts)[0].code, 'P10_COUNT_MISMATCH');
});

test('forbidden bucket family blocks', async () => {
  const counts = await loadJson('contracts/release-counts.json');
  const { index, ledgers } = await loadLedgers();
  const copy = structuredClone(index);
  copy.families.push({ family: 'misc', category: 'gateCritical', expectedCount: 1, file: 'misc.ledger.json' });
  assert.equal(validateCounts(copy, ledgers, counts).some((d) => d.code === 'P10_FORBIDDEN_BUCKET'), true);
});
