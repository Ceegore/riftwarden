#!/usr/bin/env node
import { readFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';

const root = resolve(process.argv[2] ?? '.');
const contractPath = join(root, 'contracts', 'phase18', 'phase17-readiness.expected.json');

function readJson(path) {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

if (!existsSync(contractPath)) {
  console.log(JSON.stringify({ schemaVersion: 1, phase: 18, gate: 'G17', status: 'BLOCKED', blockers: ['P18_G17_NOT_REPRODUCED'], errors: ['phase17-readiness contract missing'] }, null, 2));
  process.exit(2);
}

const contract = readJson(contractPath);
const blockers = [];
const satisfied = [];

// Phase-17 mass-sim evidence (Node reference performance for the Phase 17 kernel).
const massSim = readJson(join(root, contract.evidence.massSim.path));
if (!massSim) {
  blockers.push('P18_G17_MASSSIM_MISSING');
} else if (massSim.status !== contract.evidence.massSim.requiredStatus || massSim.battles < contract.evidence.massSim.minBattles) {
  blockers.push('P18_G17_MASSSIM_MISSING');
} else {
  satisfied.push({ id: 'massSim', battles: massSim.battles, status: massSim.status });
}

// Phase-17 cross-runtime evidence (phase17 basic-attack trace + phase17jl
// defeat/collapse/battle-end trace): Node reference + desktop engines.
const crossRuntime = readJson(join(root, contract.evidence.crossRuntime.path));
const engines = contract.evidence.crossRuntime.requiredEngines;
const devicesPending = new Set();
let sectionsOk = true;
for (const sectionName of contract.evidence.crossRuntime.sections) {
  const section = crossRuntime?.[sectionName];
  if (!section || section.runtimes?.node?.status !== 'REFERENCE') {
    sectionsOk = false;
    continue;
  }
  for (const key of engines) {
    if (section.runtimes[key]?.status !== 'PASS') sectionsOk = false;
  }
  for (const key of contract.evidence.crossRuntime.deviceRuntimes) {
    if (section.runtimes[key]?.status !== 'PASS') devicesPending.add(key);
  }
}
if (!crossRuntime || !sectionsOk) {
  blockers.push('P18_G17_CROSSRUNTIME_MISSING');
} else {
  satisfied.push({ id: 'crossRuntimeDesktop', sections: contract.evidence.crossRuntime.sections, engines });
}
if (devicesPending.size > 0) {
  blockers.push('P18_G17_WEBVIEWS_NOT_RUN');
} else {
  satisfied.push({ id: 'crossRuntimeDevices', devices: contract.evidence.crossRuntime.deviceRuntimes });
}

// Operator-level blockers that no tool can self-certify.
for (const code of contract.hardBlockers) blockers.push(code);

const status = blockers.length > 0 ? 'BLOCKED' : 'READY';
console.log(JSON.stringify({ schemaVersion: 1, phase: 18, gate: 'G17', status, blockers, satisfied }, null, 2));
process.exit(status === 'READY' ? 0 : 2);
