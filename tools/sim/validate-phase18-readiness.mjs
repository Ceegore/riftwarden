#!/usr/bin/env node
import { readFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';

const root = resolve(process.argv[2] ?? '.');
const contractPath = join(root, 'contracts', 'phase19', 'phase18-readiness.expected.json');

function readJson(path) {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

if (!existsSync(contractPath)) {
  console.log(JSON.stringify({ schemaVersion: 1, phase: 19, gate: 'G18', status: 'BLOCKED', blockers: ['P19_G18_NOT_REPRODUCED'], errors: ['phase18-readiness contract missing'] }, null, 2));
  process.exit(2);
}

const contract = readJson(contractPath);
const blockers = [];
const satisfied = [];

// Phase-18 mass-sim evidence (status periodic/expiry soak).
const massSim = readJson(join(root, contract.evidence.massSim.path));
if (!massSim) {
  blockers.push('P19_G18_MASSSIM_MISSING');
} else if (massSim.status !== contract.evidence.massSim.requiredStatus || massSim.battles < contract.evidence.massSim.minBattles) {
  blockers.push('P19_G18_MASSSIM_MISSING');
} else {
  satisfied.push({ id: 'massSim', battles: massSim.battles, status: massSim.status });
}

// Phase-18 cross-runtime evidence (status trace): Node reference + desktop engines.
const crossRuntime = readJson(join(root, contract.evidence.crossRuntime.path));
const section = crossRuntime?.[contract.evidence.crossRuntime.section];
if (!section || section.runtimes?.node?.status !== 'REFERENCE') {
  blockers.push('P19_G18_CROSSRUNTIME_MISSING');
} else {
  const engines = contract.evidence.crossRuntime.requiredEngines;
  const enginesProven = engines.every((key) => section.runtimes[key]?.status === 'PASS');
  if (!enginesProven) {
    blockers.push('P19_G18_CROSSRUNTIME_MISSING');
  } else {
    satisfied.push({ id: 'crossRuntimeDesktop', engines });
  }
  const devicesPending = contract.evidence.crossRuntime.deviceRuntimes.filter(
    (key) => section.runtimes[key]?.status !== 'PASS',
  );
  if (devicesPending.length > 0) blockers.push('P19_G18_WEBVIEWS_NOT_RUN');
  else satisfied.push({ id: 'crossRuntimeDevices', devices: contract.evidence.crossRuntime.deviceRuntimes });
}

// Operator-level blockers that no tool can self-certify.
for (const code of contract.hardBlockers) blockers.push(code);

const status = blockers.length > 0 ? 'BLOCKED' : 'READY';
console.log(JSON.stringify({ schemaVersion: 1, phase: 19, gate: 'G18', status, blockers, satisfied }, null, 2));
process.exit(status === 'READY' ? 0 : 2);
