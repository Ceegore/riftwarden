#!/usr/bin/env node
import { readFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';

const root = resolve(process.argv[2] ?? '.');
const contractPath = join(root, 'contracts', 'phase15', 'phase14-readiness.expected.json');

function readJson(path) {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

if (!existsSync(contractPath)) {
  console.log(JSON.stringify({ schemaVersion: 1, phase: 15, gate: 'G14', status: 'BLOCKED', blockers: ['P15_G14_NOT_REPRODUCED'], errors: ['phase14-readiness contract missing'] }, null, 2));
  process.exit(2);
}

const contract = readJson(contractPath);
const blockers = [];
const satisfied = [];

// Mass-sim evidence (Node reference performance).
const massSim = readJson(join(root, contract.evidence.massSim.path));
if (!massSim) {
  blockers.push('P15_G14_MASSSIM_MISSING');
} else if (massSim.status !== contract.evidence.massSim.requiredStatus || massSim.battles < contract.evidence.massSim.minBattles) {
  blockers.push('P15_G14_MASSSIM_MISSING');
} else {
  satisfied.push({ id: 'massSim', battles: massSim.battles, status: massSim.status });
}

// Cross-runtime evidence (Node + desktop engines hash-identical).
const crossRuntime = readJson(join(root, contract.evidence.crossRuntime.path));
if (!crossRuntime || crossRuntime.runtimes?.node?.status !== 'REFERENCE') {
  blockers.push('P15_G14_CROSSRUNTIME_MISSING');
} else {
  const engines = contract.evidence.crossRuntime.requiredEngines;
  const enginesProven = engines.every((key) => crossRuntime.runtimes[key]?.status === 'PASS');
  if (!enginesProven) {
    blockers.push('P15_G14_CROSSRUNTIME_MISSING');
  } else {
    satisfied.push({ id: 'crossRuntimeDesktop', engines });
  }
  const devicesPending = contract.evidence.crossRuntime.deviceRuntimes.filter(
    (key) => crossRuntime.runtimes[key]?.status !== 'PASS',
  );
  if (devicesPending.length > 0) blockers.push('P15_G14_WEBVIEWS_NOT_RUN');
  else satisfied.push({ id: 'crossRuntimeDevices', devices: contract.evidence.crossRuntime.deviceRuntimes });
}

// Operator-level blockers that no tool can self-certify: a documented G14
// reproduction and target-device performance evidence.
for (const code of contract.hardBlockers) blockers.push(code);

const status = blockers.length > 0 ? 'BLOCKED' : 'READY';
console.log(JSON.stringify({ schemaVersion: 1, phase: 15, gate: 'G14', status, blockers, satisfied }, null, 2));
process.exit(status === 'READY' ? 0 : 2);
