// Fix chapter 83 block mappings in _build_chunk_f.mjs
// Use edit_file with old/new patterns.
import { readFile, writeFile } from 'node:fs/promises';
const path = 'tools/requirements/_build_chunk_f.mjs';
let text = await readFile(path, 'utf8');

const fixes = [
  [/\{ chapter: 83, block: 2171,/g, '{ chapter: 83, block: 2172,'],
  [/\{ chapter: 83, block: 2178,/g, '{ chapter: 83, block: 2176,'],
  [/\{ chapter: 83, block: 2179,/g, '{ chapter: 83, block: 2177,'],
  [/\{ chapter: 83, block: 2180,/g, '{ chapter: 83, block: 2178,'],
  [/\{ chapter: 83, block: 2181,/g, '{ chapter: 83, block: 2179,'],
  [/\{ chapter: 83, block: 2184,/g, '{ chapter: 83, block: 2182,'],
  [/\{ chapter: 83, block: 2185,/g, '{ chapter: 83, block: 2183,'],
  [/\{ chapter: 83, block: 2186,/g, '{ chapter: 83, block: 2184,'],
  [/\{ chapter: 83, block: 2187,/g, '{ chapter: 83, block: 2185,'],
  [/\{ chapter: 83, block: 2190,/g, '{ chapter: 83, block: 2188,'],
  [/\{ chapter: 83, block: 2191,/g, '{ chapter: 83, block: 2189,'],
  [/\{ chapter: 83, block: 2192,/g, '{ chapter: 83, block: 2190,'],
  [/\{ chapter: 83, block: 2193,/g, '{ chapter: 83, block: 2191,'],
];
for (const [re, val] of fixes) {
  text = text.replace(re, val);
}
await writeFile(path, text, 'utf8');
console.log('Fixed ch83 block mappings');