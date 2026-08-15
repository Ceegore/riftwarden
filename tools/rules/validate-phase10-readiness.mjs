#!/usr/bin/env node
import { resolve } from 'node:path';
import { auditPhase10 } from './lib/phase10-readiness.mjs';

const ledgerDir = resolve(process.argv[2] ?? 'docs/reports/content-ledger');
const report = auditPhase10(ledgerDir);
console.log(JSON.stringify(report, null, 2));
process.exitCode = report.status === 'PASS' ? 0 : 2;
