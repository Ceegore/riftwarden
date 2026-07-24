import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
const script = path.resolve('tools/security/check-artifact-allowlist.mjs');
test('secret-like artifact is blocked', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'rw-art-'));
  const root = path.join(dir, 'artifacts');
  await mkdir(path.join(root, 'security'), { recursive: true });
  await writeFile(path.join(root, 'security', 'release.p12'), 'x');
  const policy = path.join(dir, 'policy.json');
  await writeFile(policy, JSON.stringify({ allowedRoots: [path.relative(process.cwd(), path.join(root, 'security')).replaceAll('\\','/')] }));
  const r = spawnSync(process.execPath, [script, '--root', root, '--policy', policy], { encoding: 'utf8' });
  assert.notEqual(r.status, 0);
});
