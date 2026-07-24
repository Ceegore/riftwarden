import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const script = path.resolve('tools/ci/verify-workflows.mjs');
async function verify(body) {
  const dir = await mkdtemp(path.join(tmpdir(), 'rw-sec-'));
  await writeFile(path.join(dir, 'bad.yml'), body);
  return spawnSync(process.execPath, [script, '--root', dir], { encoding: 'utf8' });
}
for (const [name, fragment] of [
  ['continue-on-error', 'continue-on-error: true'],
  ['pull_request_target', 'pull_request_target:'],
  ['write-all', 'permissions: write-all'],
  ['persist credentials', 'persist-credentials: true']
]) {
  test(`${name} is rejected`, async () => {
    const r = await verify(`name: bad\non:\n  pull_request:\npermissions:\n  contents: read\njobs:\n  x:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@9c091bb21b7c1c1d1991bb908d89e4e9dddfe3e0\n        with:\n          ${fragment}\n`);
    assert.notEqual(r.status, 0);
  });
}
