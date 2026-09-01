#!/usr/bin/env node
import { readFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';

const root = resolve(process.argv[2] ?? '.');
const contractPath = join(root, 'contracts', 'phase19', 'phase19-readiness.expected.json');

function readJson(path) {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

if (!existsSync(contractPath)) {
  console.log(JSON.stringify({ schemaVersion: 1, phase: 19, gate: 'G19', status: 'BLOCKED', blockers: ['P19_G19_NOT_REPRODUCED'], errors: ['phase19-readiness contract missing'] }, null, 2));
  process.exit(2);
}

const contract = readJson(contractPath);
const blockers = [];
const satisfied = [];

// Phase-19 mass-sim evidence (ability-trigger soak). The machine cannot
// complete the historical 10000-battle soak within a single bounded run, so
// the contract pins 5000 (documented in the Phase 19 report).
const massSim = readJson(join(root, contract.evidence.massSim.path));
if (!massSim) {
  blockers.push('P19_G19_MASSSIM_MISSING');
} else if (massSim.status !== contract.evidence.massSim.requiredStatus || massSim.battles < contract.evidence.massSim.minBattles || massSim.hashDrift !== 0 || massSim.invariantErrors !== 0) {
  blockers.push('P19_G19_MASSSIM_MISSING');
} else {
  satisfied.push({ id: 'massSim', battles: massSim.battles, status: massSim.status });
}

// Phase-19 cross-runtime evidence (ability trace): Node reference + desktop engines + devices.
const crossRuntime = readJson(join(root, contract.evidence.crossRuntime.path));
const section = crossRuntime?.[contract.evidence.crossRuntime.section];
if (!section || section.runtimes?.node?.status !== 'REFERENCE') {
  blockers.push('P19_G19_CROSSRUNTIME_MISSING');
} else {
  const engines = contract.evidence.crossRuntime.requiredEngines;
  const enginesProven = engines.every((key) => section.runtimes[key]?.status === 'PASS');
  if (!enginesProven) blockers.push('P19_G19_CROSSRUNTIME_MISSING');
  else satisfied.push({ id: 'crossRuntimeDesktop', engines });
  const devicesPending = contract.evidence.crossRuntime.deviceRuntimes.filter(
    (key) => section.runtimes[key]?.status !== 'PASS',
  );
  if (devicesPending.length > 0) blockers.push('P19_G19_WEBVIEWS_NOT_RUN');
  else satisfied.push({ id: 'crossRuntimeDevices', devices: contract.evidence.crossRuntime.deviceRuntimes });
}

// Pinned golden reference trace (§11 save/resume determinism).
const referenceTrace = readJson(join(root, contract.evidence.referenceTrace.path));
if (!referenceTrace || !Array.isArray(referenceTrace.checkpoints) || referenceTrace.checkpoints.length === 0 || !referenceTrace.finalSnapshotChecksum) {
  blockers.push('P19_G19_REFERENCE_TRACE_MISSING');
} else {
  satisfied.push({ id: 'referenceTrace', checkpoints: referenceTrace.checkpoints.length });
}

// Coverage inventory module (§10, §16): must exist to detect content abilities
// lacking contract tests.
if (!existsSync(join(root, contract.evidence.coverage.module))) {
  blockers.push('P19_G19_COVERAGE_MISSING');
} else {
  satisfied.push({ id: 'coverageInventory', module: contract.evidence.coverage.module });
}

// Operator-level blockers that no tool can self-certify.
for (const code of contract.hardBlockers) blockers.push(code);

const status = blockers.length > 0 ? 'BLOCKED' : 'READY';
console.log(JSON.stringify({ schemaVersion: 1, phase: 19, gate: 'G19', status, blockers, satisfied }, null, 2));
process.exit(status === 'READY' ? 0 : 2);
