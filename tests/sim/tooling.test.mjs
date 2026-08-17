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

test('crossruntime matrix pins Node against the reference trace and leaves devices NOT_RUN', () => {
  const d = mkdtempSync(join(tmpdir(), 'p14-cr-'));
  const res = run(['tools/sim/generate-crossruntime-matrix.mjs', join(d, 'matrix.json')]);
  assert.equal(res.status, 0, res.stderr);
  const matrix = JSON.parse(readFileSync(join(d, 'matrix.json'), 'utf8'));
  const fixture = JSON.parse(readFileSync(join(root, 'tests', 'sim', 'fixtures', 'reference-traces.json'), 'utf8'));
  assert.equal(matrix.runtimes.node.tick30, fixture.checkpoints.find((c) => c.tick === 30).checksum);
  assert.equal(matrix.runtimes.node.tick60, fixture.checkpoints.find((c) => c.tick === 60).checksum);
  assert.equal(matrix.runtimes.node.endHash, fixture.finalSnapshotChecksum);
  assert.equal(matrix.status, 'PARTIAL');
  for (const key of ['chromium', 'firefox', 'webkit', 'android_webview', 'ios_wkwebview']) {
    assert.equal(matrix.runtimes[key].status, 'NOT_RUN');
  }
  // Phase 15 movement trace column is also pinned against its fixture.
  const fixture15 = JSON.parse(readFileSync(join(root, 'tests', 'sim', 'fixtures', 'reference-traces-phase15.json'), 'utf8'));
  assert.equal(matrix.phase15.runtimes.node.tick30, fixture15.checkpoints.find((c) => c.tick === 30).checksum);
  assert.equal(matrix.phase15.runtimes.node.tick60, fixture15.checkpoints.find((c) => c.tick === 60).checksum);
  assert.equal(matrix.phase15.runtimes.node.endHash, fixture15.finalSnapshotChecksum);
  for (const key of ['chromium', 'firefox', 'webkit']) {
    assert.equal(matrix.phase15.runtimes[key].status, 'NOT_RUN');
  }
});

test('mass-sim harness reports PASS with no drift and accumulates events across battles', () => {
  const d = mkdtempSync(join(tmpdir(), 'p14-mass-'));
  const res = run(['tools/sim/run-mass-sim.mjs', '--battles', '5', '--out', join(d, 'mass.json')]);
  assert.equal(res.status, 0, res.stderr);
  const report = JSON.parse(readFileSync(join(d, 'mass.json'), 'utf8'));
  assert.equal(report.status, 'PASS');
  assert.equal(report.invariantErrors, 0);
  assert.equal(report.hashDrift, 0);
  assert.equal(report.totalEvents, 5 * 60);
  assert.equal(report.totalTicks, 5 * 60);
  assert.ok(report.tickLatencyMs.max >= report.tickLatencyMs.median);
});

test('phase15 mass-sim evidence (spawn + separation active) is PASS with pinned hash', () => {
  const report = JSON.parse(readFileSync(join(root, 'docs', 'reports', 'phase15-mass-sim.json'), 'utf8'));
  assert.equal(report.status, 'PASS');
  assert.equal(report.invariantErrors, 0);
  assert.equal(report.hashDrift, 0);
  assert.equal(report.battles, 10000);
  assert.equal(report.totalTicks, 600000);
  assert.equal(report.mode, 'phase15-spawn-separation');
  assert.match(report.referenceFinalHash, /^[0-9a-f]{64}$/);
  assert.ok(report.endHeapBytes <= report.peakHeapBytes, 'heap must not grow unbounded');
});

