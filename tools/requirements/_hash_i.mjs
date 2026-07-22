#!/usr/bin/env node
// Compute sha256 hashes for each excerpt in chapter-i extraction.
// Reads a JSON list of { excerpt, label } from stdin, prints label -> hash on stdout.
import { createHash } from 'node:crypto';
let buf = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => { buf += chunk; });
process.stdin.on('end', () => {
  const items = JSON.parse(buf);
  for (const item of items) {
    const h = createHash('sha256').update(item.excerpt, 'utf8').digest('hex');
    console.log(`${item.label}\t${h}`);
  }
});