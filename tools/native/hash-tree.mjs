#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { listFiles } from './lib.mjs';

const root = path.resolve(process.argv[2] ?? '.');
const targets = process.argv.slice(3).length ? process.argv.slice(3) : ['android', 'ios', 'capacitor.config.ts'];
const records = [];
for (const target of targets) {
  const absolute = path.join(root, target);
  const files = (await listFiles(absolute)).length ? await listFiles(absolute) : [absolute];
  for (const file of files) {
    try {
      const bytes = await readFile(file);
      records.push({ path: path.relative(root, file).replaceAll('\\', '/'), sha256: createHash('sha256').update(bytes).digest('hex'), byteLength: bytes.length });
    } catch { /* missing target is represented below */ }
  }
}
records.sort((a, b) => a.path.localeCompare(b.path));
const treeHash = createHash('sha256').update(JSON.stringify(records)).digest('hex');
process.stdout.write(`${JSON.stringify({ schemaVersion: 1, treeHash, files: records }, null, 2)}\n`);
