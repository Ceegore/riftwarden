#!/usr/bin/env node
import path from 'node:path';
import { loadJson, loadLedgers } from './lib/load-ledgers.mjs';
import { validateCounts } from './lib/counts.mjs';

const indexDir = path.resolve('docs/reports/content-ledger');
const counts = await loadJson(path.resolve('contracts/release-counts.json'));
const { index, ledgers } = await loadLedgers(indexDir);
const byFamily = new Map(ledgers.map((ledger) => [ledger.family, ledger]));

const rows = [];
for (const fam of index.families) {
  const expected = counts.gateCritical[fam.family] ?? counts.supplementaryAuthoritative[fam.family];
  const actual = byFamily.get(fam.family)?.data.entries.length ?? 0;
  rows.push({
    family: fam.family,
    category: fam.category,
    expected,
    actual,
    status: actual === expected ? 'PASS' : 'FAIL'
  });
}
const total = rows.reduce((sum, row) => sum + row.actual, 0);
console.log(JSON.stringify({ schemaVersion: 1, source: counts.source, gateCritical: counts.totals.gateCritical, supplementary: counts.totals.supplementaryAuthoritative, totalSlots: total, rows }, null, 2));
const diagnostics = validateCounts(index, ledgers, counts);
if (diagnostics.length) process.exitCode = 1;
