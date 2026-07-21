#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { stableJson } from './lib/shared.mjs';

const files = process.argv.slice(2);
if (files.length === 0) {
  console.error('Usage: node tools/requirements/canonicalize-json.mjs <file.json> [...]');
  process.exit(2);
}
for (const file of files) {
  const absolute = resolve(file);
  const parsed = JSON.parse(await readFile(absolute, 'utf8'));
  await writeFile(absolute, stableJson(parsed), 'utf8');
  console.log(`Canonicalized: ${absolute}`);
}
