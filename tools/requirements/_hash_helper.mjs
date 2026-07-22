// Helper: compute sha256 hashes for excerpt lines from a file.
// Reads the file given as argv[2], one excerpt per line, writes hash per line to argv[3].
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
const argIn = process.argv[2];
const argOut = process.argv[3];
if (!argIn || !argOut) {
  console.error('Usage: node _hash_helper.mjs <input> <output>');
  process.exit(2);
}
const text = await readFile(argIn, 'utf8');
const lines = text.split(/\r?\n/);
const out = [];
for (const line of lines) {
  if (line === '') { out.push(''); continue; }
  out.push('sha256:' + createHash('sha256').update(line, 'utf8').digest('hex'));
}
await writeFile(argOut, out.join('\n'), 'utf8');