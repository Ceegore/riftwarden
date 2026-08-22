#!/usr/bin/env node
import { readFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';

const root = resolve(process.argv[2] ?? '.');
const contractPath = join(root, 'contracts', 'phase31', 'phase31-readiness.expected.json');

function readJson(path) {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

if (!existsSync(contractPath)) {
  console.log(JSON.stringify({ schemaVersion: 1, phase: 31, gate: 'G31', status: 'BLOCKED', blockers: ['P31_G31_CONTRACT_MISSING'], errors: ['phase31-readiness contract missing'] }, null, 2));
  process.exit(2);
}

const contract = readJson(contractPath);
const blockers = [];
const satisfied = [];

// 1. Pinned constants.
const constants = readJson(join(root, contract.evidence.constants));
if (!constants || constants.heroCount !== 10 || constants.troopTypeCount !== 18 || constants.itemCount !== 42 || constants.bannerCount !== 6 || constants.copyLimitPerTroopType !== 3) {
  blockers.push('P31_G31_CONSTANTS_MISSING');
} else {
  satisfied.push({ id: 'constants', heroes: constants.heroCount, troopTypes: constants.troopTypeCount, items: constants.itemCount, banners: constants.bannerCount });
}

// 2. Transaction cases + transaction service.
const transactions = readJson(join(root, contract.evidence.transactionCases.fixture));
if (!existsSync(join(root, contract.evidence.transactionCases.path)) || transactions?.length !== 4) {
  blockers.push('P31_G31_TRANSACTION_CASES_MISSING');
} else {
  satisfied.push({ id: 'transactionCases', cases: transactions.length });
}

// 3. Kill-point matrix + transaction flow.
const killPoints = readJson(join(root, contract.evidence.killPoints.fixture));
if (!existsSync(join(root, contract.evidence.killPoints.path)) || killPoints?.length !== 5) {
  blockers.push('P31_G31_KILL_POINTS_MISSING');
} else {
  satisfied.push({ id: 'killPoints', points: killPoints.length });
}

// 4. Derived stats + golden registry.
const derived = readJson(join(root, contract.evidence.derivedStats.fixture));
const golden = readJson(join(root, contract.evidence.goldenRegistry));
if (!existsSync(join(root, contract.evidence.derivedStats.path)) || derived?.length !== 2 || golden?.pinnedCases?.length !== 2 || golden?.sweep?.failures !== 0) {
  blockers.push('P31_G31_DERIVED_STATS_MISSING');
} else {
  satisfied.push({ id: 'derivedStats', cases: derived.length, sweep: golden.sweep.count });
}

// 5. Compatibility + collection-state.
const compatibility = readJson(join(root, contract.evidence.compatibility.fixture));
if (!existsSync(join(root, contract.evidence.compatibility.path)) || compatibility?.length !== 3) {
  blockers.push('P31_G31_COMPATIBILITY_MISSING');
} else {
  satisfied.push({ id: 'compatibility', cases: compatibility.length });
}
const collection = readJson(join(root, contract.evidence.collectionState.fixture));
if (!existsSync(join(root, contract.evidence.collectionState.path)) || collection?.length !== 2) {
  blockers.push('P31_G31_COLLECTION_STATE_MISSING');
} else {
  satisfied.push({ id: 'collectionState', cases: collection.length });
}

// 6. Profile shapes + validator.
const minimal = readJson(join(root, contract.evidence.profileShapes.minimal));
const full = readJson(join(root, contract.evidence.profileShapes.full));
if (!existsSync(join(root, contract.evidence.profileShapes.path)) || minimal?.revision !== 31 || full?.counts?.heroes !== 10) {
  blockers.push('P31_G31_PROFILE_SHAPES_MISSING');
} else {
  satisfied.push({ id: 'profileShapes' });
}

// 7. Screen matrix.
const screens = readJson(join(root, contract.evidence.screenMatrix));
if (!screens || Object.keys(screens).length !== 10) {
  blockers.push('P31_G31_SCREEN_MATRIX_MISSING');
} else {
  satisfied.push({ id: 'screenMatrix', screens: Object.keys(screens).length });
}

// 8. Production modules present.
const modulesOk = contract.evidence.modules.every((relative) => existsSync(join(root, relative)));
if (!modulesOk) blockers.push('P31_G31_MODULES_MISSING');
else satisfied.push({ id: 'modules', count: contract.evidence.modules.length });

// 9. Test suites.
const testPaths = contract.evidence.tests;
const testsOk = testPaths.every((relative) => existsSync(join(root, relative)));
if (!testsOk) blockers.push('P31_G31_TESTS_MISSING');
else satisfied.push({ id: 'tests', suites: testPaths.length });

// 10. E2E harness spec (profile transaction scenario in real Chromium).
if (!existsSync(join(root, contract.evidence.e2eSpec))) {
  blockers.push('P31_G31_E2E_SPEC_MISSING');
} else {
  satisfied.push({ id: 'e2eSpec' });
}

// 11. Operator-side evidence (never machine self-certifiable).
for (const code of contract.hardBlockers) {
  if (!blockers.includes(code)) blockers.push(code);
}

const report = {
  schemaVersion: 1,
  phase: 31,
  gate: 'G31',
  status: blockers.length ? 'BLOCKED' : 'PASS',
  blockers,
  satisfied,
};
console.log(JSON.stringify(report, null, 2));
const operatorCodes = new Set(contract.hardBlockers);
process.exitCode = blockers.filter((code) => !operatorCodes.has(code)).length ? 1 : 0;
