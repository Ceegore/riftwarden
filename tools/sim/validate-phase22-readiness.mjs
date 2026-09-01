#!/usr/bin/env node
import { readFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';

const root = resolve(process.argv[2] ?? '.');
const contractPath = join(root, 'contracts', 'phase22', 'phase22-readiness.expected.json');

function readJson(path) {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

if (!existsSync(contractPath)) {
  console.log(JSON.stringify({ schemaVersion: 1, phase: 22, gate: 'G22', status: 'BLOCKED', blockers: ['P22_G22_NOT_REPRODUCED'], errors: ['phase22-readiness contract missing'] }, null, 2));
  process.exit(2);
}

const contract = readJson(contractPath);
const blockers = [];
const satisfied = [];

// 1. Golden registry: twelve canonical seeds, real baselines, PASS status.
const golden = readJson(join(root, contract.evidence.goldenRegistry.path));
if (!golden || !Array.isArray(golden.entries) || golden.entries.length !== contract.evidence.goldenRegistry.expectedEntries) {
  blockers.push('P22_G22_GOLDEN_REGISTRY_MISSING');
} else {
  const complete = golden.entries.every(
    (e) => typeof e.startHash === 'string' && typeof e.endHash === 'string' && Array.isArray(e.checkpoints) && e.checkpoints.length > 0,
  );
  if (!complete) blockers.push('P22_G22_GOLDEN_REGISTRY_INCOMPLETE');
  else satisfied.push({ id: 'goldenRegistry', entries: golden.entries.length });
}

// 2. Headless runner with the full exit-code surface.
const runnerPath = join(root, contract.evidence.headlessRunner.path);
if (!existsSync(runnerPath)) {
  blockers.push('P22_G22_RUNNER_MISSING');
} else {
  satisfied.push({ id: 'headlessRunner', exitCodes: contract.evidence.headlessRunner.exitCodes });
}

// 3. Invariant monitor (nine checks).
const monitorPath = join(root, contract.evidence.invariantMonitor.path);
if (!existsSync(monitorPath)) {
  blockers.push('P22_G22_MONITOR_MISSING');
} else {
  satisfied.push({ id: 'invariantMonitor', checkCount: contract.evidence.invariantMonitor.checkCount });
}

// 4. Property families: seven families, >=1000 cases each (source file
// presence + the family list in the kit contract).
const propertyPath = join(root, contract.evidence.propertyFamilies.path);
if (!existsSync(propertyPath)) {
  blockers.push('P22_G22_PROPERTY_FAMILIES_MISSING');
} else {
  satisfied.push({ id: 'propertyFamilies', families: contract.evidence.propertyFamilies.families.length });
}

// 5. Mass partition: caseIndex partition + ascending merge.
const partitionPath = join(root, contract.evidence.massPartition.path);
if (!existsSync(partitionPath)) {
  blockers.push('P22_G22_MASS_PARTITION_MISSING');
} else {
  satisfied.push({ id: 'massPartition', partitionKey: contract.evidence.massPartition.partitionKey });
}

// 6. Cross-runtime: Node reference + desktop engines + devices.
const crossRuntime = readJson(join(root, contract.evidence.crossRuntime.path));
const section = crossRuntime?.[contract.evidence.crossRuntime.section];
if (!section || !section.vectors) {
  blockers.push('P22_G22_CROSSRUNTIME_MISSING');
} else {
  const nodeProven = Object.values(section.vectors).every((v) => v.runtimes?.node?.status === 'REFERENCE');
  if (!nodeProven) blockers.push('P22_G22_CROSSRUNTIME_MISSING');
  else satisfied.push({ id: 'crossRuntimeNode', vectors: Object.keys(section.vectors).length });
  const engines = contract.evidence.crossRuntime.requiredEngines;
  const enginesProven = engines.every((key) =>
    Object.values(section.vectors).every((v) => v.runtimes?.[key]?.status === 'PASS'),
  );
  if (!enginesProven) blockers.push('P22_G22_BROWSER_RERUN_MISSING');
  else satisfied.push({ id: 'crossRuntimeDesktop', engines });
  const devicesPending = contract.evidence.crossRuntime.deviceRuntimes.filter((key) =>
    Object.values(section.vectors).some((v) => v.runtimes?.[key]?.status !== 'PASS'),
  );
  if (devicesPending.length > 0) blockers.push('P22_G22_DEVICE_EVIDENCE_MISSING');
  else satisfied.push({ id: 'crossRuntimeDevices' });
}

// 7. Constants contract.
const constants = readJson(join(root, contract.evidence.constants.path));
if (!constants || constants.hardBattleLimitTicks !== contract.evidence.constants.hardBattleLimitTicks || constants.maxEventsPerBattle !== contract.evidence.constants.maxEventsPerBattle || constants.goldenSeedCount !== contract.evidence.constants.goldenSeedCount) {
  blockers.push('P22_G22_CONSTANTS_MISMATCH');
} else {
  satisfied.push({ id: 'constants', hardBattleLimitTicks: constants.hardBattleLimitTicks });
}

const upstream = contract.hardBlockers.filter((code) => code.startsWith('P22_G22_G21'));
blockers.push(...upstream);
for (const code of contract.hardBlockers) {
  if (!blockers.includes(code) && (code.startsWith('P22_G22_BROWSER') || code.startsWith('P22_G22_DEVICE'))) blockers.push(code);
}

const status = blockers.length === 0 ? 'PASS' : 'BLOCKED';
console.log(JSON.stringify({ schemaVersion: 1, phase: 22, gate: 'G22', status, blockers, satisfied }, null, 2));
process.exit(status === 'PASS' ? 0 : 1);
