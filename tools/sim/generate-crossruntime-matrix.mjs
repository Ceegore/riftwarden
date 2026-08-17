#!/usr/bin/env node
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadKernel, buildReferenceBattle } from './lib/kernel-loader.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..', '..');
const out = resolve(process.argv[2] ?? resolve(root, 'docs', 'reports', 'phase14-crossruntime.json'));

const api = await loadKernel();
const { battleKernel, noopSystems, snapshot } = api;
const input = Object.freeze({ paused: false, decisions: Object.freeze([]), contentVersion: 'content_fixture' });

try {
  let state = buildReferenceBattle(api);
  const startHash = snapshot.createSnapshot(state).checksum;
  const random = (() => {
    const streams = api.random.RngStreamMap.fromRunSeed(api.random.parseRunSeed(['00000001', '00000002', '00000003', '00000004']));
    return new api.random.RandomSession(streams, new api.random.RollSlotRegistry([]), false);
  })();

  const checkpoints = [];
  for (let i = 0; i < 60; i++) {
    const r = battleKernel.stepBattle({ state, input, random, rules: {}, content: {}, systems: noopSystems.createNoopSystems() });
    state = r.state;
    if (r.checkpoint) checkpoints.push({ tick: state.tick, checksum: r.checkpoint.checksum });
  }

  const tick30 = checkpoints.find((c) => c.tick === 30)?.checksum ?? null;
  const tick60 = checkpoints.find((c) => c.tick === 60)?.checksum ?? null;
  const endHash = snapshot.createSnapshot(state).checksum;

  // Cross-check against the pinned golden trace so the Node column can never
  // drift from the authoritative fixture.
  const fixture = JSON.parse(readFileSync(resolve(root, 'tests', 'sim', 'fixtures', 'reference-traces.json'), 'utf8'));
  const expected30 = fixture.checkpoints.find((c) => c.tick === 30)?.checksum;
  const expected60 = fixture.checkpoints.find((c) => c.tick === 60)?.checksum;
  if (tick30 !== expected30 || tick60 !== expected60 || endHash !== fixture.finalSnapshotChecksum) {
    console.error(JSON.stringify({ status: 'FAIL', reason: 'hash-drift-vs-pinned-fixture', tick30, expected30, tick60, expected60, endHash, expectedFinal: fixture.finalSnapshotChecksum }, null, 2));
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
      node: { status: 'REFERENCE', version: process.version, host: process.platform, startHash, tick30, tick60, endHash, endTick: state.tick, endReason: state.endReason, eventCount: state.emittedEventCount, exitCode: 0 },
      chromium: { status: 'NOT_RUN', startHash: null, tick30: null, tick60: null, endHash: null, endTick: null, endReason: null, eventCount: null, exitCode: null },
      firefox: { status: 'NOT_RUN', startHash: null, tick30: null, tick60: null, endHash: null, endTick: null, endReason: null, eventCount: null, exitCode: null },
      webkit: { status: 'NOT_RUN', startHash: null, tick30: null, tick60: null, endHash: null, endTick: null, endReason: null, eventCount: null, exitCode: null },
      android_webview: { status: 'NOT_RUN', startHash: null, tick30: null, tick60: null, endHash: null, endTick: null, endReason: null, eventCount: null, exitCode: null },
      ios_wkwebview: { status: 'NOT_RUN', startHash: null, tick30: null, tick60: null, endHash: null, endTick: null, endReason: null, eventCount: null, exitCode: null },
    },
  };
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, `${JSON.stringify(matrix, null, 2)}\n`);
  console.log(JSON.stringify({ status: 'PASS', out, node: { startHash, tick30, tick60, endHash } }, null, 2));
} finally {
  api.close();
}
