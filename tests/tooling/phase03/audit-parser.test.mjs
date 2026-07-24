import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const script = path.resolve('tools/security/check-audit.mjs');
async function run(data) {
  const dir = await mkdtemp(path.join(tmpdir(), 'rw-audit-'));
  const file = path.join(dir, 'audit.json');
  await writeFile(file, JSON.stringify(data));
  return spawnSync(process.execPath, [script, '--input', file], { encoding: 'utf8' });
}
test('low advisory does not block phase policy', async () => assert.equal((await run({ advisories: [{ severity: 'low' }] })).status, 0));
test('high advisory blocks', async () => assert.notEqual((await run({ advisories: [{ severity: 'high', id: 1 }] })).status, 0));
test('critical nested advisory blocks', async () => assert.notEqual((await run({ x: { y: { severity: 'critical' } } })).status, 0));
