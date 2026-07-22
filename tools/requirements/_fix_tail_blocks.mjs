import { readFile, writeFile } from 'node:fs/promises';
const path = 'tools/requirements/_build_chunk_f_tail.mjs';
let text = await readFile(path, 'utf8');

// Fix chapter 84 block mappings. From dump:
// 2196 H2, 2197 H3 84.1, 2198 Compact PixiJS, 2199 Compact WebGPU, 2200 Compact Canvas, 2201 Compact contextlost
// 2202 H3 84.2, 2203 H3 84.3, 2204 H3 84.4, 2205 H3 84.5, 2206 Compact benchmark, 2207 Compact thresholds,
// 2208 Compact battle reduce, 2209 Compact no ramp up, 2210 H3 84.6, 2211 Compact background 0, 2212 Compact thermal, 2213 Compact stress
const fixes = [
  [/\{ chapter: 84, block: 2198,/g, '{ chapter: 84, block: 2198,'],
  [/\{ chapter: 84, block: 2199,/g, '{ chapter: 84, block: 2199,'],
  [/\{ chapter: 84, block: 2200,/g, '{ chapter: 84, block: 2200,'],
  [/\{ chapter: 84, block: 2201,/g, '{ chapter: 84, block: 2201,'],
  [/\{ chapter: 84, block: 2209,/g, '{ chapter: 84, block: 2206,'],
  [/\{ chapter: 84, block: 2210,/g, '{ chapter: 84, block: 2207,'],
  [/\{ chapter: 84, block: 2211,/g, '{ chapter: 84, block: 2208,'],
  [/\{ chapter: 84, block: 2212,/g, '{ chapter: 84, block: 2209,'],
  [/\{ chapter: 84, block: 2213,/g, '{ chapter: 84, block: 2211,'],
  [/\{ chapter: 84, block: 2214,/g, '{ chapter: 84, block: 2212,'],
  [/\{ chapter: 84, block: 2215,/g, '{ chapter: 84, block: 2213,'],
];
for (const [re, val] of fixes) {
  text = text.replace(re, val);
}
await writeFile(path, text, 'utf8');
console.log('Fixed ch84 block mappings');