#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { canonicalJson, sha256File } from '../../lib/fs-utils.mjs';
import { loadJson, loadLedgers } from './lib/load-ledgers.mjs';
import { createBaseline } from './lib/freeze.mjs';

const indexDir = path.resolve('docs/reports/content-ledger');

async function exists(file) {
  try { await access(file); return true; } catch { return false; }
}

// Refuse unless the release gate is green (100% REVIEWED and clean).
let release;
try {
  release = JSON.parse(execFileSync(process.execPath, [path.resolve('tools/content/extraction/validate-release.mjs')], { encoding: 'utf8' }));
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
const defectFile = path.join(indexDir, 'defect-snapshot.json');
const candidates = {
  gddSha256: index.authoritySha256,
  contentVersion: process.env.VITE_CONTENT_VERSION ?? null,
  ledgerSha256: ledgerHash.digest('hex'),
  localizationManifestSha256: path.resolve('docs/reports/content-localization-manifest.json'),
  assetManifestSha256: path.resolve('docs/reports/content-asset-manifest.json'),
  defectSnapshotSha256: defectFile
};
const inputs = {};
const missing = [];
for (const [key, value] of Object.entries(candidates)) {
  if (typeof value === 'string' && value.startsWith(path.resolve('.'))) {
    if (await exists(value)) inputs[key] = await sha256File(value);
    else missing.push(key);
  } else if (value) {
    inputs[key] = value;
  } else {
    missing.push(key);
  }
}
if (missing.length) {
  console.log(JSON.stringify({ schemaVersion: 1, status: 'BLOCKED', reason: 'Missing freeze inputs', missing }, null, 2));
  process.exitCode = 2;
  process.exit();
}

const baseline = createBaseline(inputs);
const baselineFile = path.join(indexDir, 'baseline.json');
await mkdir(indexDir, { recursive: true });
await writeFile(baselineFile, `${JSON.stringify(baseline, null, 2)}\n`);
console.log(baselineFile);
console.log(JSON.stringify({ schemaVersion: 1, status: 'PASS', baselineSha256: baseline.baselineSha256, inputs: baseline.inputs }, null, 2));
