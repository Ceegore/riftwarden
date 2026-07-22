import { readFileSync } from 'node:fs';
const d = JSON.parse(readFileSync('docs/requirements/requirements/_staging/chunk-j.json','utf8'));
const c = {};
const cat = {};
const norm = {};
for (const r of d.requirements) {
  c[r.source.chapter] = (c[r.source.chapter] || 0) + 1;
  cat[r.category] = (cat[r.category] || 0) + 1;
  norm[r.norm] = (norm[r.norm] || 0) + 1;
}
console.log('Total:', d.requirements.length);
console.log('By chapter:', JSON.stringify(c, null, 2));
console.log('By category:', JSON.stringify(cat, null, 2));
console.log('By norm:', JSON.stringify(norm, null, 2));
console.log('By chapter+section:');
const cs = {};
for (const r of d.requirements) {
  const k = `${r.source.chapter} / ${r.source.section}`;
  cs[k] = (cs[k] || 0) + 1;
}
console.log(JSON.stringify(cs, null, 2));