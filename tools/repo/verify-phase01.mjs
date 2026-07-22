#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const checks = [
  ['verify-repo', ['node', 'tools/repo/verify-root.mjs']],
  ['file-length-check', ['node', 'tools/check-file-length.mjs']],
  ['text-normalization', ['node', 'tools/repo/check-text-normalization.mjs']],
  ['repo-tests', ['node', '--test', 'tests/unit/repo/*.test.mjs'], { shell: true }],
  ['governance-evidence', ['node', 'tools/repo/verify-governance-evidence.mjs']],
];

const results = [];
for (const [name, command, options = {}] of checks) {
  const result = spawnSync(command[0], command.slice(1), {
    cwd: process.cwd(),
    encoding: 'utf8',
    shell: options.shell ?? false,
  });
  results.push({
    name,
    command: command.join(' '),
    exitCode: result.status ?? 2,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    passed: result.status === 0,
  });
  process.stdout.write(`\n## ${name}\n${result.stdout ?? ''}${result.stderr ?? ''}`);
}

const report = {
  schemaVersion: 1,
  phase: '01',
  generatedAtUtc: new Date().toISOString(),
  passed: results.every((result) => result.passed),
  results,
  warning: 'This automated summary does not replace remote branch-protection evidence or the signed phase report.',
};
const output = resolve('docs/reports/generated/phase-01-verification.json');
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
process.exitCode = report.passed ? 0 : 1;
