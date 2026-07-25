#!/usr/bin/env node
import { parseArgs } from './lib/cli.mjs';
import { validateProject } from './lib/validator-core.mjs';

try {
  const options = parseArgs(process.argv.slice(2));
  const report = await validateProject(options.root, 'development');
  const errors = report.errors.filter(item => item.code === 'L10N_GLOSSARY_FORBIDDEN_VARIANT');
  const result = { schemaVersion:1, status:errors.length ? 'FAIL' : 'PASS', errorCount:errors.length, errors };
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  process.exitCode = errors.length ? 1 : 0;
} catch (error) {
  process.stderr.write(`${error.stack ?? error}\n`);
  process.exitCode = 2;
}
