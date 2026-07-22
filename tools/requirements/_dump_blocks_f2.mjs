import { readFile } from 'node:fs/promises';
const blocks = JSON.parse(await readFile('tools/requirements/_chunk_f_blocks.json', 'utf8'));
for (const ch of [79, 80, 81, 82, 83, 84]) {
  const c = blocks.filter(b => b.chapter === ch);
  console.log(`=== Chapter ${ch} (${c.length} entries) ===`);
  c.forEach((b, i) => console.log(`  [${String(i).padStart(2, '0')}] block ${b.block} [${b.kind}]: ${b.text.slice(0, 70)}`));
}