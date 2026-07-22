import { readFile } from 'node:fs/promises';
const blocks = JSON.parse(await readFile('tools/requirements/_chunk_f_blocks.json', 'utf8'));
for (const ch of [79, 80, 81, 82, 83, 84, 85, 86, 87]) {
  const c = blocks.filter(b => b.chapter === ch);
  console.log(`=== Chapter ${ch} ===`);
  for (const b of c) console.log(`  block ${b.block} [${b.kind}]: ${b.text.slice(0, 80)}`);
}