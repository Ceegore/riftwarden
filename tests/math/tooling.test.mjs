import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const run = (args, cwd) => spawnSync(process.execPath, args, { cwd: cwd ?? root, encoding: 'utf8' });

test('phase11 readiness expected contract is BLOCKED in the real repo', () => {
  const expected = JSON.parse(readFileSync(join(root, 'contracts', 'math', 'phase11-readiness.expected.json'), 'utf8'));
  assert.equal(expected.realG11Proven, false);
  assert.equal(expected.browserEvidencePresent, false);
});

test('readiness gate truthfully BLOCKs with the expected diagnostics', () => {
  const res = run(['tools/math/validate-phase11-readiness.mjs']);
  const report = JSON.parse(res.stdout);
  assert.equal(report.status, 'BLOCKED');
  assert.ok(report.diagnostics.some((x) => x.code === 'P12_G11_NOT_PROVEN'));
  assert.ok(report.diagnostics.some((x) => x.code === 'P12_BROWSER_EVIDENCE_MISSING'));
  assert.equal(res.status, 2);
});

test('callsite audit flags local Math.round outside the rounding module', () => {
  const d = mkdtempSync(join(tmpdir(), 'p12-'));
  mkdirSync(join(d, 'game', 'sim', 'math'), { recursive: true });
  mkdirSync(join(d, 'app'), { recursive: true });
  writeFileSync(join(d, 'game', 'sim', 'math', 'rounding.ts'), 'export function r() { return 1; }\n');
  writeFileSync(join(d, 'app', 'battle.ts'), 'const x = Math.round(1.5);\n');
  const res = run(['tools/math/audit-math-callsites.mjs', d]);
  const report = JSON.parse(res.stdout);
  assert.ok(report.findings.some((x) => x.code === 'P12_LOCAL_ROUNDING'));
  assert.equal(res.status, 2);
});

test('callsite audit flags local BPS math outside math', () => {
  const d = mkdtempSync(join(tmpdir(), 'p12-'));
  mkdirSync(join(d, 'app'), { recursive: true });
  writeFileSync(join(d, 'app', 'shop.ts'), 'const x = value * 10_000;\n');
  const res = run(['tools/math/audit-math-callsites.mjs', d]);
  const report = JSON.parse(res.stdout);
  assert.ok(report.findings.some((x) => x.code === 'P12_LOCAL_BPS_MATH'));
});

test('callsite audit passes on the clean src tree', () => {
  const res = run(['tools/math/audit-math-callsites.mjs', 'src']);
  const report = JSON.parse(res.stdout);
  assert.equal(report.status, 'PASS');
  assert.deepEqual(report.findings, []);
});
