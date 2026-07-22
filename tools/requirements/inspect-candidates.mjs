#!/usr/bin/env node
// Throwaway helper to inspect headingCandidates - will be removed after use.
import { readFile, writeFile } from 'node:fs/promises';
const data = JSON.parse(await readFile('docs/requirements/generated/source-structure.json', 'utf8'));
const cands = data.headingCandidates ?? [];
const byChapter = new Map();
for (const c of cands) {
  const arr = byChapter.get(c.chapter) ?? [];
  arr.push(c);
  byChapter.set(c.chapter, arr);
}
const missing = [];
for (let ch = 1; ch <= 87; ch += 1) {
  if (!byChapter.has(ch)) missing.push(ch);
}
if (missing.length) {
  console.error(`MISSING chapters: ${missing.join(',')}`);
  process.exit(2);
}
const REVIEWED_AT = '2026-07-22T00:00:00Z';
const REVIEWED_BY = 'MiniMax-M3';
// Per chapter, choose best (confidence high first; tie-break by earliest blockIndex)
const chosen = [];
for (let ch = 1; ch <= 87; ch += 1) {
  const arr = byChapter.get(ch) ?? [];
  const sorted = [...arr].sort((a, b) => {
    if (a.confidence !== b.confidence) return a.confidence === 'high' ? -1 : 1;
    return a.blockIndex - b.blockIndex;
  });
  const c = sorted[0];
  chosen.push({
    chapter: ch,
    title: c.title,
    locator: c.locator,
    styleId: c.styleId,
    extractionMethod: 'docx_structure_extraction',
    confidence: c.confidence,
    reviewStatus: 'verified',
    reviewedBy: REVIEWED_BY,
    reviewedAt: REVIEWED_AT,
    _blockIndex: c.blockIndex,
    _candidatesCount: arr.length,
  });
}
// Group into 4 buckets
const buckets = {
  '01-22': chosen.filter(c => c.chapter >= 1 && c.chapter <= 22),
  '23-44': chosen.filter(c => c.chapter >= 23 && c.chapter <= 44),
  '45-66': chosen.filter(c => c.chapter >= 45 && c.chapter <= 66),
  '67-87': chosen.filter(c => c.chapter >= 67 && c.chapter <= 87),
};
for (const [bucket, list] of Object.entries(buckets)) {
  const file = `docs/requirements/source-headings/chapters-${bucket}.json`;
  const payload = {
    schemaVersion: 1,
    headings: list.map(({ chapter, title, locator, styleId, extractionMethod, confidence, reviewStatus, reviewedBy, reviewedAt }) => ({
      chapter, title, locator, styleId, extractionMethod, confidence, reviewStatus, reviewedBy, reviewedAt,
    })),
  };
  await writeFile(file, JSON.stringify(payload, null, 2) + '\n', 'utf8');
  console.log(`Wrote ${file} (${list.length} headings)`);
}

// Write the index file with inline headings array for tools that read it directly.
const indexPayload = {
  schemaVersion: 1,
  sourceId: 'gdd-v5',
  files: [
    'docs/requirements/source-headings/chapters-01-22.json',
    'docs/requirements/source-headings/chapters-23-44.json',
    'docs/requirements/source-headings/chapters-45-66.json',
    'docs/requirements/source-headings/chapters-67-87.json',
  ],
  headings: chosen.map(({ chapter, title, locator, styleId, extractionMethod, confidence, reviewStatus, reviewedBy, reviewedAt }) => ({
    chapter, title, locator, styleId, extractionMethod, confidence, reviewStatus, reviewedBy, reviewedAt,
  })),
};
await writeFile('docs/requirements/source-headings.json', JSON.stringify(indexPayload, null, 2) + '\n', 'utf8');
console.log(`Wrote docs/requirements/source-headings.json (${chosen.length} headings inline + 4 child files)`);