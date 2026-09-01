#!/usr/bin/env node
import path from 'node:path';
import { parseArgs } from '../../lib/fs-utils.mjs';
import { loadJson, loadLedgers } from './lib/load-ledgers.mjs';
import { validateCounts } from './lib/counts.mjs';
import { validateLedgerShape } from './lib/ledger.mjs';

const args = parseArgs(process.argv.slice(2));
const indexDir = path.resolve(args['index-dir'] ?? args.indexDir ?? 'docs/reports/content-ledger');
const authorityPath = path.resolve(args.authority ?? 'inputs/sources/GDD_V5_PHASE10_AUTHORITY_EXTRACT.md');
const counts = await loadJson(path.resolve(args['release-counts'] ?? args.releaseCounts ?? 'contracts/release-counts.json'));
const { index, indexError, ledgers } = await loadLedgers(indexDir);
const allEntries = ledgers.flatMap((ledger) => (ledger.data ? ledger.data.entries : []));

const diagnostics = [];
if (indexError) {
  diagnostics.push({ code: 'P10_LEDGER_SHAPE', message: indexError, pointer: indexDir });
}
const unreviewed = allEntries.filter((entry) => entry.status !== 'REVIEWED');
for (const entry of unreviewed) {
  diagnostics.push({ code: 'P10_UNEXTRACTED', message: `Slot ${entry.slotId} is ${entry.status}; release requires REVIEWED.`, pointer: entry.slotId });
}
const shapeDiagnostics = indexError ? [] : await validateLedgerShape(ledgers, authorityPath);
const countDiagnostics = indexError ? [] : validateCounts(index, ledgers, counts);
const clean = diagnostics.length === 0 && shapeDiagnostics.length === 0 && countDiagnostics.length === 0;
const structural = indexError || shapeDiagnostics.length > 0 || countDiagnostics.length > 0;

const report = {
  schemaVersion: 1,
  status: clean ? 'PASS' : structural ? 'FAIL' : 'BLOCKED',
  totals: { slots: allEntries.length, reviewed: allEntries.length - unreviewed.length, unreviewed: unreviewed.length },
  diagnostics: [...diagnostics, ...shapeDiagnostics, ...countDiagnostics]
};
console.log(JSON.stringify(report, null, 2));
if (!clean) process.exitCode = structural ? 1 : 2;
