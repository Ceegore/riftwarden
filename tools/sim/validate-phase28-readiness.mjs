#!/usr/bin/env node
import { readFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';

const root = resolve(process.argv[2] ?? '.');
const contractPath = join(root, 'contracts', 'phase28', 'phase28-readiness.expected.json');

function readJson(path) {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

if (!existsSync(contractPath)) {
  console.log(JSON.stringify({ schemaVersion: 1, phase: 28, gate: 'G28', status: 'BLOCKED', blockers: ['P28_G28_CONTRACT_MISSING'], errors: ['phase28-readiness contract missing'] }, null, 2));
  process.exit(2);
}

const contract = readJson(contractPath);
const blockers = [];
const satisfied = [];

// 1. Pinned constants.
const constants = readJson(join(root, contract.evidence.constants));
if (!constants || constants.phase !== 28 || constants.logicalLevels !== 6 || constants.targetVisitedMin !== 5 || constants.targetVisitedMax !== 8 || constants.generatorAttemptCap !== 50 || constants.mandatoryNodeRoles?.length !== 3 || constants.minimumNodeTypes?.length !== 2 || constants.transactionStages?.length !== 8 || constants.gateSampleMaps !== 10000) {
  blockers.push('P28_G28_CONSTANTS_MISSING');
} else {
  satisfied.push({ id: 'constants', levels: constants.logicalLevels, target: `${constants.targetVisitedMin}-${constants.targetVisitedMax}`, attemptCap: constants.generatorAttemptCap, gateMaps: constants.gateSampleMaps });
}

// 2. Map profiles.
const profiles = readJson(join(root, contract.evidence.profiles.fixture));
if (!existsSync(join(root, contract.evidence.profiles.path)) || profiles?.profiles?.length !== 1 || profiles.profiles[0]?.attemptCap !== 50) {
  blockers.push('P28_G28_PROFILES_MISSING');
} else {
  satisfied.push({ id: 'profiles', count: profiles.profiles.length, standard: profiles.profiles[0].id });
}

// 3. Map generator + golden seeds.
const seeds = readJson(join(root, contract.evidence.generator.fixture));
if (!existsSync(join(root, contract.evidence.generator.path)) || seeds?.vectors?.length !== 12) {
  blockers.push('P28_G28_GENERATOR_MISSING');
} else {
  satisfied.push({ id: 'generator', goldenSeeds: seeds.vectors.length });
}

// 4. Reachability + invalid corpus.
const corpus = readJson(join(root, contract.evidence.reachability.corpus));
if (!existsSync(join(root, contract.evidence.reachability.path)) || corpus?.cases?.length !== 8) {
  blockers.push('P28_G28_REACHABILITY_MISSING');
} else {
  satisfied.push({ id: 'reachability', invalidCases: corpus.cases.length });
}

// 5. Node flow + transition matrix.
const transitions = readJson(join(root, contract.evidence.nodeFlow.fixture));
if (!existsSync(join(root, contract.evidence.nodeFlow.path)) || transitions?.cases?.length < 4) {
  blockers.push('P28_G28_NODE_FLOW_MISSING');
} else {
  satisfied.push({ id: 'nodeFlow', cases: transitions.cases.length });
}

// 6. Run domain.
if (!existsSync(join(root, contract.evidence.runDomain.path)) || !existsSync(join(root, contract.evidence.runDomain.statePath))) {
  blockers.push('P28_G28_RUN_DOMAIN_MISSING');
} else {
  satisfied.push({ id: 'runDomain' });
}

// 7. Golden registry.
const registry = readJson(join(root, contract.evidence.goldenRegistry));
if (!registry || registry.entries?.length !== 12 || registry.gateSampleMaps !== 10000) {
  blockers.push('P28_G28_GOLDEN_REGISTRY_MISSING');
} else {
  satisfied.push({ id: 'goldenRegistry', entries: registry.entries.length, gateSampleMaps: registry.gateSampleMaps });
}

// 8. Production modules present.
const modulesOk = contract.evidence.modules.every((relative) => existsSync(join(root, relative)));
if (!modulesOk) blockers.push('P28_G28_MODULES_MISSING');
else satisfied.push({ id: 'modules', count: contract.evidence.modules.length });

// 9. Test suites.
const testPaths = contract.evidence.tests;
const testsOk = testPaths.every((relative) => existsSync(join(root, relative)));
if (!testsOk) blockers.push('P28_G28_TESTS_MISSING');
else satisfied.push({ id: 'tests', suites: testPaths.length });

// 10. Operator-side evidence (never machine self-certifiable).
for (const code of contract.hardBlockers) {
  if (!blockers.includes(code)) blockers.push(code);
}

const report = {
  schemaVersion: 1,
  phase: 28,
  gate: 'G28',
  status: blockers.length ? 'BLOCKED' : 'PASS',
  blockers,
  satisfied,
};
console.log(JSON.stringify(report, null, 2));
const operatorCodes = new Set(contract.hardBlockers);
process.exitCode = blockers.filter((code) => !operatorCodes.has(code)).length ? 1 : 0;
