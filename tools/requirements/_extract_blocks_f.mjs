// Each chapter's chapter-index entry has blockStart, blockEnd, blocks count.
// Map every content line to its corresponding absolute block.
// Strategy: assume every entry within [blockStart..blockEnd] corresponds to a
// block. Content lines fill the first N slots where N = number of entries;
// remaining slots are implicit sub-headings.
//
// For our chunk, we only emit entries for content lines (the ones with text).
// Specs reference these blocks directly.

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const kitRoot = join(fileURLToPath(new URL('../..', import.meta.url)));
const chaptersDir = join(kitRoot, 'docs/requirements/generated/chapters');

const ranges = {
  79: { start: 2087, end: 2108 },
  80: { start: 2109, end: 2126 },
  81: { start: 2127, end: 2146 },
  82: { start: 2147, end: 2168 },
  83: { start: 2169, end: 2195 },
  84: { start: 2196, end: 2216 },
  85: { start: 2217, end: 2240 },
  86: { start: 2241, end: 2256 },
  87: { start: 2257, end: 2271 },
};

const out = [];
for (const chapter of [79, 80, 81, 82, 83, 84, 85, 86, 87]) {
  const path = join(chaptersDir, `chapter-${String(chapter).padStart(2, '0')}.txt`);
  const text = await readFile(path, 'utf8');
  const lines = text.split(/\r?\n/);
  const entries = [];
  for (const line of lines) {
    if (!line) continue;
    const m = /^\[(Heading 2|Heading 3|Compact|First Paragraph|Technical Note|Code Block|Bullet|List Paragraph|Table)\]\s?(.*)$/.exec(line);
    if (!m) continue;
    entries.push({ kind: m[1], text: m[2] });
  }
  const range = ranges[chapter];
  for (let i = 0; i < entries.length; i += 1) {
    out.push({ chapter, block: range.start + i, kind: entries[i].kind, text: entries[i].text });
  }
}

await writeFile('tools/requirements/_chunk_f_blocks.json', JSON.stringify(out, null, 2), 'utf8');
console.log('Total entries:', out.length);
for (const chapter of [79, 80, 81, 82, 83, 84, 85, 86, 87]) {
  const c = out.filter(e => e.chapter === chapter);
  console.log(`Chapter ${chapter}: ${c.length} entries, blocks ${c[0].block}..${c[c.length - 1].block}`);
}