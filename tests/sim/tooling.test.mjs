import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const run = (args, cwd) => spawnSync(process.execPath, args, { cwd: cwd ?? root, encoding: 'utf8' });

test('phase13 readiness expected contract lists all six blockers', () => {
  const expected = JSON.parse(readFileSync(join(root, 'contracts', 'sim', 'phase13-readiness.expected.json'), 'utf8'));
  assert.equal(expected.expectedBlockers.length, 6);
  assert.ok(expected.expectedBlockers.includes('P14_G13_NOT_PROVEN'));
  assert.ok(expected.expectedBlockers.includes('P14_CROSSRUNTIME_EVIDENCE_MISSING'));
});

test('readiness gate truthfully BLOCKs with the expected blockers', () => {
  const res = run(['tools/sim/validate-phase13-readiness.mjs']);
  const report = JSON.parse(res.stdout);
  assert.equal(report.status, 'BLOCKED');
  assert.ok(report.blockers.includes('P14_G13_NOT_PROVEN'));
  assert.equal(res.status, 2);
});

test('kernel import audit flags UI and wallclock in a synthetic tree', () => {
  const d = mkdtempSync(join(tmpdir(), 'p14-'));
  mkdirSync(join(d, 'src', 'game', 'sim', 'core'), { recursive: true });
  writeFileSync(join(d, 'src', 'game', 'sim', 'core', 'ok.ts'), 'export const ok = 1;\n');
  writeFileSync(join(d, 'src', 'game', 'sim', 'core', 'bad.ts'), "import { h } from 'react';\nconst t = Date.now();\nconst r = Math.random();\n");
  const res = run(['tools/sim/audit-kernel-imports.mjs', d]);
  const report = JSON.parse(res.stdout);
  assert.equal(report.status, 'BLOCKED');
  assert.ok(report.findings.some((x) => x.kind === 'ui-native-import'));
  assert.ok(report.findings.some((x) => x.kind === 'wallclock'));
  assert.ok(report.findings.some((x) => x.kind === 'random-access'));
  assert.equal(res.status, 2);
});

test('kernel import audit passes on the clean src tree', () => {
  const res = run(['tools/sim/audit-kernel-imports.mjs', '.']);
  const report = JSON.parse(res.stdout);
  assert.equal(report.status, 'PASS');
  assert.deepEqual(report.findings, []);
});
