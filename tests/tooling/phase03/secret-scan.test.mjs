import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
const script = path.resolve('tools/security/scan-secrets.mjs');
test('private key fixture blocks', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'rw-secret-'));
  await writeFile(path.join(dir, 'bad.txt'), '-----BEGIN PRIVATE KEY-----\nnot-real\n');
  const r = spawnSync(process.execPath, [script, '--root', dir], { encoding: 'utf8' });
  assert.notEqual(r.status, 0);
});
test('ordinary source passes', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'rw-secret-'));
  await writeFile(path.join(dir, 'ok.txt'), 'no credentials here\n');
  const r = spawnSync(process.execPath, [script, '--root', dir], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stdout + r.stderr);
});
