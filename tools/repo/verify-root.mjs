#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { verifyRoot } from './verify-root-lib.mjs';

function parseArgs(argv) {
  const options = { root: process.cwd(), format: 'human', output: null };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--root') options.root = resolve(argv[++index]);
    else if (arg.startsWith('--root=')) options.root = resolve(arg.slice(7));
    else if (arg === '--format') options.format = argv[++index];
    else if (arg.startsWith('--format=')) options.format = arg.slice(9);
    else if (arg === '--output') options.output = resolve(argv[++index]);
    else if (arg.startsWith('--output=')) options.output = resolve(arg.slice(9));
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!['human', 'json'].includes(options.format)) throw new Error(`Unsupported format: ${options.format}`);
  return options;
}

function human(report) {
  const lines = [`Repository root check: ${report.passed ? 'PASS' : 'FAIL'}`];
  for (const finding of report.findings) {
    lines.push(`- [${finding.severity.toUpperCase()}] ${finding.code}${finding.path ? ` (${finding.path})` : ''}: ${finding.message}`);
    lines.push(`  Repair: ${finding.repair}`);
  }
  lines.push(`Summary: ${report.summary.errors} errors, ${report.summary.warnings} warnings.`);
  return `${lines.join('\n')}\n`;
}

try {
  const options = parseArgs(process.argv.slice(2));
  const report = verifyRoot(options.root);
  const output = options.format === 'json' ? `${JSON.stringify(report, null, 2)}\n` : human(report);
  if (options.output) {
    mkdirSync(dirname(options.output), { recursive: true });
    writeFileSync(options.output, output, 'utf8');
  } else {
    process.stdout.write(output);
  }
  process.exitCode = report.passed ? 0 : 1;
} catch (error) {
  process.stderr.write(`verify-root failed: ${error.message}\n`);
  process.exitCode = 2;
}
