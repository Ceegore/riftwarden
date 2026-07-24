import { readFile } from 'node:fs/promises';
import { parseArgs } from '../lib/fs-utils.mjs';

const args = parseArgs(process.argv.slice(2));
const contract = JSON.parse(await readFile(args.contract ?? 'ci/branch-protection-contract.json', 'utf8'));
const evidence = JSON.parse(await readFile(args.evidence ?? 'docs/reports/branch-protection-evidence.json', 'utf8'));
const errors = [];
if (evidence.status !== 'VERIFIED') errors.push('status must be VERIFIED');
if (evidence.branch !== contract.target) errors.push(`branch must be ${contract.target}`);
for (const context of contract.requiredStatusChecks) {
  if (!evidence.requiredStatusChecks?.includes(context)) errors.push(`missing required context: ${context}`);
}
for (const key of ['directPushRejected', 'redCheckMergeRejected', 'missingCheckMergeRejected', 'codeOwnerReviewVerified', 'forcePushRejected']) {
  if (evidence.negativeTests?.[key] !== true) errors.push(`negative test not verified: ${key}`);
}
if (!evidence.rulesetExportSha256 || !/^[a-f0-9]{64}$/.test(evidence.rulesetExportSha256)) errors.push('rulesetExportSha256 missing/invalid');
console.log(JSON.stringify({ schemaVersion: 1, ok: errors.length === 0, errors }, null, 2));
if (errors.length) process.exitCode = 1;
