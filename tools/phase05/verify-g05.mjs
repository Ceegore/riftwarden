import { spawnSync } from 'node:child_process';
import path from 'node:path';

const root = process.cwd();
const checks = [
  ['contracts', 'tools/phase05/verify-contracts.mjs'],
  ['source', 'tools/phase05/verify-source-shape.mjs'],
  ['copy', 'tools/phase05/verify-copy-parity.mjs'],
  ['evidence', 'tools/phase05/verify-evidence.mjs'],
];

const results = [];
let ok = true;
for (const [name, script] of checks) {
  if (typeof script !== 'string') continue;
  const result = spawnSync(
    process.execPath,
    [path.join(root, script)],
    { cwd: root, encoding: 'utf8' },
  );
  const passed = result.status === 0;
  results.push({
    name,
    passed,
    exitCode: result.status,
    stdout: (result.stdout ?? '').trim(),
    stderr: (result.stderr ?? '').trim(),
  });
  ok &&= passed;
}

process.stdout.write(`${JSON.stringify({ tool: 'verify-g05', ok, results }, null, 2)}\n`);
if (!ok) process.exitCode = 1;
