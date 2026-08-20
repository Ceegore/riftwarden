import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import assert from 'node:assert/strict';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..', '..');

test('phase28 golden registry matches the generator (byte-for-byte, 10k gate)', () => {
  const summary = JSON.parse(execFileSync(process.execPath, [join(root, 'tools', 'sim', 'phase28-golden-harness.mjs')], { encoding: 'utf8' }));
  assert.equal(summary.status, 'PASS');
  assert.equal(summary.gate, 'G28');
  assert.equal(summary.diverged, 0);
  assert.equal(summary.gateViolations, 0);
  const registry = JSON.parse(readFileSync(join(root, 'contracts', 'phase28', 'golden-registry.json'), 'utf8'));
  assert.equal(registry.entries.length, 12);
  assert.equal(registry.gateSampleMaps, 10000);
});
