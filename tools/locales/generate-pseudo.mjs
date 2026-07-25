#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { parseArgs } from './lib/cli.mjs';
import { compileProject } from './lib/compiler-core.mjs';
import { createPseudoBundle } from './lib/pseudo.mjs';

try {
  const options = parseArgs(process.argv.slice(2));
  if (!options.out) throw new Error('--out is required');
  const bundles = await compileProject(options.root, 'development');
  const de = bundles.get('de');
  if (!de) throw new Error('German authoring bundle is required');
  const body = createPseudoBundle(JSON.parse(de.body));
  await mkdir(options.out, { recursive:true });
  await writeFile(path.join(options.out, 'bundle.json'), body, 'utf8');
  process.stdout.write(`${JSON.stringify({ status:'PASS', locale:'qps-ploc', byteLength:Buffer.byteLength(body), sha256:createHash('sha256').update(body).digest('hex') }, null, 2)}\n`);
} catch (error) {
  process.stderr.write(`${error.stack ?? error}\n`);
  process.exitCode = 1;
}
