#!/usr/bin/env node
import { readFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';

const root = resolve(process.argv[2] ?? '.');
const contractPath = join(root, 'contracts', 'phase20', 'phase20-readiness.expected.json');

function readJson(path) {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

if (!existsSync(contractPath)) {
  console.log(JSON.stringify({ schemaVersion: 1, phase: 20, gate: 'G20', status: 'BLOCKED', blockers: ['P20_G20_NOT_REPRODUCED'], errors: ['phase20-readiness contract missing'] }, null, 2));
  process.exit(2);
}

const contract = readJson(contractPath);
const blockers = [];
const satisfied = [];

// Phase-20 mass-sim evidence (synergy + summon/expiry soak).
const massSim = readJson(join(root, contract.evidence.massSim.path));
if (!massSim) {
  blockers.push('P20_G20_MASSSIM_MISSING');
} else if (massSim.status !== contract.evidence.massSim.requiredStatus || massSim.battles < contract.evidence.massSim.minBattles || massSim.hashDrift !== 0 || massSim.invariantErrors !== 0) {
  blockers.push('P20_G20_MASSSIM_MISSING');
} else {
  satisfied.push({ id: 'massSim', battles: massSim.battles, status: massSim.status });
}

// Phase-20 cross-runtime evidence: Node reference + desktop engines + devices.
const crossRuntime = readJson(join(root, contract.evidence.crossRuntime.path));
const section = crossRuntime?.[contract.evidence.crossRuntime.section];
if (!section || section.runtimes?.node?.status !== 'REFERENCE') {
  blockers.push('P20_G20_CROSSRUNTIME_MISSING');
} else {
  const engines = contract.evidence.crossRuntime.requiredEngines;
  const enginesProven = engines.every((key) => section.runtimes[key]?.status === 'PASS');
  if (!enginesProven) blockers.push('P20_G20_CROSSRUNTIME_MISSING');
  else satisfied.push({ id: 'crossRuntimeDesktop', engines });
  const devicesPending = contract.evidence.crossRuntime.deviceRuntimes.filter(
    (key) => section.runtimes[key]?.status !== 'PASS',
  );
  if (devicesPending.length > 0) blockers.push('P20_G20_WEBVIEWS_NOT_RUN');
  else satisfied.push({ id: 'crossRuntimeDevices', devices: contract.evidence.crossRuntime.deviceRuntimes });
}

// Pinned golden reference trace (§8 snapshot/replay determinism).
const referenceTrace = readJson(join(root, contract.evidence.referenceTrace.path));
if (!referenceTrace || !Array.isArray(referenceTrace.checkpoints) || referenceTrace.checkpoints.length === 0 || !referenceTrace.finalSnapshotChecksum) {
  blockers.push('P20_G20_REFERENCE_TRACE_MISSING');
} else {
  satisfied.push({ id: 'referenceTrace', checkpoints: referenceTrace.checkpoints.length });
}

// The six Phase 20 modules plus the runtime systems module must exist (§10).
const missingModules = contract.evidence.modules.filter((m) => !existsSync(join(root, m)));
if (missingModules.length > 0) {
  blockers.push('P20_G20_MODULES_MISSING');
} else {
  satisfied.push({ id: 'modules', count: contract.evidence.modules.length });
}

// Operator-level blockers that no tool can self-certify.
for (const code of contract.hardBlockers) blockers.push(code);

const status = blockers.length > 0 ? 'BLOCKED' : 'READY';
console.log(JSON.stringify({ schemaVersion: 1, phase: 20, gate: 'G20', status, blockers, satisfied }, null, 2));
process.exit(status === 'READY' ? 0 : 2);
