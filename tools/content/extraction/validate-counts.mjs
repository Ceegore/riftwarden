#!/usr/bin/env node
import path from 'node:path';
import { loadJson, loadLedgers } from './lib/load-ledgers.mjs';
import { validateCounts } from './lib/counts.mjs';

const indexDir = path.resolve('docs/reports/content-ledger');
const counts = await loadJson(path.resolve('contracts/release-counts.json'));
const { index, ledgers } = await loadLedgers(indexDir);
const diagnostics = validateCounts(index, ledgers, counts);
const report = { schemaVersion: 1, ok: diagnostics.length === 0, diagnostics };
console.log(JSON.stringify(report, null, 2));
if (diagnostics.length) process.exitCode = 1;
