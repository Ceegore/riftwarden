import { readFile } from 'node:fs/promises';
import { parseArgs } from '../lib/fs-utils.mjs';

const args = parseArgs(process.argv.slice(2));
const phase = Number(args.phase ?? process.env.RIFTWARDEN_IMPLEMENTATION_PHASE ?? 3);
const registry = JSON.parse(await readFile(args.registry ?? 'ci/phase-gates.json', 'utf8'));
const errors = [];
for (const check of registry.checks) {
  if (!Number.isInteger(check.ownerPhase) || !Number.isInteger(check.requiredFromPhase)) errors.push(`${check.id}: phases must be integers`);
  if (check.requiredFromPhase < check.ownerPhase) errors.push(`${check.id}: required before owner phase`);
  if (!check.command?.startsWith('pnpm ')) errors.push(`${check.id}: command must use stable pnpm script`);
}
console.log(JSON.stringify({ schemaVersion: 1, phase, ok: errors.length === 0, errors }, null, 2));
if (errors.length) process.exitCode = 1;
