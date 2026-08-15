#!/usr/bin/env node
// Emits the reference-vector format skeleton. Real expected values are pinned
// in tests/random/fixtures/reference-vectors.json (verified against the TS
// modules by the vitest suites); this tool documents the format contract and
// the source revision the pinned vectors were generated from.
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';

const out = resolve(process.argv[2] ?? 'docs/reports/reference-vectors.generated.json');
const skeleton = {
  schemaVersion: 1,
  algorithm: 'xoshiro128**-1.1',
  seedMapping: 'splitmix32-wordwise-v1',
  source: 'src/game/sim/random',
  pinnedFixture: 'tests/random/fixtures/reference-vectors.json',
  note: 'Execute the pinned vectors on every runtime (Node, Chromium, Firefox, WebKit, Android WebView, iOS WKWebView) for G13 cross-runtime evidence.'
};
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, JSON.stringify(skeleton, null, 2) + '\n');
console.log(JSON.stringify({ status: 'PASS', out }, null, 2));
