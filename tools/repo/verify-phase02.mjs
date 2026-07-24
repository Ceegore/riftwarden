import { spawnSync } from 'node:child_process';

/**
 * @typedef {[string, string[]]} Step
 */

/** @type {Step[]} */
const steps = [
  ['node', ['tools/toolchain/verify-freeze.mjs']],
  ['pnpm', ['install', '--frozen-lockfile']],
  ['pnpm', ['format:check']],
  ['pnpm', ['typecheck']],
  ['pnpm', ['lint:negative']],
  ['pnpm', ['test:tooling']],
  ['pnpm', ['test:unit']],
  ['pnpm', ['test:sim']],
  ['pnpm', ['test:integration']],
  ['pnpm', ['build:release']],
  ['pnpm', ['test:e2e']],
  ['node', ['tools/toolchain/verify-licenses.mjs']],
];
const results = [];
for (const [command, args] of steps) {
  const result = spawnSync(command, args, { stdio: 'inherit', shell: process.platform === 'win32' });
  results.push({ command: [command, ...args].join(' '), exitCode: result.status });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
console.log(JSON.stringify({ gate: 'G02', status: 'LOCAL_CHECKS_PASS', results }, null, 2));
console.log('Remote CI, branch protection and phase report evidence are still required before PASS.');
