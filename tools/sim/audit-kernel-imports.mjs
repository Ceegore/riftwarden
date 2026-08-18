#!/usr/bin/env node
import { readdir, readFile } from 'node:fs/promises';
import { access } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';

const root = resolve(process.argv[2] ?? '.');
const scopeRoots = ['src/game/sim'];
const banned = [
  { kind: 'ui-native-import', pattern: /from\s+['"](?:react|pixi|@capacitor|.*platform|.*navigation|.*storage|.*renderer|.*localization)/g },
  { kind: 'wallclock', pattern: /\bDate\.now\s*\(|\bperformance\.now\s*\(/g },
  { kind: 'random-access', pattern: /\bMath\.random\s*\(/g },
  { kind: 'animation-frame', pattern: /\brequestAnimationFrame\s*\(/g },
  { kind: 'timer', pattern: /\bsetTimeout\s*\(|\bsetInterval\s*\(/g },
  { kind: 'locale-sort', pattern: /\.localeCompare\s*\(|\bIntl\b/g },
];

async function walk(directory) {
  const output = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const absolute = join(directory, entry.name);
    if (entry.isDirectory()) output.push(...(await walk(absolute)));
    else if (absolute.endsWith('.ts')) output.push(absolute);
  }
  return output;
}

const findings = [];
for (const scopeRoot of scopeRoots) {
  const base = join(root, scopeRoot);
  try {
    await access(base);
  } catch {
    continue;
  }
  for (const file of await walk(base)) {
    const text = await readFile(file, 'utf8');
    const name = relative(root, file).replaceAll('\\', '/');
    for (const { kind, pattern } of banned) {
      for (const match of text.matchAll(pattern)) findings.push({ file: name, kind, index: match.index });
    }
  }
}

console.log(JSON.stringify({ schemaVersion: 1, status: findings.length ? 'BLOCKED' : 'PASS', findings }, null, 2));
if (findings.length) process.exitCode = 2;
