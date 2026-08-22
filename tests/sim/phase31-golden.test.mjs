import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..', '..');
const registryPath = resolve(root, 'contracts', 'phase31', 'golden-registry.json');
const harnessPath = resolve(root, 'tools', 'sim', 'phase31-golden-harness.mjs');

test('phase31 derived-stats golden registry exists and pins the two kit cases', () => {
  assert.ok(existsSync(registryPath), 'golden-registry.json missing');
  const registry = JSON.parse(readFileSync(registryPath, 'utf8'));
  assert.equal(registry.phase, 31);
  assert.equal(registry.kind, 'derived-stats-golden');
  assert.equal(registry.pinnedCases.length, 2);
  assert.equal(registry.pinnedCases[0].result, 148);
  assert.equal(registry.pinnedCases[1].result, 1);
  assert.equal(registry.sweep.count, 10000);
  assert.equal(registry.sweep.failures, 0);
});

test('phase31 derived-stats golden harness check passes', () => {
  execFileSync(process.execPath, [harnessPath, '--check'], { cwd: root, stdio: 'pipe' });
});
