#!/usr/bin/env node
import { readFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';

const root = resolve(process.argv[2] ?? '.');
const contractPath = join(root, 'contracts', 'phase32', 'phase32-readiness.expected.json');

function readJson(path) {
  if (!existsSync(path)) return null;
  try { return JSON.parse(readFileSync(path, 'utf8')); } catch { return null; }
}

if (!existsSync(contractPath)) {
  console.log(JSON.stringify({ schemaVersion: 1, phase: 32, gate: 'G32', status: 'BLOCKED', blockers: ['P32_G32_CONTRACT_MISSING'], errors: ['phase32-readiness contract missing'] }, null, 2));
  process.exit(2);
}

const contract = readJson(contractPath);
const blockers = [];
const satisfied = [];

// 1. Pinned constants.
const constants = readJson(join(root, contract.evidence.constants));
if (!constants || constants.eventCount !== 30 || constants.merchantMaxRerolls !== 1 || constants.mapValidationRuns !== 100000 || constants.minVisits !== 5 || constants.maxVisits !== 8) {
  blockers.push('P32_G32_CONSTANTS_MISSING');
} else {
  satisfied.push({ id: 'constants', eventCount: constants.eventCount });
}

// 2. Event fixtures + event service.
const events = readJson(join(root, contract.evidence.eventFixtures.fixture));
if (!existsSync(join(root, contract.evidence.eventFixtures.path)) || events?.length !== 30) {
  blockers.push('P32_G32_EVENTS_MISSING');
} else {
  satisfied.push({ id: 'events', count: events.length });
}

// 3. Merchant cases + offer service.
const merchant = readJson(join(root, contract.evidence.merchantFixtures.fixture));
if (!existsSync(join(root, contract.evidence.merchantFixtures.path)) || !merchant?.offers || merchant.offers.length !== 4) {
  blockers.push('P32_G32_MERCHANT_CASES_MISSING');
} else {
  satisfied.push({ id: 'merchant', offers: merchant.offers.length });
}

// 4. Recruitment cases.
const recruitment = readJson(join(root, contract.evidence.recruitmentFixtures.fixture));
if (!recruitment?.offers || recruitment.offers.length < 3) {
  blockers.push('P32_G32_RECRUITMENT_CASES_MISSING');
} else {
  satisfied.push({ id: 'recruitment', offers: recruitment.offers.length });
}

// 5. Choice node cases.
const choice = readJson(join(root, contract.evidence.choiceFixtures.fixture));
if (choice?.length < 3) {
  blockers.push('P32_G32_CHOICE_CASES_MISSING');
} else {
  satisfied.push({ id: 'choice', cases: choice.length });
}

// 6. Kill-storage matrix.
const killMatrix = readJson(join(root, contract.evidence.killStorage.fixture));
if (!existsSync(join(root, contract.evidence.killStorage.path)) || killMatrix?.length !== 5) {
  blockers.push('P32_G32_KILL_MATRIX_MISSING');
} else {
  satisfied.push({ id: 'killMatrix', cases: killMatrix.length });
}

// 7. Loot cases + reward pool.
const loot = readJson(join(root, contract.evidence.lootCases.fixture));
if (!existsSync(join(root, contract.evidence.lootCases.path)) || loot?.length < 4) {
  blockers.push('P32_G32_LOOT_CASES_MISSING');
} else {
  satisfied.push({ id: 'loot', cases: loot.length });
}

// 8. Node registry cases.
const nodeRegistry = readJson(join(root, contract.evidence.nodeRegistry.fixture));
if (!existsSync(join(root, contract.evidence.nodeRegistry.path)) || nodeRegistry?.length < 5) {
  blockers.push('P32_G32_NODE_REGISTRY_MISSING');
} else {
  satisfied.push({ id: 'nodeRegistry', cases: nodeRegistry.length });
}

// 9. Map profiles.
const mapProfiles = readJson(join(root, contract.evidence.mapProfiles.fixture));
if (!existsSync(join(root, contract.evidence.mapProfiles.path)) || mapProfiles?.length < 4) {
  blockers.push('P32_G32_MAP_PROFILES_MISSING');
} else {
  satisfied.push({ id: 'mapProfiles', profiles: mapProfiles.length });
}

// 10. Golden registry.
const golden = readJson(join(root, contract.evidence.goldenRegistry));
if (!golden || golden.sweep?.failures !== 0 || golden.sweep?.count !== 10000) {
  blockers.push('P32_G32_GOLDEN_REGISTRY_MISSING');
} else {
  satisfied.push({ id: 'goldenRegistry', sweep: golden.sweep.count, failures: golden.sweep.failures });
}

// 11. Map QA report.
const mapQa = readJson(join(root, contract.evidence.mapQaReport));
if (!mapQa || mapQa.failureCount !== 0 || !mapQa.zeroStructuralViolations) {
  blockers.push('P32_G32_MAP_QA_MISSING');
} else {
  satisfied.push({ id: 'mapQa', failures: mapQa.failureCount });
}

// 12. Production modules present.
const modulesOk = contract.evidence.modules.every((r) => existsSync(join(root, r)));
if (!modulesOk) blockers.push('P32_G32_MODULES_MISSING');
else satisfied.push({ id: 'modules', count: contract.evidence.modules.length });

// 13. Test suites.
const testPaths = contract.evidence.tests;
const testsOk = testPaths.every((r) => existsSync(join(root, r)));
if (!testsOk) blockers.push('P32_G32_TESTS_MISSING');
else satisfied.push({ id: 'tests', suites: testPaths.length });

// 14. Operator-side hard blockers (never machine self-certifiable).
for (const code of contract.hardBlockers) {
  if (!blockers.includes(code)) blockers.push(code);
}

const report = {
  schemaVersion: 1,
  phase: 32,
  gate: 'G32',
  status: blockers.length ? 'BLOCKED' : 'PASS',
  blockers,
  satisfied,
};
console.log(JSON.stringify(report, null, 2));
const operatorCodes = new Set(contract.hardBlockers);
process.exitCode = blockers.filter((c) => !operatorCodes.has(c)).length ? 1 : 0;
