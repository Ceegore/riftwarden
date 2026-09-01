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
// Wall-clock purity is contractually required only where determinism lives:
// the simulation kernel, replay codec and save format. App-layer timestamp
// metadata (earnedAt, discoveredAt, save updatedAt, date display) legitimately
// uses the wall clock and is out of scope; RNG-bypass checks (Math.random,
// dynamic slots, direct PRNG calls) apply everywhere.
const deterministicLayers = ['game/sim/', 'game/replay/', 'game/save/'];
for (const file of await walk(root)) {
  const text = await readFile(file, 'utf8');
  const name = relative(root, file).replaceAll('\\', '/');
  const infrastructure = name.startsWith('game/sim/random/');
  const deterministic = deterministicLayers.some((layer) => name.startsWith(layer));
  const checks = [
    ['Math.random', /Math\.random\s*\(/g],
    ...(deterministic ? [['time-seed', /(?:Date\.now\s*\(|new\s+Date\s*\()/g]] : []),
    ['dynamic-slot', /draw\s*\(\s*`[^`]*\$\{/g]
  ];
  if (!infrastructure) checks.push(['direct-prng', /\.nextUint32\s*\(/g]);
  for (const [kind, pattern] of checks) {
    for (const match of text.matchAll(pattern)) findings.push({ file: name, kind, index: match.index });
  }
}
console.log(JSON.stringify({ schemaVersion: 1, status: findings.length ? 'BLOCKED' : 'PASS', findings }, null, 2));
if (findings.length) process.exitCode = 2;
