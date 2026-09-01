#!/usr/bin/env node
import { readFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';

const root = resolve(process.argv[2] ?? '.');
const contractPath = join(root, 'contracts', 'phase29', 'phase29-readiness.expected.json');

function readJson(path) {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

if (!existsSync(contractPath)) {
  console.log(JSON.stringify({ schemaVersion: 1, phase: 29, gate: 'G29', status: 'BLOCKED', blockers: ['P29_G29_CONTRACT_MISSING'], errors: ['phase29-readiness contract missing'] }, null, 2));
  process.exit(2);
}

const contract = readJson(contractPath);
const blockers = [];
const satisfied = [];

// 1. Pinned constants.
const constants = readJson(join(root, contract.evidence.constants));
if (!constants || constants.phase !== 29 || constants.heroes !== 4 || constants.troops !== 6 || constants.battleSnapshotIntervalTicks !== 150 || constants.speedMultipliersX10?.length !== 4 || constants.criticalRepeatCount !== 10 || constants.maxMaintainedFileLines !== 500) {
  blockers.push('P29_G29_CONSTANTS_MISSING');
} else {
  satisfied.push({ id: 'constants', heroes: constants.heroes, troops: constants.troops, snapshotInterval: constants.battleSnapshotIntervalTicks, speeds: constants.speedMultipliersX10.length });
}

// 2. E2E route matrix + route machine.
const routes = readJson(join(root, contract.evidence.routes.fixture));
if (!existsSync(join(root, contract.evidence.routes.path)) || routes?.routes?.length !== 12 || routes?.cases?.length !== 8) {
  blockers.push('P29_G29_ROUTES_MISSING');
} else {
  satisfied.push({ id: 'routes', routes: routes.routes.length, cases: routes.cases.length });
}

// 3. Golden seeds + hash matrix.
const seeds = readJson(join(root, contract.evidence.goldenSeeds.fixture));
if (!existsSync(join(root, contract.evidence.goldenSeeds.path)) || seeds?.seeds?.length !== 3 || seeds?.speedsX10?.length !== 4 || seeds?.qualities?.length !== 4) {
  blockers.push('P29_G29_GOLDEN_SEEDS_MISSING');
} else {
  satisfied.push({ id: 'goldenSeeds', seeds: seeds.seeds.length, speeds: seeds.speedsX10.length, qualities: seeds.qualities.length });
}

// 4. Kill-point matrix + commit ledger.
const killPoints = readJson(join(root, contract.evidence.killPoints.fixture));
if (!existsSync(join(root, contract.evidence.killPoints.path)) || killPoints?.points?.length !== 8 || killPoints?.repetitions !== 10) {
  blockers.push('P29_G29_KILL_POINTS_MISSING');
} else {
  satisfied.push({ id: 'killPoints', points: killPoints.points.length, repetitions: killPoints.repetitions });
}

// 5. Device + accessibility matrices (operator evidence inputs).
const device = readJson(join(root, contract.evidence.deviceMatrix));
const a11y = readJson(join(root, contract.evidence.a11yMatrix));
if (!device?.android?.length || !device?.runs?.length || !a11y?.inputs?.length || !a11y?.requirements?.length) {
  blockers.push('P29_G29_MATRICES_MISSING');
} else {
  satisfied.push({ id: 'matrices', deviceRuns: device.runs.length, a11yInputs: a11y.inputs.length, a11yRequirements: a11y.requirements.length });
}

// 6. Production modules present.
const modulesOk = contract.evidence.modules.every((relative) => existsSync(join(root, relative)));
if (!modulesOk) blockers.push('P29_G29_MODULES_MISSING');
else satisfied.push({ id: 'modules', count: contract.evidence.modules.length });

// 7. Test suites.
const testPaths = contract.evidence.tests;
const testsOk = testPaths.every((relative) => existsSync(join(root, relative)));
if (!testsOk) blockers.push('P29_G29_TESTS_MISSING');
else satisfied.push({ id: 'tests', suites: testPaths.length });

// 8. E2E harness spec (the slice E2E + reliability kill matrix browser run).
if (!existsSync(join(root, contract.evidence.e2eSpec))) {
  blockers.push('P29_G29_E2E_SPEC_MISSING');
} else {
  satisfied.push({ id: 'e2eSpec' });
}

// 9. Operator-side evidence (never machine self-certifiable).
for (const code of contract.hardBlockers) {
  if (!blockers.includes(code)) blockers.push(code);
}

const report = {
  schemaVersion: 1,
  phase: 29,
  gate: 'G29',
  status: blockers.length ? 'BLOCKED' : 'PASS',
  blockers,
  satisfied,
};
console.log(JSON.stringify(report, null, 2));
const operatorCodes = new Set(contract.hardBlockers);
process.exitCode = blockers.filter((code) => !operatorCodes.has(code)).length ? 1 : 0;
