import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
const script = path.resolve('tools/deps/diff.mjs');
test('added transitive dependency is visible', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'rw-dep-'));
  const base = path.join(dir, 'base.json'); const head = path.join(dir, 'head.json');
  await writeFile(base, JSON.stringify({ components: [{ name: 'a', version: '1.0.0', scope: 'runtime' }] }));
  await writeFile(head, JSON.stringify({ components: [{ name: 'a', version: '1.0.0', scope: 'runtime' }, { name: 'b', version: '2.0.0', scope: 'transitive' }] }));
  const r = spawnSync(process.execPath, [script, '--base', base, '--head', head], { encoding: 'utf8' });
  assert.equal(r.status, 0);
  const result = JSON.parse(r.stdout);
  assert.equal(result.added[0].name, 'b');
});
