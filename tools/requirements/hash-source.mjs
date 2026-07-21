#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { basename, resolve } from 'node:path';

const filePath = process.argv[2];
if (!filePath) {
  console.error('Usage: node tools/requirements/hash-source.mjs <source-file>');
  process.exit(2);
}
const absolute = resolve(filePath);
const data = await readFile(absolute);
const metadata = await stat(absolute);
const result = {
  fileName: basename(absolute),
  byteSize: metadata.size,
  sha256: createHash('sha256').update(data).digest('hex'),
};
console.log(JSON.stringify(result, null, 2));
