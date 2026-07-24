import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const script = path.resolve('tools/ci/verify-workflows.mjs');
async function run(yaml) {
  const dir = await mkdtemp(path.join(tmpdir(), 'rw-wf-'));
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, 'test.yml'), yaml);
  return spawnSync(process.execPath, [script, '--root', dir], { encoding: 'utf8' });
}
test('full SHA action pin passes', async () => {
  const r = await run(`name: t\non: [push]\npermissions:\n  contents: read\njobs:\n  x:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@9c091bb21b7c1c1d1991bb908d89e4e9dddfe3e0\n`);
  assert.equal(r.status, 0, r.stdout + r.stderr);
});
test('mutable tag is rejected', async () => {
  const r = await run(`name: t\non: [push]\npermissions:\n  contents: read\njobs:\n  x:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v7\n`);
  assert.notEqual(r.status, 0);
});
