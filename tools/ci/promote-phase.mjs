#!/usr/bin/env node
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parseArgs } from '../lib/fs-utils.mjs';

/**
 * Operator step for promoting the CI implementation phase. The phase lives in
 * exactly four places and every promotion must move all of them together:
 *
 *   1. ci/phase-gates.json      → currentImplementationPhase
 *   2. ci/required-checks.json  → implementationPhase
 *   3. RIFTWARDEN_IMPLEMENTATION_PHASE env in every workflow file
 *   4. `--phase N` CLI args in workflow files (gate map, manifest, aggregate)
 *
 * This tool rewrites all four consistently, validates the registries and the
 * aggregate contract after the promotion, and only ever moves forward
 * (backward and no-op promotions are refused; catch-up jumps are allowed).
 */
const args = parseArgs(process.argv.slice(2));
const root = resolve(args.root ?? '.');
const target = Number(args.to ?? process.env.RIFTWARDEN_PROMOTE_TO ?? '');
const dryRun = args['dry-run'] === 'true' || args['dry-run'] === true;

if (!Number.isSafeInteger(target) || target < 1) {
  console.error('usage: promote-phase.mjs --to <phase> [--root <dir>] [--dry-run true]');
  process.exit(2);
}

const phaseGatesPath = resolve(root, 'ci', 'phase-gates.json');
const requiredChecksPath = resolve(root, 'ci', 'required-checks.json');
const workflowsDir = resolve(root, '.github', 'workflows');

const phaseGates = JSON.parse(await readFile(phaseGatesPath, 'utf8'));
const requiredChecks = JSON.parse(await readFile(requiredChecksPath, 'utf8'));

const current = phaseGates.currentImplementationPhase;
if (requiredChecks.implementationPhase !== current) {
  console.error(`inconsistent current phase: phase-gates=${current} required-checks=${requiredChecks.implementationPhase}`);
  process.exit(2);
}
if (target <= current) {
  console.error(`refusing to go backward or stay: current=${current} target=${target} (target must be greater)`);
  process.exit(2);
}

const workflowFiles = (await readdir(workflowsDir)).filter((name) => /\.ya?ml$/i.test(name)).sort();
const workflowPaths = workflowFiles.map((name) => resolve(workflowsDir, name));
const touched = [];

async function rewrite(path, transform) {
  const text = await readFile(path, 'utf8');
  const next = transform(text);
  if (next === text) return false;
  if (!dryRun) await writeFile(path, next);
  touched.push(path);
  return true;
}

for (const path of workflowPaths) {
  await rewrite(path, (text) => text.replaceAll(`RIFTWARDEN_IMPLEMENTATION_PHASE: '${String(current)}'`, `RIFTWARDEN_IMPLEMENTATION_PHASE: '${String(target)}'`));
  await rewrite(path, (text) => text.replaceAll(`--phase ${current}`, `--phase ${target}`));
}

if (!dryRun) {
  phaseGates.currentImplementationPhase = target;
  requiredChecks.implementationPhase = target;
  await writeFile(phaseGatesPath, `${JSON.stringify(phaseGates, null, 2)}\n`);
  await writeFile(requiredChecksPath, `${JSON.stringify(requiredChecks, null, 2)}\n`);
  touched.push(phaseGatesPath, requiredChecksPath);
}

// Validate the promoted registries (schema/order checks) with the existing tool.
const { execFileSync } = await import('node:child_process');
let validation;
try {
  const out = execFileSync(process.execPath, [resolve(root, 'tools', 'ci', 'validate-phase-flags.mjs'), '--phase', String(target), '--registry', phaseGatesPath], { encoding: 'utf8' });
  validation = JSON.parse(out);
} catch (error) {
  validation = { ok: false, errors: [error.message] };
}

const result = {
  schemaVersion: 1,
  fromPhase: current,
  toPhase: target,
  dryRun,
  touched,
  validation,
  ok: validation.ok,
};
console.log(JSON.stringify(result, null, 2));
if (!validation.ok) process.exitCode = 1;
