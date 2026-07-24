#!/usr/bin/env node
import { resolve } from 'node:path';
import { summarizeIssues } from './lib/shared.mjs';
import { validatePhaseReport } from './lib/validate-phase-report.mjs';

const [reportPath = 'docs/reports/phase-00.json', root = '.'] = process.argv.slice(2);
const result = await validatePhaseReport(resolve(root), reportPath);
for (const item of result.issues) {
  console.log(`${item.severity.toUpperCase()} ${item.code}: ${item.message}${item.path ? ` (${item.path})` : ''}`);
}
const totals = summarizeIssues(result.issues);
console.log(`Result: ${totals.error === 0 ? 'PASS' : 'FAIL'}; errors=${totals.error}, warnings=${totals.warning}`);
process.exitCode = totals.error === 0 ? 0 : 1;