test('phase14 readiness gate honors present evidence and blocks on device work', () => {
  const d = mkdtempSync(join(tmpdir(), 'p14-ready-'));
  mkdirSync(join(d, 'contracts', 'phase15'), { recursive: true });
  mkdirSync(join(d, 'docs', 'reports'), { recursive: true });
  writeFileSync(join(d, 'contracts', 'phase15', 'phase14-readiness.expected.json'), readFileSync(join(root, 'contracts', 'phase15', 'phase14-readiness.expected.json')));
  writeFileSync(join(d, 'docs', 'reports', 'phase14-mass-sim.json'), JSON.stringify({ status: 'PASS', battles: 10000 }));
  writeFileSync(join(d, 'docs', 'reports', 'phase14-crossruntime.json'), JSON.stringify({
    runtimes: {
      node: { status: 'REFERENCE' },
      chromium: { status: 'PASS' },
      firefox: { status: 'PASS' },
      webkit: { status: 'PASS' },
      android_webview: { status: 'NOT_RUN' },
      ios_wkwebview: { status: 'NOT_RUN' },
    },
  }));
  const res = run(['tools/sim/validate-phase14-readiness.mjs', d]);
  const report = JSON.parse(res.stdout);
  assert.equal(res.status, 2);
  assert.equal(report.status, 'BLOCKED');
  assert.deepEqual(report.blockers, ['P15_G14_WEBVIEWS_NOT_RUN', 'P15_G14_NOT_REPRODUCED', 'P15_G14_DEVICE_PERF_MISSING']);
  assert.deepEqual(report.satisfied.map((s) => s.id), ['massSim', 'crossRuntimeDesktop']);
});

test('phase14 readiness gate flags missing evidence artifacts', () => {
  const d = mkdtempSync(join(tmpdir(), 'p14-ready-'));
  mkdirSync(join(d, 'contracts', 'phase15'), { recursive: true });
  writeFileSync(join(d, 'contracts', 'phase15', 'phase14-readiness.expected.json'), readFileSync(join(root, 'contracts', 'phase15', 'phase14-readiness.expected.json')));
  const res = run(['tools/sim/validate-phase14-readiness.mjs', d]);
  const report = JSON.parse(res.stdout);
  assert.equal(res.status, 2);
  assert.ok(report.blockers.includes('P15_G14_MASSSIM_MISSING'));
  assert.ok(report.blockers.includes('P15_G14_CROSSRUNTIME_MISSING'));
});

test('crossruntime browser runner fills desktop engines hash-identically to Node for both phases', () => {
  const d = mkdtempSync(join(tmpdir(), 'p14-crb-'));
  const res = run(['tools/sim/run-crossruntime-browsers.mjs', join(d, 'matrix.json')]);
  assert.equal(res.status, 0, res.stderr);
  const matrix = JSON.parse(readFileSync(join(d, 'matrix.json'), 'utf8'));
  for (const key of ['chromium', 'firefox', 'webkit']) {
    assert.equal(matrix.runtimes[key].status, 'PASS', `${key}: ${JSON.stringify(matrix.runtimes[key].drift)}`);
    assert.equal(matrix.runtimes[key].tick30, matrix.runtimes.node.tick30);
    assert.equal(matrix.runtimes[key].tick60, matrix.runtimes.node.tick60);
    assert.equal(matrix.runtimes[key].endHash, matrix.runtimes.node.endHash);
    assert.equal(matrix.runtimes[key].startHash, matrix.runtimes.node.startHash);
  }
  assert.equal(matrix.runtimes.android_webview.status, 'NOT_RUN');
  assert.equal(matrix.runtimes.ios_wkwebview.status, 'NOT_RUN');
  // Phase 15 movement trace: desktop engines hash-identical to the P15 node column.
  for (const key of ['chromium', 'firefox', 'webkit']) {
    assert.equal(matrix.phase15.runtimes[key].status, 'PASS', `${key}: ${JSON.stringify(matrix.phase15.runtimes[key].drift)}`);
    assert.equal(matrix.phase15.runtimes[key].tick30, matrix.phase15.runtimes.node.tick30);
    assert.equal(matrix.phase15.runtimes[key].tick60, matrix.phase15.runtimes.node.tick60);
    assert.equal(matrix.phase15.runtimes[key].endHash, matrix.phase15.runtimes.node.endHash);
    assert.equal(matrix.phase15.runtimes[key].startHash, matrix.phase15.runtimes.node.startHash);
  }
  assert.equal(matrix.phase15.runtimes.android_webview.status, 'NOT_RUN');
  assert.equal(matrix.phase15.runtimes.ios_wkwebview.status, 'NOT_RUN');
});
