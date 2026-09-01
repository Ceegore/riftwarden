#!/usr/bin/env node
import { readFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';

const root = resolve(process.argv[2] ?? '.');
const contractPath = join(root, 'contracts', 'phase26', 'phase26-readiness.expected.json');

function readJson(path) {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

if (!existsSync(contractPath)) {
  console.log(JSON.stringify({ schemaVersion: 1, phase: 26, gate: 'G26', status: 'BLOCKED', blockers: ['P26_G26_CONTRACT_MISSING'], errors: ['phase26-readiness contract missing'] }, null, 2));
  process.exit(2);
}

const contract = readJson(contractPath);
const blockers = [];
const satisfied = [];

// 1. Pinned constants (binding authority from the kit).
const constants = readJson(join(root, contract.evidence.constants));
if (!constants?.allowedSpeedPercent || constants.allowedSpeedPercent.length !== 4 || constants.liveAnnouncementKinds?.length !== 4) {
  blockers.push('P26_G26_CONSTANTS_MISSING');
} else {
  satisfied.push({ id: 'constants', speeds: constants.allowedSpeedPercent.length, announcements: constants.liveAnnouncementKinds.length, layouts: constants.layouts?.length });
}

// 2. Pause/speed lifecycle + speed-pause matrix.
const speedPauseFixture = readJson(join(root, contract.evidence.pauseSpeed.fixture));
if (!existsSync(join(root, contract.evidence.pauseSpeed.path)) || speedPauseFixture?.cases?.length !== contract.evidence.pauseSpeed.cases) {
  blockers.push('P26_G26_PAUSE_SPEED_MISSING');
} else {
  satisfied.push({ id: 'pauseSpeed', cases: speedPauseFixture.cases.length, expected: speedPauseFixture.cases[0]?.expected });
}

// 3. Stable ordering + semantic order golden.
const orderFixture = readJson(join(root, contract.evidence.stableOrder.fixture));
if (!existsSync(join(root, contract.evidence.stableOrder.path)) || !orderFixture?.expectedIds?.length) {
  blockers.push('P26_G26_STABLE_ORDER_MISSING');
} else {
  satisfied.push({ id: 'stableOrder', golden: orderFixture.expectedIds.length });
}

// 4. Live region + announce/suppress matrix.
const liveFixture = readJson(join(root, contract.evidence.liveRegion.fixture));
if (!existsSync(join(root, contract.evidence.liveRegion.path)) || liveFixture?.announce?.length !== contract.evidence.liveRegion.announce) {
  blockers.push('P26_G26_LIVE_REGION_MISSING');
} else {
  satisfied.push({ id: 'liveRegion', announce: liveFixture.announce.length, suppress: liveFixture.suppress.length });
}

// 5. Time formatting + warning timeline boundaries.
const timeFixture = readJson(join(root, contract.evidence.timeFormat.fixture));
if (!existsSync(join(root, contract.evidence.timeFormat.path)) || !timeFixture?.cases?.length || timeFixture.tickRate !== 30) {
  blockers.push('P26_G26_TIME_FORMAT_MISSING');
} else {
  satisfied.push({ id: 'timeFormat', tickRate: timeFixture.tickRate, cases: timeFixture.cases.length, maxErrorMs: contract.evidence.timeFormat.maxErrorMs });
}

// 6. Selection fallback + matrix.
const selectionFixture = readJson(join(root, contract.evidence.selection.fixture));
if (!existsSync(join(root, contract.evidence.selection.path)) || selectionFixture?.cases?.length !== contract.evidence.selection.cases) {
  blockers.push('P26_G26_SELECTION_MISSING');
} else {
  satisfied.push({ id: 'selection', cases: selectionFixture.cases.length });
}

// 7. Mutation guard, types and layout matrix.
const guardOk = existsSync(join(root, contract.evidence.mutationGuard)) && existsSync(join(root, contract.evidence.types));
const layoutFixture = readJson(join(root, contract.evidence.layouts.fixture));
if (!guardOk) blockers.push('P26_G26_GUARD_TYPES_MISSING');
else satisfied.push({ id: 'guardTypes' });
if (!layoutFixture?.layouts || layoutFixture.layouts.length !== contract.evidence.layouts.layouts) blockers.push('P26_G26_LAYOUT_MATRIX_MISSING');
else satisfied.push({ id: 'layouts', layouts: layoutFixture.layouts.length, locales: layoutFixture.locales?.length, textScales: layoutFixture.textScales?.length, profiles: layoutFixture.profiles?.length });

// 8. Test suites.
const testPaths = Object.values(contract.evidence.tests);
const testsOk = testPaths.every((relative) => existsSync(join(root, relative)));
if (!testsOk) blockers.push('P26_G26_TESTS_MISSING');
else satisfied.push({ id: 'tests', suites: testPaths.length });

// 9. Operator-side evidence (never machine self-certifiable).
for (const code of contract.hardBlockers) {
  if (!blockers.includes(code)) blockers.push(code);
}

const report = {
  schemaVersion: 1,
  phase: 26,
  gate: 'G26',
  status: blockers.length ? 'BLOCKED' : 'PASS',
  blockers,
  satisfied,
};
console.log(JSON.stringify(report, null, 2));
const operatorCodes = new Set(contract.hardBlockers);
process.exitCode = blockers.filter((code) => !operatorCodes.has(code)).length ? 1 : 0;
