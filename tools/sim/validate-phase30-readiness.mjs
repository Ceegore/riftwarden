#!/usr/bin/env node
import { readFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';

const root = resolve(process.argv[2] ?? '.');
const contractPath = join(root, 'contracts', 'phase30', 'phase30-readiness.expected.json');

function readJson(path) {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

if (!existsSync(contractPath)) {
  console.log(JSON.stringify({ schemaVersion: 1, phase: 30, gate: 'G30', status: 'BLOCKED', blockers: ['P30_G30_CONTRACT_MISSING'], errors: ['phase30-readiness contract missing'] }, null, 2));
  process.exit(2);
}

const contract = readJson(contractPath);
const blockers = [];
const satisfied = [];

// 1. Pinned constants.
const constants = readJson(join(root, contract.evidence.constants));
if (!constants || constants.phase !== 30 || constants.screenIds?.length !== 14 || constants.languages?.length !== 3 || constants.textScales?.length !== 5 || constants.allowedSchemes?.length !== 1) {
  blockers.push('P30_G30_CONSTANTS_MISSING');
} else {
  satisfied.push({ id: 'constants', screens: constants.screenIds.length, languages: constants.languages.length, textScales: constants.textScales.length });
}

// 2. Route matrix + route resolver.
const routeMatrix = readJson(join(root, contract.evidence.routeMatrix.fixture));
if (!existsSync(join(root, contract.evidence.routeMatrix.path)) || routeMatrix?.length !== 4) {
  blockers.push('P30_G30_ROUTE_MATRIX_MISSING');
} else {
  satisfied.push({ id: 'routeMatrix', cases: routeMatrix.length });
}

// 3. Continue-save matrix + continue resolver.
const continueMatrix = readJson(join(root, contract.evidence.continueMatrix.fixture));
if (!existsSync(join(root, contract.evidence.continueMatrix.path)) || continueMatrix?.length !== 5) {
  blockers.push('P30_G30_CONTINUE_MATRIX_MISSING');
} else {
  satisfied.push({ id: 'continueMatrix', classes: continueMatrix.length });
}

// 4. Settings cases + settings domain.
const settingsCases = readJson(join(root, contract.evidence.settingsCases.fixture));
if (!existsSync(join(root, contract.evidence.settingsCases.path)) || settingsCases?.length !== 6) {
  blockers.push('P30_G30_SETTINGS_CASES_MISSING');
} else {
  satisfied.push({ id: 'settingsCases', cases: settingsCases.length });
}

// 5. External link cases + link policy.
const linkCases = readJson(join(root, contract.evidence.linkCases.fixture));
if (!existsSync(join(root, contract.evidence.linkCases.path)) || linkCases?.length !== 4) {
  blockers.push('P30_G30_LINK_CASES_MISSING');
} else {
  satisfied.push({ id: 'linkCases', cases: linkCases.length });
}

// 6. HQ capability fixture + registry.
const hqCapabilities = readJson(join(root, contract.evidence.hqCapabilities.fixture));
if (!existsSync(join(root, contract.evidence.hqCapabilities.path)) || hqCapabilities?.length !== 6) {
  blockers.push('P30_G30_HQ_CAPABILITIES_MISSING');
} else {
  satisfied.push({ id: 'hqCapabilities', areas: hqCapabilities.length });
}

// 7. Kill-point matrix + first-run flow.
const killPoints = readJson(join(root, contract.evidence.killPoints.fixture));
if (!existsSync(join(root, contract.evidence.killPoints.path)) || killPoints?.length !== 9) {
  blockers.push('P30_G30_KILL_POINTS_MISSING');
} else {
  satisfied.push({ id: 'killPoints', points: killPoints.length });
}

// 8. Visual matrix (operator evidence input).
const visual = readJson(join(root, contract.evidence.visualMatrix));
if (!visual?.length) {
  blockers.push('P30_G30_VISUAL_MATRIX_MISSING');
} else {
  satisfied.push({ id: 'visualMatrix', combos: visual.length });
}

// 9. Production modules present.
const modulesOk = contract.evidence.modules.every((relative) => existsSync(join(root, relative)));
if (!modulesOk) blockers.push('P30_G30_MODULES_MISSING');
else satisfied.push({ id: 'modules', count: contract.evidence.modules.length });

// 10. Test suites.
const testPaths = contract.evidence.tests;
const testsOk = testPaths.every((relative) => existsSync(join(root, relative)));
if (!testsOk) blockers.push('P30_G30_TESTS_MISSING');
else satisfied.push({ id: 'tests', suites: testPaths.length });

// 11. Operator-side evidence (never machine self-certifiable).
for (const code of contract.hardBlockers) {
  if (!blockers.includes(code)) blockers.push(code);
}

const report = {
  schemaVersion: 1,
  phase: 30,
  gate: 'G30',
  status: blockers.length ? 'BLOCKED' : 'PASS',
  blockers,
  satisfied,
};
console.log(JSON.stringify(report, null, 2));
const operatorCodes = new Set(contract.hardBlockers);
process.exitCode = blockers.filter((code) => !operatorCodes.has(code)).length ? 1 : 0;
