import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const script = path.resolve('tools/ci/assert-needs-results.mjs');
const base = { schemaVersion: 1, activeJobs: ['a'], phasedJobs: [{ job: 'later', activationPhase: 4, expectedBeforeActivation: 'skipped' }] };
async function run(needs, phase = 3) {
  const dir = await mkdtemp(path.join(tmpdir(), 'rw-needs-'));
  const file = path.join(dir, 'contract.json');
  await writeFile(file, JSON.stringify(base));
  return spawnSync(process.execPath, [script, '--contract', file, '--phase', String(phase)], { encoding: 'utf8', env: { ...process.env, NEEDS_JSON: JSON.stringify(needs) } });
}
test('active success and future skipped pass', async () => {
  const r = await run({ a: { result: 'success' }, later: { result: 'skipped' } });
  assert.equal(r.status, 0, r.stdout + r.stderr);
});
for (const bad of ['failure', 'cancelled', 'skipped']) test(`active ${bad} blocks`, async () => {
  const r = await run({ a: { result: bad }, later: { result: 'skipped' } });
  assert.notEqual(r.status, 0);
});
test('activated phased job must succeed', async () => {
  const r = await run({ a: { result: 'success' }, later: { result: 'skipped' } }, 4);
  assert.notEqual(r.status, 0);
});
