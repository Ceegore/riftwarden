#!/usr/bin/env node
import { readFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';

const root = resolve(process.argv[2] ?? '.');
const contractPath = join(root, 'contracts', 'phase27', 'phase27-readiness.expected.json');

function readJson(path) {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

if (!existsSync(contractPath)) {
  console.log(JSON.stringify({ schemaVersion: 1, phase: 27, gate: 'G27', status: 'BLOCKED', blockers: ['P27_G27_CONTRACT_MISSING'], errors: ['phase27-readiness contract missing'] }, null, 2));
  process.exit(2);
}

const contract = readJson(contractPath);
const blockers = [];
const satisfied = [];

// 1. Pinned constants (binding authority from the kit).
const constants = readJson(join(root, contract.evidence.constants));
if (!constants?.lanes?.length || constants.lanes.length !== 3 || constants.depths?.length !== 3 || constants.maxRegular !== 7 || constants.maxHeroes !== 3 || constants.maxSameTroop !== 3 || constants.presetCount !== 4 || constants.presetKinds?.length !== 4) {
  blockers.push('P27_G27_CONSTANTS_MISSING');
} else {
  satisfied.push({ id: 'constants', lanes: constants.lanes.length, depths: constants.depths.length, presets: constants.presetKinds.length });
}

// 2. Formation rule matrix + validator.
const rulesFixture = readJson(join(root, contract.evidence.rules.fixture));
if (!existsSync(join(root, contract.evidence.rules.path)) || !rulesFixture?.cases?.length) {
  blockers.push('P27_G27_RULE_MATRIX_MISSING');
} else {
  satisfied.push({ id: 'rules', cases: rulesFixture.cases.length });
}

// 3. Warning matrix.
const warningsFixture = readJson(join(root, contract.evidence.warnings.fixture));
if (!existsSync(join(root, contract.evidence.warnings.path)) || !warningsFixture?.cases?.length) {
  blockers.push('P27_G27_WARNING_MATRIX_MISSING');
} else {
  satisfied.push({ id: 'warnings', cases: warningsFixture.cases.length });
}

// 4. Preset roundtrip.
const presetsFixture = readJson(join(root, contract.evidence.presets.fixture));
if (!existsSync(join(root, contract.evidence.presets.path)) || presetsFixture?.presets?.length !== 4 || presetsFixture?.missingPolicy !== 'skip_and_report' || presetsFixture?.substitution !== false) {
  blockers.push('P27_G27_PRESETS_MISSING');
} else {
  satisfied.push({ id: 'presets', count: presetsFixture.presets.length, policy: presetsFixture.missingPolicy });
}

// 5. Pre-battle disclosure.
const disclosureFixture = readJson(join(root, contract.evidence.disclosure.fixture));
if (!existsSync(join(root, contract.evidence.disclosure.path)) || !disclosureFixture?.required?.length || disclosureFixture?.missingBlocksStart !== true) {
  blockers.push('P27_G27_DISCLOSURE_MISSING');
} else {
  satisfied.push({ id: 'disclosure', required: disclosureFixture.required.length, missingBlocksStart: disclosureFixture.missingBlocksStart });
}

// 6. Atomic start matrix.
const atomicFixture = readJson(join(root, contract.evidence.atomicStart.fixture));
if (!existsSync(join(root, contract.evidence.atomicStart.path)) || !atomicFixture?.cases?.length) {
  blockers.push('P27_G27_ATOMIC_START_MISSING');
} else {
  satisfied.push({ id: 'atomicStart', cases: atomicFixture.cases.length });
}

// 7. Input/a11y matrix (drag-only forbidden).
const inputFixture = readJson(join(root, contract.evidence.inputA11y.fixture));
if (!existsSync(join(root, contract.evidence.inputA11y.path)) || inputFixture?.dragOnlyForbidden !== true || !inputFixture?.modes?.length) {
  blockers.push('P27_G27_INPUT_A11Y_MISSING');
} else {
  satisfied.push({ id: 'inputA11y', modes: inputFixture.modes.length, dragOnlyForbidden: inputFixture.dragOnlyForbidden });
}

// 8. Production modules present.
const modulesOk = contract.evidence.modules.every((relative) => existsSync(join(root, relative)));
if (!modulesOk) blockers.push('P27_G27_MODULES_MISSING');
else satisfied.push({ id: 'modules', count: contract.evidence.modules.length });

// 9. Test suites.
const testPaths = contract.evidence.tests;
const testsOk = testPaths.every((relative) => existsSync(join(root, relative)));
if (!testsOk) blockers.push('P27_G27_TESTS_MISSING');
else satisfied.push({ id: 'tests', suites: testPaths.length });

// 10. Operator-side evidence (never machine self-certifiable).
for (const code of contract.hardBlockers) {
  if (!blockers.includes(code)) blockers.push(code);
}

const report = {
  schemaVersion: 1,
  phase: 27,
  gate: 'G27',
  status: blockers.length ? 'BLOCKED' : 'PASS',
  blockers,
  satisfied,
};
console.log(JSON.stringify(report, null, 2));
const operatorCodes = new Set(contract.hardBlockers);
process.exitCode = blockers.filter((code) => !operatorCodes.has(code)).length ? 1 : 0;
