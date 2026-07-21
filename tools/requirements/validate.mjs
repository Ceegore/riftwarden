#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { parseArgs, stableJson, summarizeIssues } from './lib/shared.mjs';
import { validateSource } from './lib/validate-source.mjs';
import { validateRequirements } from './lib/validate-requirements.mjs';
import { validateExternalDecisions, validateNormalizationLedger } from './lib/validate-ledgers.mjs';
import { validateTests, validateTraceability } from './lib/validate-traceability.mjs';

function usage() {
  console.log(`Usage: node tools/requirements/validate.mjs [options]\n\nOptions:\n  --root <path>       Repository root (default: .)\n  --mode draft|gate  Draft tolerates unfinished source presence; gate enforces G00\n  --json <path>       Write deterministic JSON report\n  -h, --help          Show help`);
}

function printIssues(issues) {
  for (const item of issues) {
    const location = item.path ? ` (${item.path})` : '';
    console.log(`${item.severity.toUpperCase()} ${item.code}${location}: ${item.message}`);
    if (item.details) console.log(`  ${JSON.stringify(item.details)}`);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    usage();
    return;
  }
  const root = resolve(args.root);
  const source = await validateSource(root, args.mode);
  const requirements = await validateRequirements(root, args.mode);
  const requirementIds = new Set(requirements.requirements.map((entry) => entry.id));
  const normalization = await validateNormalizationLedger(root, args.mode, requirementIds);
  const external = await validateExternalDecisions(root);
  const tests = await validateTests(root);
  const traceability = await validateTraceability(
    root,
    args.mode,
    requirements.requirements,
    tests.tests,
    normalization.records,
  );

  const issues = [
    ...source.issues,
    ...requirements.issues,
    ...normalization.issues,
    ...external.issues,
    ...tests.issues,
    ...traceability.issues,
  ].sort((left, right) => {
    const severityOrder = { error: 0, warning: 1, info: 2 };
    return severityOrder[left.severity] - severityOrder[right.severity]
      || left.code.localeCompare(right.code)
      || String(left.path).localeCompare(String(right.path));
  });
  const totals = summarizeIssues(issues);
  const report = {
    schemaVersion: 1,
    mode: args.mode,
    root,
    result: totals.error === 0 ? 'PASS' : 'FAIL',
    totals,
    counts: {
      requirements: requirements.requirements.length,
      tests: tests.tests.length,
      normalizationRecords: normalization.records.length,
      traceabilityLinks: traceability.links.length,
    },
    issues,
  };

  printIssues(issues);
  console.log(`\nResult: ${report.result}; errors=${totals.error}, warnings=${totals.warning}, info=${totals.info}`);
  if (args.json) {
    const output = resolve(root, args.json);
    await mkdir(dirname(output), { recursive: true });
    await writeFile(output, stableJson(report), 'utf8');
    console.log(`Report: ${output}`);
  }
  process.exitCode = totals.error === 0 ? 0 : 1;
}

main().catch((error) => {
  console.error(`FATAL: ${error.stack ?? error.message}`);
  process.exitCode = 2;
});
