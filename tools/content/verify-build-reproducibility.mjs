#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { compileGraph } from './lib/compiler-core.mjs';
import { loadSource, loadLocaleKeys } from './lib/source-loader.mjs';
import { diagnosticOf } from './lib/diagnostic.mjs';

const root = path.resolve(process.argv[2] ?? '.');
const profile = process.argv.includes('--profile') ? process.argv[process.argv.indexOf('--profile') + 1] : 'fixture';

async function sha256File(file) {
  return createHash('sha256').update(await readFile(file)).digest('hex');
}

async function treeHash(dir) {
  const entries = [];
  async function visit(current, rel) {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      const child = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) await visit(full, child);
      else if (entry.isFile()) entries.push([child, await sha256File(full)]);
    }
  }
  await visit(dir, '');
  entries.sort((a, b) => a[0].localeCompare(b[0], 'en'));
  return entries;
}

let aDir;
let bDir;
try {
  aDir = await mkdtemp(path.join(tmpdir(), 'rw-content-a-'));
  bDir = await mkdtemp(path.join(tmpdir(), 'rw-content-b-'));
  await compileGraph({ root, outDir: aDir, profile, loadSource, loadLocaleKeys });
  await compileGraph({ root, outDir: bDir, profile, loadSource, loadLocaleKeys });
  const [a, b] = await Promise.all([treeHash(aDir), treeHash(bDir)]);
  const aPaths = new Set(a.map(([p]) => p));
  const bPaths = new Set(b.map(([p]) => p));
  const missing = [...aPaths].filter((p) => !bPaths.has(p));
  const extra = [...bPaths].filter((p) => !aPaths.has(p));
  const differs = a.filter(([p, h]) => !bPaths.has(p) || b.find(([q, x]) => q === p)[1] !== h);
  const ok = missing.length === 0 && extra.length === 0 && differs.length === 0;
  console.log(JSON.stringify({
    schemaVersion: 1,
    status: ok ? 'PASS' : 'FAIL',
    files: a.length,
    missingFromSecond: missing,
    extraInSecond: extra,
    differing: differs.map(([p]) => p)
  }, null, 2));
  if (!ok) process.exitCode = 1;
} catch (error) {
  console.error(JSON.stringify({ status: 'FAIL', diagnostic: diagnosticOf(error) }, null, 2));
  process.exitCode = 1;
} finally {
  if (aDir) await rm(aDir, { recursive: true, force: true });
  if (bDir) await rm(bDir, { recursive: true, force: true });
}
