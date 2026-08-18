#!/usr/bin/env node
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadKernel, runNodeReferenceTrace, runNodePhase15ReferenceTrace, runNodePhase16ReferenceTrace, runNodePhase17ReferenceTrace, runNodePhase17JLReferenceTrace } from './lib/kernel-loader.mjs';
import { runNodePhase18ReferenceTrace } from './lib/phase18-trace.mjs';

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

  const node15 = runNodePhase15ReferenceTrace(api);
  const fixture15 = JSON.parse(readFileSync(resolve(root, 'tests', 'sim', 'fixtures', 'reference-traces-phase15.json'), 'utf8'));
  const expected15_30 = fixture15.checkpoints.find((c) => c.tick === 30)?.checksum;
  const expected15_60 = fixture15.checkpoints.find((c) => c.tick === 60)?.checksum;
  if (node15.tick30 !== expected15_30 || node15.tick60 !== expected15_60 || node15.endHash !== fixture15.finalSnapshotChecksum) {
    console.error(JSON.stringify({ status: 'FAIL', reason: 'node15-drift-vs-pinned-fixture', ...node15, expected30: expected15_30, expected60: expected15_60, expectedFinal: fixture15.finalSnapshotChecksum }, null, 2));
    process.exit(1);
  }

  const node16 = runNodePhase16ReferenceTrace(api);
  const fixture16 = JSON.parse(readFileSync(resolve(root, 'tests', 'sim', 'fixtures', 'reference-traces-phase16.json'), 'utf8'));
  const expected16_30 = fixture16.checkpoints.find((c) => c.tick === 30)?.checksum;
  const expected16_60 = fixture16.checkpoints.find((c) => c.tick === 60)?.checksum;
  if (node16.tick30 !== expected16_30 || node16.tick60 !== expected16_60 || node16.endHash !== fixture16.finalSnapshotChecksum) {
    console.error(JSON.stringify({ status: 'FAIL', reason: 'node16-drift-vs-pinned-fixture', ...node16, expected30: expected16_30, expected60: expected16_60, expectedFinal: fixture16.finalSnapshotChecksum }, null, 2));
    process.exit(1);
  }

  const node17 = runNodePhase17ReferenceTrace(api);
  const fixture17 = JSON.parse(readFileSync(resolve(root, 'tests', 'sim', 'fixtures', 'reference-traces-phase17.json'), 'utf8'));
  const expected17_30 = fixture17.checkpoints.find((c) => c.tick === 30)?.checksum;
  const expected17_60 = fixture17.checkpoints.find((c) => c.tick === 60)?.checksum;
  if (node17.tick30 !== expected17_30 || node17.tick60 !== expected17_60 || node17.endHash !== fixture17.finalSnapshotChecksum) {
    console.error(JSON.stringify({ status: 'FAIL', reason: 'node17-drift-vs-pinned-fixture', ...node17, expected30: expected17_30, expected60: expected17_60, expectedFinal: fixture17.finalSnapshotChecksum }, null, 2));
    process.exit(1);
  }

  const node17jl = runNodePhase17JLReferenceTrace(api);
  const fixture17jl = JSON.parse(readFileSync(resolve(root, 'tests', 'sim', 'fixtures', 'reference-traces-phase17jl.json'), 'utf8'));
  const expected17jl_2700 = fixture17jl.checkpoints.find((c) => c.tick === 2700)?.checksum;
  const expected17jl_2880 = fixture17jl.checkpoints.find((c) => c.tick === 2880)?.checksum;
  if (node17jl.tick30 !== expected17jl_2700 || node17jl.tick60 !== expected17jl_2880 || node17jl.endHash !== fixture17jl.finalSnapshotChecksum) {
    console.error(JSON.stringify({ status: 'FAIL', reason: 'node17jl-drift-vs-pinned-fixture', ...node17jl, expected2700: expected17jl_2700, expected2880: expected17jl_2880, expectedFinal: fixture17jl.finalSnapshotChecksum }, null, 2));
    process.exit(1);
  }

  const node18 = runNodePhase18ReferenceTrace(api);
  const fixture18 = JSON.parse(readFileSync(resolve(root, 'tests', 'sim', 'fixtures', 'reference-traces-phase18.json'), 'utf8'));
  const expected18_30 = fixture18.checkpoints.find((c) => c.tick === 30)?.checksum;
  const expected18_60 = fixture18.checkpoints.find((c) => c.tick === 60)?.checksum;
  if (node18.tick30 !== expected18_30 || node18.tick60 !== expected18_60 || node18.endHash !== fixture18.finalSnapshotChecksum) {
    console.error(JSON.stringify({ status: 'FAIL', reason: 'node18-drift-vs-pinned-fixture', ...node18, expected30: expected18_30, expected60: expected18_60, expectedFinal: fixture18.finalSnapshotChecksum }, null, 2));
    process.exit(1);
  }
  const notRun = (runtimes) =>
    Object.fromEntries(
      ['chromium', 'firefox', 'webkit', 'android_webview', 'ios_wkwebview'].map((key) => [key, { status: 'NOT_RUN', startHash: null, tick30: null, tick60: null, endHash: null, endTick: null, endReason: null, eventCount: null, exitCode: null }]),
    );
  const matrix = {
    schemaVersion: 2,
    phase: 14,
    gate: 'G14',
    sourceRevision: process.env.SOURCE_REVISION ?? null,
    fixture: 'tests/sim/fixtures/reference-traces.json',
    status: 'PARTIAL',
    note: 'Node is the tooling reference, not a standalone platform proof. Browser/device rows remain NOT_RUN until the operator executes the fixture bytes on each runtime.',
    runtimes: {
      node: { status: 'REFERENCE', version: process.version, host: process.platform, startHash: node.startHash, tick30: node.tick30, tick60: node.tick60, endHash: node.endHash, endTick: node.endTick, endReason: node.endReason, eventCount: node.eventCount, exitCode: 0 },
      ...notRun(),
    },
    phase15: {
      phase: 15,
      gate: 'G15',
      fixture: 'tests/sim/fixtures/reference-traces-phase15.json',
      status: 'PARTIAL',
      note: 'Phase 15 movement trace Node reference; browser/device rows NOT_RUN.',
      runtimes: {
        node: { status: 'REFERENCE', version: process.version, host: process.platform, startHash: node15.startHash, tick30: node15.tick30, tick60: node15.tick60, endHash: node15.endHash, endTick: node15.endTick, endReason: node15.endReason, eventCount: node15.eventCount, exitCode: 0 },
        ...notRun(),
      },
    },
    phase16: {
      phase: 16,
      gate: 'G16',
      fixture: 'tests/sim/fixtures/reference-traces-phase16.json',
      status: 'PARTIAL',
      note: 'Phase 16 targeting/attack-prep trace Node reference; browser/device rows NOT_RUN.',
      runtimes: {
        node: { status: 'REFERENCE', version: process.version, host: process.platform, startHash: node16.startHash, tick30: node16.tick30, tick60: node16.tick60, endHash: node16.endHash, endTick: node16.endTick, endReason: node16.endReason, eventCount: node16.eventCount, exitCode: 0 },
        ...notRun(),
      },
    },
    phase17: {
      phase: 17,
      gate: 'G17',
      fixture: 'tests/sim/fixtures/reference-traces-phase17.json',
      status: 'PARTIAL',
      note: 'Phase 17 basic-attack/projectile/damage trace Node reference; browser/device rows NOT_RUN.',
      runtimes: {
        node: { status: 'REFERENCE', version: process.version, host: process.platform, startHash: node17.startHash, tick30: node17.tick30, tick60: node17.tick60, endHash: node17.endHash, endTick: node17.endTick, endReason: node17.endReason, eventCount: node17.eventCount, exitCode: 0 },
        ...notRun(),
      },
    },
    phase17jl: {
      phase: 17,
      gate: 'G17',
      fixture: 'tests/sim/fixtures/reference-traces-phase17jl.json',
      status: 'PARTIAL',
      note: 'Phase 17 stage J/L trace (defeat resolution + rift-collapse/battle-end to terminal outcome) Node reference; browser/device rows NOT_RUN.',
      runtimes: {
        node: { status: 'REFERENCE', version: process.version, host: process.platform, startHash: node17jl.startHash, tick30: node17jl.tick30, tick60: node17jl.tick60, endHash: node17jl.endHash, endTick: node17jl.endTick, endReason: node17jl.endReason, eventCount: node17jl.eventCount, terminal: node17jl.terminal, exitCode: 0 },
        ...notRun(),
      },
    },
    phase18: {
      phase: 18,
      gate: 'G18',
      fixture: 'tests/sim/fixtures/reference-traces-phase18.json',
      status: 'PARTIAL',
      note: 'Phase 18 status periodic/expiry trace (burn/poison/regeneration + EffectTick/EffectRemoved) Node reference; browser/device rows NOT_RUN.',
      runtimes: {
        node: { status: 'REFERENCE', version: process.version, host: process.platform, startHash: node18.startHash, tick30: node18.tick30, tick60: node18.tick60, endHash: node18.endHash, endTick: node18.endTick, endReason: node18.endReason, eventCount: node18.eventCount, exitCode: 0 },
        ...notRun(),
      },
    },
  };
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, `${JSON.stringify(matrix, null, 2)}\n`);
  console.log(JSON.stringify({ status: 'PASS', out, node: { startHash: node.startHash, tick30: node.tick30, tick60: node.tick60, endHash: node.endHash } }, null, 2));
} finally {
  api.close();
}
