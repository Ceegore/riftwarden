#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { humanReport, sarifReport } from './file-length/reporters.mjs';
import { scanFileLengths } from './file-length/scan.mjs';

/**
 * @typedef {Object} FileLengthOptions
 * @property {string} root Repository root.
 * @property {'human'|'json'|'sarif'} format Output format.
 * @property {string|null} output Optional output file path.
 */

/**
 * Parses CLI arguments for the file-length checker.
 * @param {string[]} argv Process argv slice.
 * @returns {FileLengthOptions}
 */
function parseArgs(argv) {
  /** @type {FileLengthOptions} */
  const options = { root: process.cwd(), format: 'human', output: null };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === undefined) continue;
    if (arg === '--root') {
      const next = argv[index + 1];
      index += 1;
      if (next !== undefined) options.root = resolve(next);
    } else if (arg.startsWith('--root=')) {
      options.root = resolve(arg.slice(7));
    } else if (arg === '--format') {
      const next = argv[index + 1];
      index += 1;
      if (next !== undefined) options.format = /** @type {'human'|'json'|'sarif'} */ (next);
    } else if (arg.startsWith('--format=')) {
      options.format = /** @type {'human'|'json'|'sarif'} */ (arg.slice(9));
    } else if (arg === '--output') {
      const next = argv[index + 1];
      index += 1;
      if (next !== undefined) options.output = resolve(next);
    } else if (arg.startsWith('--output=')) {
      options.output = resolve(arg.slice(9));
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
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
  /** @type {{message?: string}} */
  const err = error;
  process.stderr.write(`check-file-length failed: ${err.message ?? String(error)}\n`);
  process.exitCode = 2;
}