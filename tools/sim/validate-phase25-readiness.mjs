#!/usr/bin/env node
import { readFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';

const root = resolve(process.argv[2] ?? '.');
const contractPath = join(root, 'contracts', 'phase25', 'phase25-readiness.expected.json');

function readJson(path) {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

if (!existsSync(contractPath)) {
  console.log(JSON.stringify({ schemaVersion: 1, phase: 25, gate: 'G25', status: 'BLOCKED', blockers: ['P25_G25_CONTRACT_MISSING'], errors: ['phase25-readiness contract missing'] }, null, 2));
  process.exit(2);
}

const contract = readJson(contractPath);
const blockers = [];
const satisfied = [];

// 1. Pinned constants (binding authority from the kit).
const constants = readJson(join(root, contract.evidence.constants));
if (!constants?.logicalStage || constants.logicalStage.width !== 1920 || constants.logicalStage.height !== 1080) {
  blockers.push('P25_G25_CONSTANTS_MISSING');
} else {
  satisfied.push({ id: 'constants', stage: `${constants.logicalStage.width}x${constants.logicalStage.height}`, layers: constants.layers?.length, speeds: constants.speedMilli?.length, visualStates: constants.visualStates?.length });
}

// 2. Interpolation module + pinned boundary fixture.
const interpolationFixture = readJson(join(root, contract.evidence.interpolation.fixture));
if (!existsSync(join(root, contract.evidence.interpolation.path)) || !interpolationFixture?.cases || interpolationFixture.cases.length !== contract.evidence.interpolation.cases) {
  blockers.push('P25_G25_INTERPOLATION_MISSING');
} else {
  satisfied.push({ id: 'interpolation', cases: interpolationFixture.cases.length });
}

// 3. Lifecycle + capability with the capability matrix.
const capabilityFixture = readJson(join(root, contract.evidence.lifecycleCapability.fixture));
const lifecycleOk = existsSync(join(root, contract.evidence.lifecycleCapability.path)) && existsSync(join(root, contract.evidence.lifecycleCapability.capability));
if (!lifecycleOk || capabilityFixture?.cases?.length !== contract.evidence.lifecycleCapability.cases) {
  blockers.push('P25_G25_LIFECYCLE_CAPABILITY_MISSING');
} else {
  satisfied.push({ id: 'lifecycleCapability', cases: capabilityFixture.cases.length, forbidden: capabilityFixture.forbidden?.length });
}

// 4. Layer graph + stable sort with the layer golden.
const layerFixture = readJson(join(root, contract.evidence.layerGraph.fixture));
const layerOk = existsSync(join(root, contract.evidence.layerGraph.path)) && existsSync(join(root, contract.evidence.layerGraph.sort));
if (!layerOk || layerFixture?.layers?.length !== contract.evidence.layerGraph.layers) {
  blockers.push('P25_G25_LAYER_GRAPH_MISSING');
} else {
  satisfied.push({ id: 'layerGraph', layers: layerFixture.layers.length });
}

// 5. Presenter + presentation clock (speed/fps/catch-up surface).
const presenterClockOk =
  existsSync(join(root, contract.evidence.presenterClock.presenter)) && existsSync(join(root, contract.evidence.presenterClock.clock));
if (!presenterClockOk) {
  blockers.push('P25_G25_PRESENTER_CLOCK_MISSING');
} else {
  satisfied.push({ id: 'presenterClock', speeds: contract.evidence.presenterClock.speeds, fps: contract.evidence.presenterClock.fps, maxCatchUpTicks: contract.evidence.presenterClock.maxCatchUpTicks });
}

// 6. Event->clip mapping module.
if (!existsSync(join(root, contract.evidence.eventMapping))) blockers.push('P25_G25_EVENT_MAPPING_MISSING');
else satisfied.push({ id: 'eventMapping' });

// 7. Pool policy + quality with the pressure matrix.
const qualityFixture = readJson(join(root, contract.evidence.poolQuality.fixture));
const poolOk = existsSync(join(root, contract.evidence.poolQuality.path)) && existsSync(join(root, contract.evidence.poolQuality.quality));
if (!poolOk || qualityFixture?.droppable?.length !== contract.evidence.poolQuality.droppable || qualityFixture?.protected?.length !== contract.evidence.poolQuality.protected) {
  blockers.push('P25_G25_POOL_QUALITY_MISSING');
} else {
  satisfied.push({ id: 'poolQuality', droppable: qualityFixture.droppable.length, protected: qualityFixture.protected.length });
}

// 8. Context recovery with the loss matrix.
const lossFixture = readJson(join(root, contract.evidence.contextRecovery.fixture));
if (!existsSync(join(root, contract.evidence.contextRecovery.path)) || lossFixture?.scenarios?.length !== contract.evidence.contextRecovery.scenarios) {
  blockers.push('P25_G25_CONTEXT_RECOVERY_MISSING');
} else {
  satisfied.push({ id: 'contextRecovery', scenarios: lossFixture.scenarios.length, requiredSteps: lossFixture.required.length });
}

// 9. Test suites.
const testPaths = Object.values(contract.evidence.tests);
const testsOk = testPaths.every((relative) => existsSync(join(root, relative)));
if (!testsOk) blockers.push('P25_G25_TESTS_MISSING');
else satisfied.push({ id: 'tests', suites: testPaths.length });

// 10. Operator-side evidence (never machine self-certifiable).
for (const code of contract.hardBlockers) {
  if (!blockers.includes(code)) blockers.push(code);
}

const report = {
  schemaVersion: 1,
  phase: 25,
  gate: 'G25',
  status: blockers.length ? 'BLOCKED' : 'PASS',
  blockers,
  satisfied,
};
console.log(JSON.stringify(report, null, 2));
const operatorCodes = new Set(contract.hardBlockers);
process.exitCode = blockers.filter((code) => !operatorCodes.has(code)).length ? 1 : 0;
