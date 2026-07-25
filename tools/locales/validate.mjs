#!/usr/bin/env node
import { parseArgs } from './lib/cli.mjs';
import { validateProject } from './lib/validator-core.mjs';

try {
  const options = parseArgs(process.argv.slice(2));
  const report = await validateProject(options.root, options.mode);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  process.exitCode = report.status === 'PASS' ? 0 : 1;
} catch (error) {
  process.stderr.write(`${error.stack ?? error}\n`);
  process.exitCode = 2;
}
