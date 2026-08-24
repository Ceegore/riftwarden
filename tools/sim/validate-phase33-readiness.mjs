#!/usr/bin/env node
import { readFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';

const root = resolve(process.argv[2] ?? '.');
const contractPath = join(root, 'contracts', 'phase33', 'phase33-readiness.expected.json');

function readJson(path) {
  if (!existsSync(path)) return null;
  try { return JSON.parse(readFileSync(path, 'utf8')); } catch { return null; }
}

if (!existsSync(contractPath)) {
  console.log(JSON.stringify({ schemaVersion: 1, phase: 33, gate: 'G33', status: 'BLOCKED', blockers: ['P33_G33_CONTRACT_MISSING'], errors: ['phase33-readiness contract missing'] }, null, 2));
  process.exit(2);
}

const contract = readJson(contractPath);
const blockers = [];
const satisfied = [];

const constants = readJson(join(root, contract.evidence.constants));
if (!constants || constants.missions.mission_tutorial.difficulty !== 'easy') {
  blockers.push('P33_G33_CONSTANTS_MISSING');
} else {
  satisfied.push({ id: 'constants', missionCount: Object.keys(constants.missions).length });
}

const modulesOk = contract.evidence.modules.every((r) => existsSync(join(root, r)));
if (!modulesOk) blockers.push('P33_G33_MODULES_MISSING');
else satisfied.push({ id: 'modules', count: contract.evidence.modules.length });

const testsOk = contract.evidence.tests.every((r) => existsSync(join(root, r)));
if (!testsOk) blockers.push('P33_G33_TESTS_MISSING');
else satisfied.push({ id: 'tests', suites: contract.evidence.tests.length });

for (const code of contract.hardBlockers) {
  if (!blockers.includes(code)) blockers.push(code);
}

const report = { schemaVersion: 1, phase: 33, gate: 'G33', status: blockers.filter((c) => !contract.hardBlockers.includes(c)).length ? 'BLOCKED' : (contract.hardBlockers.length ? 'BLOCKED' : 'PASS'), blockers, satisfied };
console.log(JSON.stringify(report, null, 2));
const operatorCodes = new Set(contract.hardBlockers);
process.exitCode = blockers.filter((c) => !operatorCodes.has(c)).length ? 1 : 0;