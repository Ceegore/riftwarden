#!/usr/bin/env node
import { readFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';

const root = resolve(process.argv[2] ?? '.');
const expectedPath = join(root, 'contracts', 'math', 'phase11-readiness.expected.json');
if (!existsSync(expectedPath)) {
  console.log(JSON.stringify({ schemaVersion: 1, status: 'BLOCKED', diagnostics: [{ code: 'P12_G11_NOT_PROVEN', message: 'phase11-readiness contract missing' }] }, null, 2));
  process.exitCode = 2;
} else {
  const v = JSON.parse(readFileSync(expectedPath, 'utf8'));
  const diagnostics = [];
  if (!v.realG11Proven) diagnostics.push({ code: 'P12_G11_NOT_PROVEN', message: 'real G11 evidence absent' });
  if (!v.ruleSnapshotsVerified) diagnostics.push({ code: 'P12_RULE_SNAPSHOTS_UNVERIFIED', message: 'canonical rule module hashes unverified' });
  if (!v.officialTraceabilityPresent) diagnostics.push({ code: 'P12_TRACEABILITY_MISSING', message: 'official REQ/TEST traceability absent' });
  if (!v.publishedIdBaselinePresent) diagnostics.push({ code: 'P12_PUBLISHED_IDS_MISSING', message: 'published ID baseline from approved content absent' });
  if (!v.browserEvidencePresent) diagnostics.push({ code: 'P12_BROWSER_EVIDENCE_MISSING', message: 'crossruntime browser evidence absent' });
  console.log(JSON.stringify({ schemaVersion: 1, status: diagnostics.length ? 'BLOCKED' : 'PASS', diagnostics }, null, 2));
  process.exitCode = diagnostics.length ? 2 : 0;
}
