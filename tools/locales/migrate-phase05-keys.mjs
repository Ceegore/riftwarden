#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from './lib/cli.mjs';
import { parseStrictJson } from './lib/strict-json.mjs';
import { listFilesRecursive } from './lib/catalog.mjs';

try {
  const options = parseArgs(process.argv.slice(2));
  if (!options.map) throw new Error('--map is required');
  const mapping = parseStrictJson(await readFile(options.map, 'utf8'), options.map);
  const pairs = mapping.mappings ?? [];
  const from = new Set();
  const to = new Set();
  for (const pair of pairs) {
    if (from.has(pair.from)) throw new Error(`Duplicate source mapping: ${pair.from}`);
    if (to.has(pair.to)) throw new Error(`Duplicate target mapping: ${pair.to}`);
    if (/^S[0-9]+(?:\.|$)/u.test(pair.from) || /^S[0-9]+(?:\.|$)/u.test(pair.to)) throw new Error('Numeric screen identifiers are forbidden in copy-key mapping');
    from.add(pair.from); to.add(pair.to);
  }
  const files = (await listFilesRecursive(path.join(options.root, 'src'))).filter(file => /\.(?:ts|tsx|js|jsx|json)$/u.test(file));
  const occurrences = [];
  for (const file of files) {
    const text = await readFile(file, 'utf8');
    for (const pair of pairs) {
      let index = text.indexOf(pair.from);
      while (index !== -1) {
        occurrences.push({ file:path.relative(options.root, file), offset:index, from:pair.from, to:pair.to, change:pair.from !== pair.to });
        index = text.indexOf(pair.from, index + pair.from.length);
      }
    }
  }
  const result = { schemaVersion:1, status:'PASS', dryRun:options.dryRun, mappingCount:pairs.length, occurrenceCount:occurrences.length, changesRequired:occurrences.filter(item => item.change).length, occurrences };
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (!options.dryRun && result.changesRequired) {
    process.stderr.write('Non-dry-run writes are intentionally not implemented in the starter; review exact replacements first.\n');
    process.exitCode = 1;
  }
} catch (error) {
  process.stderr.write(`${error.stack ?? error}\n`);
  process.exitCode = 2;
}
