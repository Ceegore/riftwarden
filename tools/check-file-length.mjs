#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { humanReport, sarifReport } from './file-length/reporters.mjs';
import { scanFileLengths } from './file-length/scan.mjs';

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
  if (!['human', 'json', 'sarif'].includes(options.format)) throw new Error(`Unsupported format: ${options.format}`);
  return options;
}

try {
  const options = parseArgs(process.argv.slice(2));
  const report = scanFileLengths(options.root);
  const payload = options.format === 'human'
    ? humanReport(report)
    : `${JSON.stringify(options.format === 'sarif' ? sarifReport(report) : report, null, 2)}\n`;
  if (options.output) {
    mkdirSync(dirname(options.output), { recursive: true });
    writeFileSync(options.output, payload, 'utf8');
  } else {
    process.stdout.write(payload);
  }
  process.exitCode = report.passed ? 0 : 1;
} catch (error) {
  process.stderr.write(`check-file-length failed: ${error.message}\n`);
  process.exitCode = 2;
}
