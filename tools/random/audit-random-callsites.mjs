#!/usr/bin/env node
import { readdir, readFile } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';

const root = resolve(process.argv[2] ?? 'src');
async function walk(directory) {
  const output = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const absolute = join(directory, entry.name);
    if (entry.isDirectory()) output.push(...(await walk(absolute)));
    else if (/\.(ts|tsx|js|mjs)$/.test(absolute)) output.push(absolute);
  }
  return output;
}
const findings = [];
for (const file of await walk(root)) {
  const text = await readFile(file, 'utf8');
  const name = relative(root, file).replaceAll('\\', '/');
  const infrastructure = name.startsWith('game/sim/random/');
  const checks = [
    ['Math.random', /Math\.random\s*\(/g],
    ['time-seed', /(?:Date\.now\s*\(|new\s+Date\s*\()/g],
    ['dynamic-slot', /draw\s*\(\s*`[^`]*\$\{/g]
  ];
  if (!infrastructure) checks.push(['direct-prng', /\.nextUint32\s*\(/g]);
  for (const [kind, pattern] of checks) {
    for (const match of text.matchAll(pattern)) findings.push({ file: name, kind, index: match.index });
  }
}
console.log(JSON.stringify({ schemaVersion: 1, status: findings.length ? 'BLOCKED' : 'PASS', findings }, null, 2));
if (findings.length) process.exitCode = 2;
