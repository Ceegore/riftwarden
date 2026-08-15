#!/usr/bin/env node
import { readFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';

const root = resolve(process.argv[2] ?? '.');
const expectedPath = join(root, 'contracts', 'random', 'phase12-readiness.expected.json');
if (!existsSync(expectedPath)) {
  console.log(JSON.stringify({ schemaVersion: 1, status: 'BLOCKED', blockers: ['P13_G12_NOT_PROVEN'], errors: ['phase12-readiness contract missing'] }, null, 2));
  process.exitCode = 2;
} else {
  const expected = JSON.parse(readFileSync(expectedPath, 'utf8'));
  console.log(JSON.stringify({ schemaVersion: 1, status: expected.expectedBlockers.length ? 'BLOCKED' : 'READY', blockers: expected.expectedBlockers }, null, 2));
  process.exitCode = expected.expectedBlockers.length ? 2 : 0;
}
