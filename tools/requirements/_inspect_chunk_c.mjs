#!/usr/bin/env node
// Inspect chapters 59..87 of source-structure.json
import { readFile } from 'node:fs/promises';

const file = process.argv[2] || 'docs/requirements/generated/source-structure.json';
const lo = Number(process.argv[3] || 59);
const hi = Number(process.argv[4] || 87);

const raw = await readFile(file, 'utf8');
const data = JSON.parse(raw);
const blocks = data.blocks;

const headings = JSON.parse(await readFile('docs/requirements/source-headings.json', 'utf8'));
// try file-based headings
let headingList = [];
for (const c of [lo, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, hi]) {
  try {
    const fs = await import('node:fs/promises');
    // determine which range file
    const range = c <= 22 ? '01-22' : c <= 44 ? '23-44' : c <= 66 ? '45-66' : '67-87';
    const hf = `docs/requirements/source-headings/chapters-${range}.json`;
    const h = JSON.parse(await fs.readFile(hf, 'utf8'));
    const hit = h.headings.find(x => x.chapter === c);
    if (hit) headingList.push(hit);
  } catch (e) {
    // ignore
  }
}

// Build chapter ranges
const chapterStarts = new Map();
for (const h of headingList) {
  const m = /block:(\d+)/.exec(h.locator);
  if (m) chapterStarts.set(h.chapter, Number(m[1]));
}
// Add chapter 88 as sentinel
chapterStarts.set(hi + 1, blocks.length);

for (const ch of [lo, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, hi]) {
  const start = chapterStarts.get(ch);
  if (start === undefined) { console.error(`missing heading for chapter ${ch}`); continue; }
  // find next chapter start
  const next = [];
  for (let c = ch + 1; c <= hi + 1; c++) {
    if (chapterStarts.has(c)) { next.push(chapterStarts.get(c)); break; }
  }
  const end = next.length ? next[0] : blocks.length;
  console.log(`\n===== CHAPTER ${ch} (blocks ${start}..${end - 1}) =====`);
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
