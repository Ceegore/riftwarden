#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { canonicalJson } from '../../lib/fs-utils.mjs';
import { loadJson, loadLedgers } from './lib/load-ledgers.mjs';
import { createBaseline } from './lib/freeze.mjs';
import { generateRequirementManifests, sha256Of } from './lib/manifests.mjs';

const indexDir = path.resolve(process.argv[2] ?? 'docs/reports/content-ledger');

// Refuse unless the release gate is green (100% REVIEWED and clean).
let release;
try {
  release = JSON.parse(execFileSync(process.execPath, [path.resolve('tools/content/extraction/validate-release.mjs'), '--index-dir', indexDir], { encoding: 'utf8' }));
} catch (error) {
  release = JSON.parse(error.stdout ?? '{"status":"FAIL","diagnostics":[]}');
}
if (release.status !== 'PASS') {
  console.log(JSON.stringify({ schemaVersion: 1, status: 'BLOCKED', reason: 'validate-release is not PASS', releaseDiagnostics: release.diagnostics }, null, 2));
  process.exitCode = 2;
  process.exit();
}

const index = await loadJson(path.join(indexDir, 'content-ledger.index.json'));
const { ledgers } = await loadLedgers(indexDir);
const ledgerHash = createHash('sha256');
for (const ledger of ledgers.sort((a, b) => a.family.localeCompare(b.family))) {
  ledgerHash.update(canonicalJson(ledger.data));
}

// Requirement manifests and the defect/decision snapshot are deterministic
// projections of the reviewed ledger. Generate them so the freeze is
// reproducible and self-contained (identical ledger -> identical baseline).
const { localizationManifest, assetManifest, defectSnapshot } = generateRequirementManifests(ledgers, {
  authoritySha256: index.authoritySha256 ?? null
});
const artifacts = {
  'content-localization-manifest.json': localizationManifest,
  'content-asset-manifest.json': assetManifest,
  'defect-snapshot.json': defectSnapshot
};
for (const [name, value] of Object.entries(artifacts)) {
  await writeFile(path.join(indexDir, name), `${JSON.stringify(value, null, 2)}\n`);
}

const candidates = {
  gddSha256: index.authoritySha256 ?? null,
  contentVersion: process.env.VITE_CONTENT_VERSION ?? null,
  ledgerSha256: ledgerHash.digest('hex'),
  localizationManifestSha256: sha256Of(localizationManifest),
  assetManifestSha256: sha256Of(assetManifest),
  defectSnapshotSha256: sha256Of(defectSnapshot)
};
const missing = Object.entries(candidates).filter(([, value]) => !value).map(([key]) => key);
if (missing.length) {
  console.log(JSON.stringify({ schemaVersion: 1, status: 'BLOCKED', reason: 'Missing freeze inputs', missing }, null, 2));
  process.exitCode = 2;
  process.exit();
}

const baseline = createBaseline(candidates);
const baselineFile = path.join(indexDir, 'baseline.json');
await mkdir(indexDir, { recursive: true });
await writeFile(baselineFile, `${JSON.stringify(baseline, null, 2)}\n`);
console.log(baselineFile);
console.log(JSON.stringify({ schemaVersion: 1, status: 'PASS', baselineSha256: baseline.baselineSha256, inputs: baseline.inputs }, null, 2));
