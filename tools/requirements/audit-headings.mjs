#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const input = process.argv[2] ?? 'docs/requirements/source-headings.json';
const payload = JSON.parse(await readFile(resolve(input), 'utf8'));
const headings = payload.headings ?? [];
const byChapter = new Map();
for (const heading of headings) {
  const bucket = byChapter.get(heading.chapter) ?? [];
  bucket.push(heading);
  byChapter.set(heading.chapter, bucket);
}
let failed = false;
for (let chapter = 1; chapter <= 87; chapter += 1) {
  const matches = byChapter.get(chapter) ?? [];
  if (matches.length !== 1) {
    console.error(`Chapter ${chapter}: expected 1 accepted heading, found ${matches.length}`);
    failed = true;
  } else if (matches[0].reviewStatus !== 'verified') {
    console.error(`Chapter ${chapter}: heading is not verified (${matches[0].reviewStatus})`);
    failed = true;
  }
}
if (headings.length !== 87) {
  console.error(`Expected exactly 87 headings, found ${headings.length}`);
  failed = true;
}
console.log(failed ? 'Heading audit: FAIL' : 'Heading audit: PASS');
process.exitCode = failed ? 1 : 0;
