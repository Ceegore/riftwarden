#!/usr/bin/env node
import path from 'node:path';
import { parseArgs } from '../../lib/fs-utils.mjs';
import { loadJson, loadLedgers } from './lib/load-ledgers.mjs';
import { validateCounts } from './lib/counts.mjs';

const args = parseArgs(process.argv.slice(2));
const indexDir = path.resolve(args['index-dir'] ?? args.indexDir ?? 'docs/reports/content-ledger');
const counts = await loadJson(path.resolve(args['release-counts'] ?? args.releaseCounts ?? 'contracts/release-counts.json'));
const { index, ledgers } = await loadLedgers(indexDir);
const diagnostics = validateCounts(index, ledgers, counts);
const report = { schemaVersion: 1, ok: diagnostics.length === 0, diagnostics };
console.log(JSON.stringify(report, null, 2));
if (diagnostics.length) process.exitCode = 1;
