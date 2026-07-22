#!/usr/bin/env node
// Combine part files and run build
import { readFile, writeFile } from 'node:fs/promises';

const all = [];
for (const p of [
  'tools/requirements/_chunk_e_data_part1.json',
  'tools/requirements/_chunk_e_data_part2.json',
  'tools/requirements/_chunk_e_data_part3.json'
]) {
  const txt = await readFile(p, 'utf8');
  all.push(...JSON.parse(txt));
}
await writeFile('tools/requirements/_chunk_e_data.json', JSON.stringify(all, null, 2), 'utf8');
console.log('Combined', all.length, 'rows -> tools/requirements/_chunk_e_data.json');