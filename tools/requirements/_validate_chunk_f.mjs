import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
const j = JSON.parse(await readFile('docs/requirements/requirements/_staging/chunk-f.json', 'utf8'));
let okHash = 0, badHash = 0;
for (const r of j.requirements) {
  const h = 'sha256:' + createHash('sha256').update(r.source.originalExcerpt, 'utf8').digest('hex');
  if (h === r.source.quoteHash) okHash += 1;
  else { badHash += 1; console.log('MISMATCH:', r.id, r.source.chapter, r.source.locator); }
}
console.log('OK hashes:', okHash, 'BAD:', badHash);
console.log('Chapters:', [...new Set(j.requirements.map(r => r.source.chapter))].sort((a,b)=>a-b));
console.log('Context only:', j.contextOnly.length);
const ids = j.requirements.map(r => r.id);
const dups = ids.filter((id, i) => ids.indexOf(id) !== i);
console.log('Duplicate IDs:', dups);