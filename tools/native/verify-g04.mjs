#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { exists, readText, writeJsonStdout } from './lib.mjs';

const root = path.resolve(process.argv[2] ?? '.');
const evidencePath = path.join(root, 'docs/reports/phase-04-evidence.json');
const required = [
  'sourceRevision', 'lockfileSha256', 'g03Evidence', 'capSyncClean', 'androidConfigScan',
  'androidOfflineSmoke', 'iosConfigScan', 'iosOfflineSmoke', 'pluginContractParity', 'mainCiRun'
];
const findings = [];
if (!(await exists(evidencePath))) {
  findings.push({ severity: 'blocked', message: `Missing ${evidencePath}` });
} else {
  const evidence = JSON.parse(await readText(evidencePath));
  for (const field of required) {
    if (!evidence[field] || evidence[field].status !== 'PASS' || !evidence[field].artifact) {
      findings.push({ severity: 'blocked', field, message: `${field} lacks PASS plus artifact.` });
    }
  }
  if (evidence.gateDecision === 'PASS' && findings.length) findings.push({ severity: 'error', message: 'Unproved PASS is forbidden.' });
}
for (const tool of ['verify-config.mjs', 'verify-plugin-contracts.mjs']) {
  try { execFileSync(process.execPath, [path.join(root, 'tools/native', tool), root], { stdio: 'pipe' }); }
  catch (error) { findings.push({ severity: 'error', tool, message: error instanceof Error ? error.message : String(error) }); }
}
const errors = findings.filter((f) => f.severity === 'error').length;
const report = { schemaVersion: 1, status: errors ? 'FAIL' : findings.length ? 'BLOCKED' : 'PASS', findings };
await writeJsonStdout(report);
process.exitCode = errors ? 1 : findings.length ? 2 : 0;
