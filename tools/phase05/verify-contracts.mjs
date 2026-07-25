import path from 'node:path';
import { readJson, reportAndExit } from './lib/io.mjs';

const root = process.cwd();
const contractRoot = path.join(root, 'reference', 'contracts');
const errors = [];

const boot = await readJson(path.join(contractRoot, 'boot-state-contract.json'));
const lifecycle = await readJson(
  path.join(contractRoot, 'lifecycle-order-contract.json'),
);
const diagnostics = await readJson(
  path.join(contractRoot, 'diagnostics-contract.json'),
);
const renderer = await readJson(
  path.join(contractRoot, 'renderer-capability-contract.json'),
);
const conflict = await readJson(
  path.join(contractRoot, 'screen-id-conflict-register.json'),
);

const requiredBoot = [
  'BOOT_NATIVE',
  'BOOT_WEB',
  'LOAD_SETTINGS',
  'VALIDATE_CONTENT',
  'LOAD_SAVE',
  'RECOVERY_REQUIRED',
  'FIRST_RUN',
  'TITLE',
];
if (JSON.stringify(boot.states) !== JSON.stringify(requiredBoot)) {
  errors.push('Boot states/order differ from the Phase-05 contract.');
}
if (lifecycle.backgroundOrder.map((item) => item.hook).join(',') !==
    'pauseSimulationAtConfirmedTick,requestMemorySnapshot,fadeAndPauseAudio,stopRenderer,stopInput') {
  errors.push('Lifecycle background order is incorrect.');
}
if (lifecycle.backgroundOrder.find((item) => item.hook === 'requestMemorySnapshot')?.budgetMs !== 250) {
  errors.push('Memory snapshot budget must be 250 ms.');
}
if (
  diagnostics.maxSessions !== 5 ||
  diagnostics.maxBytesPerSession !== 524288 ||
  diagnostics.maxTotalBytes !== 2621440
) {
  errors.push('Diagnostic storage budgets do not match GDD 83.7.');
}
if (diagnostics.transport !== 'none') {
  errors.push('Diagnostics must not have an automatic transport.');
}
if (renderer.canvasFallback !== false || renderer.webgpuReleaseEnabled !== false) {
  errors.push('Canvas fallback and release WebGPU must be disabled.');
}
if (renderer.contextLoss.maxRestoreAttempts !== 2) {
  errors.push('Renderer restore attempts must be exactly 2.');
}
if (conflict.status !== 'OPEN_REQUIRES_G00_NORM_DECISION') {
  errors.push('NORM-003 conflict must remain explicitly unresolved until real evidence exists.');
}

reportAndExit({
  tool: 'verify-contracts',
  ok: errors.length === 0,
  errors,
});
