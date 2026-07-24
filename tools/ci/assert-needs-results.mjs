import { readFile } from 'node:fs/promises';
import { parseArgs } from '../lib/fs-utils.mjs';

const args = parseArgs(process.argv.slice(2));
const phase = Number(args.phase ?? process.env.RIFTWARDEN_IMPLEMENTATION_PHASE ?? 3);
const needs = JSON.parse(process.env.NEEDS_JSON ?? args.needs ?? '{}');
const contract = JSON.parse(await readFile(args.contract ?? 'ci/required-checks.json', 'utf8'));
const phased = new Map(contract.phasedJobs.map((x) => [x.job, x]));
const errors = [];

for (const job of contract.activeJobs) {
  const result = needs[job]?.result;
  if (result !== 'success') errors.push(`${job}: expected success, received ${result ?? 'missing'}`);
}
for (const [job, rule] of phased) {
  const result = needs[job]?.result;
  const expected = phase >= rule.activationPhase ? 'success' : rule.expectedBeforeActivation;
  if (result !== expected) errors.push(`${job}: expected ${expected} at phase ${phase}, received ${result ?? 'missing'}`);
}
const output = { schemaVersion: 1, phase, ok: errors.length === 0, errors };
console.log(JSON.stringify(output, null, 2));
if (errors.length) process.exitCode = 1;
