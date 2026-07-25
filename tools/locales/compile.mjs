#!/usr/bin/env node
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from './lib/cli.mjs';
import { compileProject } from './lib/compiler-core.mjs';
import { canonicalJson } from './lib/canonical-json.mjs';

try {
  const options = parseArgs(process.argv.slice(2));
  if (!options.out) throw new Error('--out is required');
  const bundles = await compileProject(options.root, options.mode);
  const manifest = { schemaVersion:1, bundles:[] };
  for (const [locale, result] of bundles) {
    const dir = path.join(options.out, locale);
    await mkdir(dir, { recursive:true });
    await writeFile(path.join(dir, 'bundle.json'), result.body, 'utf8');
    manifest.bundles.push({ locale, path:`${locale}/bundle.json`, sha256:result.sha256, byteLength:result.byteLength });
  }
  manifest.bundles.sort((a, b) => a.locale.localeCompare(b.locale, 'en'));
  await mkdir(options.out, { recursive:true });
  await writeFile(path.join(options.out, 'manifest.json'), canonicalJson(manifest), 'utf8');
  process.stdout.write(`${JSON.stringify({ status:'PASS', output:options.out, bundles:manifest.bundles }, null, 2)}\n`);
} catch (error) {
  process.stderr.write(`${error.stack ?? error}\n`);
  process.exitCode = 1;
}
