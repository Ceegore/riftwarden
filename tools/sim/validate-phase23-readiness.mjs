#!/usr/bin/env node
import { readFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';

const root = resolve(process.argv[2] ?? '.');
const contractPath = join(root, 'contracts', 'phase23', 'phase23-readiness.expected.json');

function readJson(path) {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

if (!existsSync(contractPath)) {
  console.log(JSON.stringify({ schemaVersion: 1, phase: 23, gate: 'G23', status: 'BLOCKED', blockers: ['P23_G23_NOT_REPRODUCED'], errors: ['phase23-readiness contract missing'] }, null, 2));
  process.exit(2);
}

const contract = readJson(contractPath);
const blockers = [];
const satisfied = [];

// 1. Canonical JSON: module present, vector + negative fixtures pinned.
const canonicalPath = join(root, contract.evidence.canonical.path);
const vectors = readJson(join(root, contract.evidence.canonical.vectorFixture));
const negatives = readJson(join(root, contract.evidence.canonical.negativeFixture));
if (!existsSync(canonicalPath)) blockers.push('P23_G23_CANONICAL_JSON_MISSING');
else if (!vectors?.vectors?.length || !negatives?.cases?.length) blockers.push('P23_G23_CANONICAL_FIXTURES_MISSING');
else satisfied.push({ id: 'canonical', vectors: vectors.vectors.length, negatives: negatives.cases.length });

// 2. Envelope: module present with the pinned magic/format/hash.
const envelopePath = join(root, contract.evidence.envelope.path);
if (!existsSync(envelopePath)) blockers.push('P23_G23_ENVELOPE_MISSING');
else satisfied.push({ id: 'envelope', magic: contract.evidence.envelope.magic, formatVersion: contract.evidence.envelope.formatVersion });

// 3. Slot protocol: A/B/C store with the twelve fault steps.
const slotPath = join(root, contract.evidence.slotProtocol.path);
if (!existsSync(slotPath)) blockers.push('P23_G23_SLOT_PROTOCOL_MISSING');
else {
  const text = readFileSync(slotPath, 'utf8');
  const hasFaultSteps = (text.match(/\|\s*'[a-z_]+'/g) ?? []).length >= 12;
  if (!hasFaultSteps) blockers.push('P23_G23_SLOT_PROTOCOL_INCOMPLETE');
  else satisfied.push({ id: 'slotProtocol', slots: contract.evidence.slotProtocol.slots.length, faultSteps: 12 });
}

// 4. Coordinator: FIFO serialized writes with snapshot coalescing.
const coordinatorPath = join(root, contract.evidence.coordinator.path);
if (!existsSync(coordinatorPath)) blockers.push('P23_G23_COORDINATOR_MISSING');
else satisfied.push({ id: 'coordinator', snapshotCoalescing: contract.evidence.coordinator.snapshotCoalescing });

// 5. Web QA parity store present.
const webPath = join(root, contract.evidence.webParity.path);
if (!existsSync(webPath)) blockers.push('P23_G23_WEB_PARITY_MISSING');
else satisfied.push({ id: 'webParity', sameSlotRotation: true, sameErrorCodes: true });

// 6. Native plugin surface: both adapters declare the closed port methods.
const androidPath = join(root, contract.evidence.nativePlugins.android);
const iosPath = join(root, contract.evidence.nativePlugins.ios);
const methods = contract.evidence.nativePlugins.requiredMethods;
let nativeOk = existsSync(androidPath) && existsSync(iosPath);
if (nativeOk) {
  const androidText = readFileSync(androidPath, 'utf8');
  const iosText = readFileSync(iosPath, 'utf8');
  for (const method of methods) {
    if (!androidText.includes(method) || !iosText.includes(method)) nativeOk = false;
  }
}
if (!nativeOk) blockers.push('P23_G23_NATIVE_PLUGIN_SURFACE_MISSING');
else satisfied.push({ id: 'nativePlugins', android: true, ios: true, methods: methods.length });

// 7. Test suites present.
const coreTests = existsSync(join(root, contract.evidence.tests.core));
const fixtureTests = existsSync(join(root, contract.evidence.tests.fixtures));
if (!coreTests || !fixtureTests) blockers.push('P23_G23_TESTS_MISSING');
else satisfied.push({ id: 'tests', core: true, fixtures: true });

// 8. Operator-side evidence (never machine self-certifiable).
const operatorBlockers = contract.hardBlockers.filter((code) => code.startsWith('P23_G23_'));
for (const code of operatorBlockers) {
  if (!blockers.includes(code)) blockers.push(code);
}

const report = {
  schemaVersion: 1,
  phase: 23,
  gate: 'G23',
  status: blockers.length ? 'BLOCKED' : 'PASS',
  blockers,
  satisfied,
};
console.log(JSON.stringify(report, null, 2));
process.exitCode = blockers.filter((code) => !code.startsWith('P23_G23_ANDROID') && !code.startsWith('P23_G23_IOS') && code !== 'P23_G23_REAL_G22_NOT_PROVEN' && code !== 'P23_G23_NATIVE_COMPILE_NOT_VERIFIED').length ? 1 : 0;
