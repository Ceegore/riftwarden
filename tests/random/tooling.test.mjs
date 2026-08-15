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

test('phase12 readiness expected contract lists all blockers', () => {
  const expected = JSON.parse(readFileSync(join(root, 'contracts', 'random', 'phase12-readiness.expected.json'), 'utf8'));
  assert.ok(expected.expectedBlockers.includes('P13_G12_NOT_PROVEN'));
  assert.ok(expected.expectedBlockers.includes('P13_BROWSER_EVIDENCE_MISSING'));
});

test('readiness gate truthfully BLOCKs with the expected blockers', () => {
  const res = run(['tools/random/validate-phase12-readiness.mjs']);
  const report = JSON.parse(res.stdout);
  assert.equal(report.status, 'BLOCKED');
  assert.ok(report.blockers.includes('P13_G12_NOT_PROVEN'));
  assert.equal(res.status, 2);
});

test('callsite audit flags Math.random outside random infrastructure', () => {
  const d = mkdtempSync(join(tmpdir(), 'p13-'));
  mkdirSync(join(d, 'game', 'sim', 'random'), { recursive: true });
  mkdirSync(join(d, 'app'), { recursive: true });
  writeFileSync(join(d, 'game', 'sim', 'random', 'index.ts'), 'export const ok = 1;\n');
  writeFileSync(join(d, 'app', 'battle.ts'), 'const r = Math.random();\n');
  const res = run(['tools/random/audit-random-callsites.mjs', d]);
  const report = JSON.parse(res.stdout);
  assert.ok(report.findings.some((x) => x.kind === 'Math.random'));
  assert.equal(res.status, 2);
});

test('callsite audit passes on the clean src tree', () => {
  const res = run(['tools/random/audit-random-callsites.mjs', 'src']);
  const report = JSON.parse(res.stdout);
  assert.equal(report.status, 'PASS');
  assert.deepEqual(report.findings, []);
});

test('roll-slot and golden validators pass on the fixtures', () => {
  const slots = run(['tools/random/validate-roll-slot-registry.mjs']);
  assert.equal(JSON.parse(slots.stdout).status, 'PASS');
  const golden = run(['tools/random/validate-golden-seeds.mjs']);
  assert.equal(JSON.parse(golden.stdout).status, 'PASS');
});
