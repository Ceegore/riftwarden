#!/usr/bin/env node
// Properly inspect chapters 59..87 by reading all heading files for the range
import { readFile } from 'node:fs/promises';

const file = process.argv[2] || 'docs/requirements/generated/source-structure.json';
const lo = Number(process.argv[3] || 59);
const hi = Number(process.argv[4] || 87);

const raw = await readFile(file, 'utf8');
const data = JSON.parse(raw);
const blocks = data.blocks;

// Read all relevant heading files
const allHeadings = [];
for (const range of ['01-22', '23-44', '45-66', '67-87']) {
  try {
    const hf = `docs/requirements/source-headings/chapters-${range}.json`;
    const h = JSON.parse(await readFile(hf, 'utf8'));
    allHeadings.push(...h.headings);
  } catch (e) {
    // ignore
  }
}

// Build chapter ranges
const chapterStarts = new Map();
for (const h of allHeadings) {
  if (h.chapter < lo || h.chapter > hi) continue;
  const m = /block:(\d+)/.exec(h.locator);
  if (m) chapterStarts.set(h.chapter, Number(m[1]));
}
// Add sentinel for hi+1
chapterStarts.set(hi + 1, blocks.length);

for (let ch = lo; ch <= hi; ch++) {
  const start = chapterStarts.get(ch);
  if (start === undefined) {
    console.error(`missing heading for chapter ${ch}`);
    continue;
  }
  // find next chapter start
  let nextStart = blocks.length;
  for (let c = ch + 1; c <= hi + 1; c++) {
    if (chapterStarts.has(c)) {
      nextStart = chapterStarts.get(c);
      break;
    }
  }
  const end = nextStart;
  const heading = allHeadings.find(h => h.chapter === ch);
  console.log(`\n===== CHAPTER ${ch} (blocks ${start}..${end - 1}) - ${heading?.title ?? 'UNKNOWN'} =====`);
  for (let i = start; i < end; i++) {
    const b = blocks[i];
    if (!b) continue;
    if (b.type === 'paragraph') {
      const t = (b.text || '').replace(/\s+/g, ' ').trim();
      console.log(`[${b.blockIndex}] ${b.styleId}: ${t}`);
    } else if (b.type === 'table') {
      console.log(`[${b.blockIndex}] TABLE (rows=${b.rows ? b.rows.length : 0}):`);
      if (b.rows) {
        for (const row of b.rows) {
          console.log(`   | ${row.map(c => String(c).replace(/\s+/g,' ').trim()).join(' | ')}`);
        }
      }
    } else {
      console.log(`[${b.blockIndex}] ${b.type}`);
    }
  }
}