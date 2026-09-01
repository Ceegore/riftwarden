import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { loadLedgers } from '../../tools/content/extraction/lib/load-ledgers.mjs';
import { validateLedgerShape } from '../../tools/content/extraction/lib/ledger.mjs';

const authority = path.resolve('inputs/sources/GDD_V5_PHASE10_AUTHORITY_EXTRACT.md');

test('generated ledgers have valid shape and every source hash matches', async () => {
  const { ledgers } = await loadLedgers();
  assert.deepEqual(await validateLedgerShape(ledgers, authority), []);
});

test('all 408 slots are concrete labels, deliberately UNEXTRACTED', async () => {
  const { ledgers } = await loadLedgers();
  const entries = ledgers.flatMap((x) => x.data.entries);
  assert.equal(entries.length, 408);
  assert.equal(entries.every((e) => e.authorityLabel && !/unknown|misc/i.test(e.authorityLabel)), true);
  assert.equal(entries.every((e) => e.status === 'UNEXTRACTED'), true);
  assert.equal(entries.every((e) => e.runtimeId === null), true);
});

test('duplicate runtime ID blocks with P10_RUNTIME_ID_DUPLICATE', async () => {
  const { ledgers } = await loadLedgers();
  const copy = structuredClone(ledgers);
  copy[0].data.entries[0].runtimeId = 'hero_same';
  copy[0].data.entries[1].runtimeId = 'hero_same';
  assert.equal((await validateLedgerShape(copy, authority)).some((d) => d.code === 'P10_RUNTIME_ID_DUPLICATE'), true);
});

test('invented runtime ID on an UNEXTRACTED slot blocks', async () => {
  const { ledgers } = await loadLedgers();
  const copy = structuredClone(ledgers);
  copy[0].data.entries[0].runtimeId = 'invented_id';
  assert.equal((await validateLedgerShape(copy, authority)).some((d) => d.code === 'P10_RUNTIME_ID'), true);
});

test('wrong line hash blocks with P10_SOURCE_HASH', async () => {
  const { ledgers } = await loadLedgers();
  const copy = structuredClone(ledgers);
  copy[0].data.entries[0].sourceLocator.lineSha256 = '0'.repeat(64);
  assert.equal((await validateLedgerShape(copy, authority)).some((d) => d.code === 'P10_SOURCE_HASH'), true);
});

test('invalid status blocks with P10_LEDGER_SHAPE', async () => {
  const { ledgers } = await loadLedgers();
  const copy = structuredClone(ledgers);
  copy[0].data.entries[0].status = 'DONE';
  assert.equal((await validateLedgerShape(copy, authority)).some((d) => d.code === 'P10_LEDGER_SHAPE'), true);
});

test('REVIEWED slot without independent reviewer blocks', async () => {
  const { ledgers } = await loadLedgers();
  const copy = structuredClone(ledgers);
  const entry = copy[0].data.entries[0];
  entry.status = 'REVIEWED';
  entry.extractor = 'alice';
  entry.review = { reviewer: 'alice', reviewedAt: '2026-01-01T00:00:00Z', verdict: 'APPROVED', defectIds: [] };
  assert.equal((await validateLedgerShape(copy, authority)).some((d) => d.code === 'P10_REVIEW_NOT_INDEPENDENT'), true);
});
