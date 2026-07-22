import { readFile } from 'node:fs/promises';
const j = JSON.parse(await readFile('docs/requirements/requirements/_staging/chunk-e.json', 'utf8'));
const set = new Set(j.requirements.map(r => String(r.source.chapter)));
const missing = [];
for (let c = 64; c <= 78; c++) if (!set.has(String(c))) missing.push(c);
console.log('Chapters covered:', [...set].sort((a, b) => a - b).join(','));
console.log('Missing chapters:', missing.length ? missing.join(',') : 'NONE');
console.log('Total req:', j.requirements.length);
console.log('contextOnly:', (j.contextOnly || []).length);
console.log('chunk:', j.chunk, 'range:', JSON.stringify(j.chapterRange));
const ids = j.requirements.map(r => r.id);
const uniq = new Set(ids);
console.log('Unique IDs:', uniq.size, '/', ids.length);
const normDist = {};
for (const r of j.requirements) normDist[r.norm] = (normDist[r.norm] || 0) + 1;
console.log('Norm dist:', JSON.stringify(normDist));
const catDist = {};
for (const r of j.requirements) catDist[r.category] = (catDist[r.category] || 0) + 1;
console.log('Category dist:', JSON.stringify(catDist));
// Verify all quoteHashes are sha256
let badHash = 0;
for (const r of j.requirements) {
  const h = r.source.quoteHash;
  if (!h.startsWith('sha256:')) badHash++;
  // Verify by recomputing
  const { createHash } = await import('node:crypto');
  const recomputed = 'sha256:' + createHash('sha256').update(r.source.originalExcerpt, 'utf8').digest('hex');
  if (recomputed !== h) {
    console.log('HASH MISMATCH for', r.id, ': expected', recomputed, 'got', h);
    badHash++;
  }
}
console.log('Hash mismatches:', badHash);