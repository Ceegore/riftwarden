import path from 'node:path';
import { readJson, reportAndExit } from './lib/io.mjs';

const evidencePath =
  process.argv[2] ?? path.join(process.cwd(), 'docs/evidence/phase-05/evidence.json');
const evidence = await readJson(evidencePath);
const errors = [];

const requiredBoolean = [
  'gateG04Verified',
  'browserColdStartVerified',
  'browserBootFailureVerified',
  'browserNoWebglVerified',
  'androidLifecycleVerified',
  'iosLifecycleVerified',
  'backgroundZeroActivityVerified',
  'snapshotBudgetVerified',
  'diagnosticPrivacyVerified',
  'screenIdNormalizationResolved',
  'mainPipelineGreen',
];
for (const field of requiredBoolean) {
  if (evidence[field] !== true) {
    errors.push(`${field} must be true.`);
  }
}
if (!Array.isArray(evidence.commands) || evidence.commands.length === 0) {
  errors.push('At least one executed command record is required.');
}
if (!Array.isArray(evidence.artifacts) || evidence.artifacts.length === 0) {
  errors.push('At least one evidence artifact is required.');
}
if (evidence.openP0 !== 0 || evidence.openP1 !== 0) {
  errors.push('G05 requires openP0=0 and openP1=0.');
}
if (evidence.statusClaim !== 'PASS') {
  errors.push('Evidence statusClaim must explicitly be PASS.');
}

reportAndExit({
  tool: 'verify-evidence',
  evidencePath,
  ok: errors.length === 0,
  errors,
});
