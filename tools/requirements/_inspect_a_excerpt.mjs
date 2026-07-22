import { readFile } from 'node:fs/promises';
const j = JSON.parse(await readFile('docs/requirements/requirements/_staging/chunk-a.json', 'utf8'));
// group by chapter and see if block numbers are contiguous
const byCh = {};
for (const r of j.requirements) {
  const c = r.source.chapter;
  const b = parseInt(r.source.locator.split(':')[1], 10);
  byCh[c] = byCh[c] || [];
  byCh[c].push({ block: b, excerpt: r.source.originalExcerpt.slice(0, 60) });
}
for (const c of Object.keys(byCh).sort((a,b)=>a-b)) {
  const arr = byCh[c];
  arr.sort((x, y) => x.block - y.block);
  console.log(`Chapter ${c}: blocks ${arr[0].block}..${arr[arr.length-1].block}, count=${arr.length}`);
  console.log('  blocks:', arr.map(x => x.block).join(','));
}