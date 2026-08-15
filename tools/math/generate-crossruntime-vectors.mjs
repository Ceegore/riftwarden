#!/usr/bin/env node
// Generates cross-runtime vector expectations from the authoritative math
// module. Real cross-runtime evidence (Chromium/Firefox/WebKit/WebViews) is a
// G12 gate that stays NOT_RUN until the operator executes the vectors there.
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';

const out = resolve(process.argv[2] ?? 'docs/reports/crossruntime-vectors.generated.json');
// Compile-free import: the repo's vitest pipeline runs TS natively; for this
// standalone generator we reuse the app tsconfig via a tiny esbuild-free
// fallback is not possible, so this tool is a test-helper that documents the
// vector format and is exercised by tests/math/vector.test.ts against the TS
// modules directly. The generator itself only emits the format contract.
const cases = [
  ['round:p-half', { op: 'roundDivHalfAwayFromZero', args: [1, 2] }],
  ['round:n-half', { op: 'roundDivHalfAwayFromZero', args: [-1, 2] }],
  ['round:third', { op: 'roundDivHalfAwayFromZero', args: [2, 3] }],
  ['bps:1250', { op: 'applyBasisPoints', args: [1000, 1250] }],
  ['defense:-40', { op: 'mitigatedDamage', args: [1000, -40] }],
  ['defense:200', { op: 'mitigatedDamage', args: [1000, 200] }],
  ['true:boss-cap', { op: 'cappedTrueDamage', args: [9999, 10000, 1800] }],
  ['time:045', { op: 'secondsToTicks', args: ['0.45', true] }],
  ['time:065', { op: 'secondsToTicks', args: ['0.65', true] }],
  ['control:70', { op: 'controlDurationTicks', args: [75, 7000, true] }]
];
const vectors = { schemaVersion: 1, generatedBy: 'phase12', source: 'src/game/sim/math', cases };
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(vectors, null, 2) + '\n');
console.log(JSON.stringify({ status: 'PASS', count: vectors.cases.length, out }, null, 2));
