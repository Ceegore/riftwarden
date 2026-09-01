#!/usr/bin/env node
import { readFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';

const root = resolve(process.argv[2] ?? '.');
const registryPath = join(root, 'tests', 'random', 'fixtures', 'golden-seeds', 'registry.json');
if (!existsSync(registryPath)) {
  console.log(JSON.stringify({ status: 'FAIL', errors: ['golden-seeds registry missing'] }, null, 2));
  process.exitCode = 1;
} else {
  const r = JSON.parse(readFileSync(registryPath, 'utf8'));
  const errors = [];
  if (r.entries.length !== 12) errors.push('count');
  if (new Set(r.entries.map((x) => x.id)).size !== 12) errors.push('duplicate');
  for (const e of r.entries) {
    if (e.activationStatus === 'PASS' || e.expectedCheckpoints.length) errors.push(`premature:${e.id}`);
  }
  console.log(JSON.stringify({ schemaVersion: 1, status: errors.length ? 'FAIL' : 'PASS', count: r.entries.length, errors }, null, 2));
  if (errors.length) process.exitCode = 1;
}
