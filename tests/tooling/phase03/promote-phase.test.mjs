import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, cpSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

const root = resolve('.');
const promote = resolve(root, 'tools/ci/promote-phase.mjs');
const validate = resolve(root, 'tools/ci/validate-phase-flags.mjs');

function makeFixture() {
  const dir = mkdtempSync(join(tmpdir(), 'rw-promote-'));
  mkdirSync(join(dir, 'ci'), { recursive: true });
  mkdirSync(join(dir, '.github', 'workflows'), { recursive: true });
  mkdirSync(join(dir, 'tools', 'ci'), { recursive: true });
  mkdirSync(join(dir, 'tools', 'lib'), { recursive: true });
  // Build a self-contained phase-9 fixture (the live registries are at 16).
  const gates = JSON.parse(readFileSync(join(root, 'ci', 'phase-gates.json'), 'utf8'));
  const checks = JSON.parse(readFileSync(join(root, 'ci', 'required-checks.json'), 'utf8'));
  gates.currentImplementationPhase = 9;
  checks.implementationPhase = 9;
  writeFileSync(join(dir, 'ci', 'phase-gates.json'), `${JSON.stringify(gates, null, 2)}\n`);
  writeFileSync(join(dir, 'ci', 'required-checks.json'), `${JSON.stringify(checks, null, 2)}\n`);
  cpSync(validate, join(dir, 'tools', 'ci', 'validate-phase-flags.mjs'));
  cpSync(join(root, 'tools', 'lib', 'fs-utils.mjs'), join(dir, 'tools', 'lib', 'fs-utils.mjs'));
  // Minimal workflow fixtures that carry the phase markers.
  writeFileSync(join(dir, '.github', 'workflows', 'pr.yml'), "env:\n  RIFTWARDEN_IMPLEMENTATION_PHASE: '9'\nrun: node tools/ci/assert-needs-results.mjs --phase 9\n");
  writeFileSync(join(dir, '.github', 'workflows', 'main.yml'), "env:\n  RIFTWARDEN_IMPLEMENTATION_PHASE: '9'\nrun: pnpm build:manifest -- --channel qa --phase 9\n");
  return dir;
}

test('promotion moves every phase marker from 9 to 10 consistently', () => {
  const dir = makeFixture();
  const res = spawnSync(process.execPath, [promote, '--to', '10', '--root', dir], { encoding: 'utf8' });
  assert.equal(res.status, 0, res.stdout + res.stderr);
  const report = JSON.parse(res.stdout);
  assert.equal(report.ok, true);
  assert.equal(report.fromPhase, 9);
  assert.equal(report.toPhase, 10);
  const gates = JSON.parse(readFileSync(join(dir, 'ci', 'phase-gates.json'), 'utf8'));
  const checks = JSON.parse(readFileSync(join(dir, 'ci', 'required-checks.json'), 'utf8'));
  assert.equal(gates.currentImplementationPhase, 10);
  assert.equal(checks.implementationPhase, 10);
  for (const file of ['pr.yml', 'main.yml']) {
    const text = readFileSync(join(dir, '.github', 'workflows', file), 'utf8');
    assert.match(text, /RIFTWARDEN_IMPLEMENTATION_PHASE: '10'/);
    assert.doesNotMatch(text, /RIFTWARDEN_IMPLEMENTATION_PHASE: '9'/);
  }
  assert.match(readFileSync(join(dir, '.github', 'workflows', 'pr.yml'), 'utf8'), /--phase 10/);
  assert.match(readFileSync(join(dir, '.github', 'workflows', 'main.yml'), 'utf8'), /--phase 10/);
  // The promoted registry passes the phase-flag validator.
  const v = spawnSync(process.execPath, [validate, '--phase', '10', '--registry', join(dir, 'ci', 'phase-gates.json')], { encoding: 'utf8' });
  assert.equal(JSON.parse(v.stdout).ok, true);
});

test('promotion refuses to go backward or stay', () => {
  const dir = makeFixture();
  const res = spawnSync(process.execPath, [promote, '--to', '9', '--root', dir], { encoding: 'utf8' });
  assert.notEqual(res.status, 0);
  assert.match(res.stderr, /refusing to go backward or stay/);
  // Nothing was modified.
  const gates = JSON.parse(readFileSync(join(dir, 'ci', 'phase-gates.json'), 'utf8'));
  assert.equal(gates.currentImplementationPhase, 9);
});

test('promotion dry-run reports what it would touch without writing', () => {
  const dir = makeFixture();
  const res = spawnSync(process.execPath, [promote, '--to', '10', '--root', dir, '--dry-run', 'true'], { encoding: 'utf8' });
  assert.equal(res.status, 0, res.stdout + res.stderr);
  const report = JSON.parse(res.stdout);
  assert.equal(report.dryRun, true);
  assert.ok(report.touched.length >= 4, 'expected registries + workflows to be reported');
  const gates = JSON.parse(readFileSync(join(dir, 'ci', 'phase-gates.json'), 'utf8'));
  assert.equal(gates.currentImplementationPhase, 9, 'dry-run must not write');
});

test('live registry is consistent at phase 16 with the phase16 gate registered', () => {
  const gates = JSON.parse(readFileSync(join(root, 'ci', 'phase-gates.json'), 'utf8'));
  const checks = JSON.parse(readFileSync(join(root, 'ci', 'required-checks.json'), 'utf8'));
  assert.equal(gates.currentImplementationPhase, 16);
  assert.equal(checks.implementationPhase, 16);
  assert.ok(gates.checks.some((c) => c.id === 'phase16-gates' && c.ownerPhase === 16 && c.requiredFromPhase === 16));
  assert.ok(checks.phasedJobs.some((j) => j.job === 'phase16_gates' && j.activationPhase === 16));
});
