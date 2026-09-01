import { execFileSync } from 'node:child_process';
import { test } from 'node:test';
import assert from 'node:assert/strict';

test('P26 speed/pause golden registry matches the harness output', () => {
  const output = execFileSync(process.execPath, ['tools/sim/phase26-golden-harness.mjs', '--check'], { encoding: 'utf8' });
  const report = JSON.parse(output);
  assert.equal(report.status, 'PASS');
  assert.equal(report.gate, 'G26');
  assert.equal(report.entries, 17);
  assert.equal(report.diverged, 0);
});
