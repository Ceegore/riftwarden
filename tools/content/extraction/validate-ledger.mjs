#!/usr/bin/env node
import path from 'node:path';
import { parseArgs } from '../../lib/fs-utils.mjs';
import { loadLedgers } from './lib/load-ledgers.mjs';
import { validateLedgerShape } from './lib/ledger.mjs';

const args = parseArgs(process.argv.slice(2));
const indexDir = path.resolve(args['index-dir'] ?? args.indexDir ?? 'docs/reports/content-ledger');
const authorityPath = path.resolve(args.authority ?? 'inputs/sources/GDD_V5_PHASE10_AUTHORITY_EXTRACT.md');
const { ledgers, indexError } = await loadLedgers(indexDir);
const diagnostics = indexError ? [{ code: 'P10_LEDGER_SHAPE', message: indexError, pointer: indexDir }] : await validateLedgerShape(ledgers, authorityPath);
const report = { schemaVersion: 1, ok: diagnostics.length === 0, diagnostics };
console.log(JSON.stringify(report, null, 2));
if (diagnostics.length) process.exitCode = 1;
