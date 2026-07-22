import { readFile } from 'node:fs/promises';
const blocks = JSON.parse(await readFile('tools/requirements/_chunk_f_blocks.json', 'utf8'));
for (const chapter of [79, 80, 81, 82, 83, 84, 85, 86, 87]) {
  const c = blocks.filter(b => b.chapter === chapter);
  console.log(`Chapter ${chapter}: count=${c.length}, blocks ${c[0].block}..${c[c.length-1].block}`);
}