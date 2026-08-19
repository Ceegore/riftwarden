#!/usr/bin/env node
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadKernel, runNodeReferenceTrace, runNodePhase15ReferenceTrace, runNodePhase16ReferenceTrace, runNodePhase17ReferenceTrace, runNodePhase17JLReferenceTrace } from './lib/kernel-loader.mjs';
import { runNodePhase18ReferenceTrace } from './lib/phase18-trace.mjs';
import { runNodePhase19ReferenceTrace } from './lib/phase19-trace.mjs';
import { runNodePhase20ReferenceTrace } from './lib/phase20-trace.mjs';
import { runNodePhase21ReferenceTrace } from './lib/phase21-trace.mjs';

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

  const node19 = runNodePhase19ReferenceTrace(api);
  const fixture19 = JSON.parse(readFileSync(resolve(root, 'tests', 'sim', 'fixtures', 'reference-traces-phase19.json'), 'utf8'));
  const expected19_30 = fixture19.checkpoints.find((c) => c.tick === 30)?.checksum;
  const expected19_60 = fixture19.checkpoints.find((c) => c.tick === 60)?.checksum;
  if (node19.tick30 !== expected19_30 || node19.tick60 !== expected19_60 || node19.endHash !== fixture19.finalSnapshotChecksum) {
    console.error(JSON.stringify({ status: 'FAIL', reason: 'node19-drift-vs-pinned-fixture', ...node19, expected30: expected19_30, expected60: expected19_60, expectedFinal: fixture19.finalSnapshotChecksum }, null, 2));
    process.exit(1);
  }

  const node20 = runNodePhase20ReferenceTrace(api);
  const fixture20 = JSON.parse(readFileSync(resolve(root, 'tests', 'sim', 'fixtures', 'reference-traces-phase20.json'), 'utf8'));
  const expected20_30 = fixture20.checkpoints.find((c) => c.tick === 30)?.checksum;
  const expected20_60 = fixture20.checkpoints.find((c) => c.tick === 60)?.checksum;
  if (node20.tick30 !== expected20_30 || node20.tick60 !== expected20_60 || node20.endHash !== fixture20.finalSnapshotChecksum) {
    console.error(JSON.stringify({ status: 'FAIL', reason: 'node20-drift-vs-pinned-fixture', ...node20, expected30: expected20_30, expected60: expected20_60, expectedFinal: fixture20.finalSnapshotChecksum }, null, 2));
    process.exit(1);
  }

  const node21 = runNodePhase21ReferenceTrace(api);
  const fixture21 = JSON.parse(readFileSync(resolve(root, 'tests', 'sim', 'fixtures', 'reference-traces-phase21.json'), 'utf8'));
  const expected21_30 = fixture21.checkpoints.find((c) => c.tick === 30)?.checksum;
  const expected21_60 = fixture21.checkpoints.find((c) => c.tick === 60)?.checksum;
  if (node21.tick30 !== expected21_30 || node21.tick60 !== expected21_60 || node21.endHash !== fixture21.finalSnapshotChecksum) {
    console.error(JSON.stringify({ status: 'FAIL', reason: 'node21-drift-vs-pinned-fixture', ...node21, expected30: expected21_30, expected60: expected21_60, expectedFinal: fixture21.finalSnapshotChecksum }, null, 2));
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
    phase19: {
      phase: 19,
      gate: 'G19',
      fixture: 'tests/sim/fixtures/reference-traces-phase19.json',
      status: 'PARTIAL',
      note: 'Phase 19 ability trigger/target/cast/effect trace (tick_interval fireball + Ability* events) Node reference; browser/device rows NOT_RUN.',
      runtimes: {
        node: { status: 'REFERENCE', version: process.version, host: process.platform, startHash: node19.startHash, tick30: node19.tick30, tick60: node19.tick60, endHash: node19.endHash, endTick: node19.endTick, endReason: node19.endReason, eventCount: node19.eventCount, exitCode: 0 },
        ...notRun(),
      },
    },
    phase20: {
      phase: 20,
      gate: 'G20',
      fixture: 'tests/sim/fixtures/reference-traces-phase20.json',
      status: 'PARTIAL',
      note: 'Phase 20 synergy commit + summon/expiry trace (Spawned/Removed events) Node reference; browser/device rows NOT_RUN.',
      runtimes: {
        node: { status: 'REFERENCE', version: process.version, host: process.platform, startHash: node20.startHash, tick30: node20.tick30, tick60: node20.tick60, endHash: node20.endHash, endTick: node20.endTick, endReason: node20.endReason, eventCount: node20.eventCount, exitCode: 0 },
        ...notRun(),
      },
    },
    phase21: {
      phase: 21,
      gate: 'G21',
      fixture: 'tests/sim/fixtures/reference-traces-phase21.json',
      status: 'PARTIAL',
      note: 'Phase 21 boss transition + objective/wave/hazard trace (PhaseTransitionPlanned/BossTelegraphStarted/BossPhaseStarted/BossPhaseCompleted events) Node reference; browser/device rows NOT_RUN.',
      runtimes: {
        node: { status: 'REFERENCE', version: process.version, host: process.platform, startHash: node21.startHash, tick30: node21.tick30, tick60: node21.tick60, endHash: node21.endHash, endTick: node21.endTick, endReason: node21.endReason, eventCount: node21.eventCount, exitCode: 0 },
        ...notRun(),
      },
    },
  };
  // Preserve operator-set browser/device columns (PASS/FAIL) across Node-only
  // regenerations: this tool authors the Node reference rows, never the
  // operator's device evidence.
  let previous = null;
  try { previous = JSON.parse(readFileSync(out, 'utf8')); } catch { previous = null; }
  if (previous) {
    const preserveRuntimes = (prevSection, nextSection) => {
      if (!prevSection || !nextSection) return;
      if (typeof prevSection.note === 'string') nextSection.note = prevSection.note;
      if (!prevSection.runtimes || !nextSection.runtimes) return;
      for (const [key, value] of Object.entries(prevSection.runtimes)) {
        if (key !== 'node' && value && typeof value === 'object') nextSection.runtimes[key] = value;
      }
    };
    preserveRuntimes(previous, matrix);
    for (const key of ['phase15', 'phase16', 'phase17', 'phase17jl', 'phase18', 'phase19', 'phase20', 'phase21']) {
      preserveRuntimes(previous[key], matrix[key]);
    }
  }
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, `${JSON.stringify(matrix, null, 2)}\n`);
  console.log(JSON.stringify({ status: 'PASS', out, node: { startHash: node.startHash, tick30: node.tick30, tick60: node.tick60, endHash: node.endHash } }, null, 2));
} finally {
  api.close();
}
