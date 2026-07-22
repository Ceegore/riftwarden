#!/usr/bin/env node
// Dump chapter content to file for analysis
import { readFile, writeFile } from 'node:fs/promises';

const file = process.argv[2] || 'docs/requirements/generated/source-structure.json';
const lo = Number(process.argv[3] || 59);
const hi = Number(process.argv[4] || 87);
const outFile = process.argv[5] || 'docs/requirements/_inspect_dump.txt';

const raw = await readFile(file, 'utf8');
const data = JSON.parse(raw);
const blocks = data.blocks;

const allHeadings = [];
for (const range of ['01-22', '23-44', '45-66', '67-87']) {
  try {
    const hf = `docs/requirements/source-headings/chapters-${range}.json`;
    const h = JSON.parse(await readFile(hf, 'utf8'));
    allHeadings.push(...h.headings);
  } catch (e) {}
}

const chapterStarts = new Map();
for (const h of allHeadings) {
  if (h.chapter < lo || h.chapter > hi) continue;
  const m = /block:(\d+)/.exec(h.locator);
  if (m) chapterStarts.set(h.chapter, Number(m[1]));
}
chapterStarts.set(hi + 1, blocks.length);

const lines = [];
for (let ch = lo; ch <= hi; ch++) {
  const start = chapterStarts.get(ch);
  if (start === undefined) {
    lines.push(`MISSING HEADING for chapter ${ch}`);
    continue;
  }
  let nextStart = blocks.length;
  for (let c = ch + 1; c <= hi + 1; c++) {
    if (chapterStarts.has(c)) { nextStart = chapterStarts.get(c); break; }
  }
  const heading = allHeadings.find(h => h.chapter === ch);
  lines.push(`\n===== CHAPTER ${ch} (blocks ${start}..${nextStart - 1}) - ${heading?.title ?? 'UNKNOWN'} =====`);
  for (let i = start; i < nextStart; i++) {
    const b = blocks[i];
    if (!b) continue;
    if (b.type === 'paragraph') {
      const t = (b.text || '').replace(/\s+/g, ' ').trim();
      lines.push(`[${b.blockIndex}] ${b.styleId}: ${t}`);
    } else if (b.type === 'table') {
      lines.push(`[${b.blockIndex}] TABLE (rows=${b.rows ? b.rows.length : 0}):`);
      if (b.rows) {
        for (const row of b.rows) {
          lines.push(`   | ${row.map(c => String(c).replace(/\s+/g,' ').trim()).join(' | ')}`);
        }
      }
    } else {
      lines.push(`[${b.blockIndex}] ${b.type}`);
    }
  }
}
await writeFile(outFile, lines.join('\n'), 'utf8');
console.log(`Wrote ${lines.length} lines to ${outFile}`);