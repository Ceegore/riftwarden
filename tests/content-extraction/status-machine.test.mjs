import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { canTransition, assertTransition } from '../../tools/content/extraction/lib/status-machine.mjs';

test('legal transitions pass', () => {
  assert.equal(canTransition('UNEXTRACTED', 'EXTRACTED'), true);
  assert.equal(canTransition('EXTRACTED', 'IN_REVIEW'), true);
  assert.equal(canTransition('IN_REVIEW', 'REVIEWED'), true);
  assert.equal(canTransition('REVIEWED', 'BLOCKED'), true);
  assert.equal(canTransition('BLOCKED', 'UNEXTRACTED'), true);
});

test('illegal transitions throw P10_STATUS_TRANSITION', () => {
  assert.throws(() => assertTransition('UNEXTRACTED', 'REVIEWED'), /P10_STATUS_TRANSITION/);
  assert.throws(() => assertTransition('IN_REVIEW', 'UNEXTRACTED'), /P10_STATUS_TRANSITION/);
});

test('validate-release blocks with exit 2 and only P10_UNEXTRACTED while slots are UNEXTRACTED', () => {
  const run = spawnSync(process.execPath, [path.resolve('tools/content/extraction/validate-release.mjs')], { encoding: 'utf8' });
  assert.equal(run.status, 2);
  const report = JSON.parse(run.stdout);
  assert.equal(report.status, 'BLOCKED');
  const codes = [...new Set(report.diagnostics.map((d) => d.code))];
  assert.deepEqual(codes, ['P10_UNEXTRACTED']);
  assert.equal(report.totals.unreviewed, 408);
});

test('validate-counts CLI passes on the imported ledger', () => {
  const run = spawnSync(process.execPath, [path.resolve('tools/content/extraction/validate-counts.mjs')], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
  assert.deepEqual(JSON.parse(run.stdout).diagnostics, []);
});

test('review batches are 8-15 slots with at most two families and deterministic', () => {
  const first = spawnSync(process.execPath, [path.resolve('tools/content/extraction/generate-review-batches.mjs'), '12'], { encoding: 'utf8' });
  assert.equal(first.status, 0);
  const second = spawnSync(process.execPath, [path.resolve('tools/content/extraction/generate-review-batches.mjs'), '12'], { encoding: 'utf8' });
  const a = JSON.parse(readFileSync('docs/reports/content-ledger/review-batches.json', 'utf8'));
  const b = JSON.parse(readFileSync('docs/reports/content-ledger/review-batches.json', 'utf8'));
  assert.deepEqual(a, b);
  assert.equal(a.counts.slots, 408);
  assert.equal(a.batches.every((x) => x.slots.length >= 8 && x.slots.length <= 15 && x.families.length <= 2), true);
});

test('authority extracts match the pinned input-manifest hashes', () => {
  const manifest = JSON.parse(readFileSync('inputs/PHASE10_INPUT_MANIFEST.json', 'utf8'));
  for (const [file, expected] of Object.entries(manifest.authoritativeSources)) {
    const actual = createHash('sha256').update(readFileSync(file)).digest('hex');
    assert.equal(actual, expected, `${file} deviates from its pinned hash`);
  }
});
