#!/usr/bin/env node
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadKernel, runNodeReferenceTrace } from './lib/kernel-loader.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..', '..');
const out = resolve(process.argv[2] ?? resolve(root, 'docs', 'reports', 'phase14-crossruntime.json'));

const api = await loadKernel();

try {
  const node = runNodeReferenceTrace(api);

  // Cross-check against the pinned golden trace so the Node column can never
  // drift from the authoritative fixture.
  const fixture = JSON.parse(readFileSync(resolve(root, 'tests', 'sim', 'fixtures', 'reference-traces.json'), 'utf8'));
  const expected30 = fixture.checkpoints.find((c) => c.tick === 30)?.checksum;
  const expected60 = fixture.checkpoints.find((c) => c.tick === 60)?.checksum;
  if (node.tick30 !== expected30 || node.tick60 !== expected60 || node.endHash !== fixture.finalSnapshotChecksum) {
    console.error(JSON.stringify({ status: 'FAIL', reason: 'hash-drift-vs-pinned-fixture', ...node, expected30, expected60, expectedFinal: fixture.finalSnapshotChecksum }, null, 2));
    process.exit(1);
  }

  const matrix = {
    schemaVersion: 1,
    phase: 14,
    gate: 'G14',
    sourceRevision: process.env.SOURCE_REVISION ?? null,
    fixture: 'tests/sim/fixtures/reference-traces.json',
    status: 'PARTIAL',
    note: 'Node is the tooling reference, not a standalone platform proof. Browser/device rows remain NOT_RUN until the operator executes the fixture bytes on each runtime.',
    runtimes: {
      node: { status: 'REFERENCE', version: process.version, host: process.platform, startHash: node.startHash, tick30: node.tick30, tick60: node.tick60, endHash: node.endHash, endTick: node.endTick, endReason: node.endReason, eventCount: node.eventCount, exitCode: 0 },
      chromium: { status: 'NOT_RUN', startHash: null, tick30: null, tick60: null, endHash: null, endTick: null, endReason: null, eventCount: null, exitCode: null },
      firefox: { status: 'NOT_RUN', startHash: null, tick30: null, tick60: null, endHash: null, endTick: null, endReason: null, eventCount: null, exitCode: null },
      webkit: { status: 'NOT_RUN', startHash: null, tick30: null, tick60: null, endHash: null, endTick: null, endReason: null, eventCount: null, exitCode: null },
      android_webview: { status: 'NOT_RUN', startHash: null, tick30: null, tick60: null, endHash: null, endTick: null, endReason: null, eventCount: null, exitCode: null },
      ios_wkwebview: { status: 'NOT_RUN', startHash: null, tick30: null, tick60: null, endHash: null, endTick: null, endReason: null, eventCount: null, exitCode: null },
    },
  };
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, `${JSON.stringify(matrix, null, 2)}\n`);
  console.log(JSON.stringify({ status: 'PASS', out, node: { startHash: node.startHash, tick30: node.tick30, tick60: node.tick60, endHash: node.endHash } }, null, 2));
} finally {
  api.close();
}
