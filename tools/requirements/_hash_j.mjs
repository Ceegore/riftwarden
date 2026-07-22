// Helper to compute sha256 hashes for excerpts
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const args = process.argv.slice(2);
for (const arg of args) {
  const text = readFileSync(arg, 'utf8');
  const hash = createHash('sha256').update(text).digest('hex');
  console.log(`${hash}  ${arg}`);
}