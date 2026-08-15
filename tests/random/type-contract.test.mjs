import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const root = dirname(dirname(dirname(fileURLToPath(import.meta.url))));
const tsc = require.resolve('typescript/bin/tsc');

test('random boundary type misuse is rejected with TS2322', () => {
  const r = spawnSync(process.execPath, [tsc, '-p', 'tsconfig.type-fixtures.json'], { cwd: root, encoding: 'utf8' });
  const out = (r.stdout ?? '') + (r.stderr ?? '');
  assert.notEqual(r.status, 0, `expected tsc to fail:\n${out}`);
  assert.match(out, /TS2322/);
  assert.match(out, /invalid-random-boundaries\.ts/);
});
