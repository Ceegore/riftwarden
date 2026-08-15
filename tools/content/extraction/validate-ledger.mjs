#!/usr/bin/env node
import path from 'node:path';
import { loadLedgers } from './lib/load-ledgers.mjs';
import { validateLedgerShape } from './lib/ledger.mjs';

const indexDir = path.resolve('docs/reports/content-ledger');
const authorityPath = path.resolve('inputs/sources/GDD_V5_PHASE10_AUTHORITY_EXTRACT.md');
const { ledgers } = await loadLedgers(indexDir);
const diagnostics = await validateLedgerShape(ledgers, authorityPath);
const report = { schemaVersion: 1, ok: diagnostics.length === 0, diagnostics };
console.log(JSON.stringify(report, null, 2));
if (diagnostics.length) process.exitCode = 1;
