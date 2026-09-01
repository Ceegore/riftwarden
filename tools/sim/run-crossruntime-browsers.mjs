#!/usr/bin/env node
import { chromium, firefox, webkit } from '@playwright/test';
import { build } from 'vite';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadKernel, runNodeReferenceTrace, runNodePhase15ReferenceTrace, runNodePhase16ReferenceTrace, runNodePhase17ReferenceTrace, runNodePhase17JLReferenceTrace } from './lib/kernel-loader.mjs';
import { runNodePhase18ReferenceTrace } from './lib/phase18-trace.mjs';
import { runNodePhase19ReferenceTrace } from './lib/phase19-trace.mjs';
import { runNodePhase20ReferenceTrace } from './lib/phase20-trace.mjs';
import { runNodePhase21ReferenceTrace } from './lib/phase21-trace.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..', '..');
const out = resolve(process.argv[2] ?? resolve(root, 'docs', 'reports', 'phase14-crossruntime.json'));

const DESKTOP_BROWSERS = {
  chromium: { launch: chromium.launch.bind(chromium), key: 'chromium' },
  firefox: { launch: firefox.launch.bind(firefox), key: 'firefox' },
  webkit: { launch: webkit.launch.bind(webkit), key: 'webkit' },
};

const api = await loadKernel();
const fixtureDir = mkdtempSync(join(tmpdir(), 'p14-fixture-'));

try {
  const node = runNodeReferenceTrace(api);
  const pinned = JSON.parse(readFileSync(join(root, 'tests', 'sim', 'fixtures', 'reference-traces.json'), 'utf8'));
  const expected30 = pinned.checkpoints.find((c) => c.tick === 30)?.checksum;
  const expected60 = pinned.checkpoints.find((c) => c.tick === 60)?.checksum;
  if (node.tick30 !== expected30 || node.tick60 !== expected60 || node.endHash !== pinned.finalSnapshotChecksum) {
    console.error(JSON.stringify({ status: 'FAIL', reason: 'node-drift-vs-pinned-fixture', node }, null, 2));
    process.exit(1);
  }

  // Phase 15 reference: same 60-tick window, active movement systems.
  const node15 = runNodePhase15ReferenceTrace(api);
  const pinned15 = JSON.parse(readFileSync(join(root, 'tests', 'sim', 'fixtures', 'reference-traces-phase15.json'), 'utf8'));
  const expected15_30 = pinned15.checkpoints.find((c) => c.tick === 30)?.checksum;
  const expected15_60 = pinned15.checkpoints.find((c) => c.tick === 60)?.checksum;
  if (node15.tick30 !== expected15_30 || node15.tick60 !== expected15_60 || node15.endHash !== pinned15.finalSnapshotChecksum) {
    console.error(JSON.stringify({ status: 'FAIL', reason: 'node15-drift-vs-pinned-fixture', node15 }, null, 2));
    process.exit(1);
  }

  // Phase 17 reference: same 60-tick window, basic-attack + projectile + damage.
  const node17 = runNodePhase17ReferenceTrace(api);
  const pinned17 = JSON.parse(readFileSync(join(root, 'tests', 'sim', 'fixtures', 'reference-traces-phase17.json'), 'utf8'));
  const expected17_30 = pinned17.checkpoints.find((c) => c.tick === 30)?.checksum;
  const expected17_60 = pinned17.checkpoints.find((c) => c.tick === 60)?.checksum;
  if (node17.tick30 !== expected17_30 || node17.tick60 !== expected17_60 || node17.endHash !== pinned17.finalSnapshotChecksum) {
    console.error(JSON.stringify({ status: 'FAIL', reason: 'node17-drift-vs-pinned-fixture', node17 }, null, 2));
    process.exit(1);
  }

  // Phase 17 stage J/L reference: seeded at 2680 with lethal combat, runs to
  // the terminal outcome through defeat resolution and the collapse window.
  const node17jl = runNodePhase17JLReferenceTrace(api);
  const pinned17jl = JSON.parse(readFileSync(join(root, 'tests', 'sim', 'fixtures', 'reference-traces-phase17jl.json'), 'utf8'));
  const expected17jl_2700 = pinned17jl.checkpoints.find((c) => c.tick === 2700)?.checksum;
  const expected17jl_2880 = pinned17jl.checkpoints.find((c) => c.tick === 2880)?.checksum;
  if (node17jl.tick30 !== expected17jl_2700 || node17jl.tick60 !== expected17jl_2880 || node17jl.endHash !== pinned17jl.finalSnapshotChecksum) {
    console.error(JSON.stringify({ status: 'FAIL', reason: 'node17jl-drift-vs-pinned-fixture', node17jl }, null, 2));
    process.exit(1);
  }

  // Phase 18 reference: same 60-tick window, status periodic/expiry active.
  const node18 = runNodePhase18ReferenceTrace(api);
  const pinned18 = JSON.parse(readFileSync(join(root, 'tests', 'sim', 'fixtures', 'reference-traces-phase18.json'), 'utf8'));
  const expected18_30 = pinned18.checkpoints.find((c) => c.tick === 30)?.checksum;
  const expected18_60 = pinned18.checkpoints.find((c) => c.tick === 60)?.checksum;
  if (node18.tick30 !== expected18_30 || node18.tick60 !== expected18_60 || node18.endHash !== pinned18.finalSnapshotChecksum) {
    console.error(JSON.stringify({ status: 'FAIL', reason: 'node18-drift-vs-pinned-fixture', node18 }, null, 2));
    process.exit(1);
  }

  // Phase 16 reference: same 60-tick window, active targeting + attack-prep.
  const node16 = runNodePhase16ReferenceTrace(api);
  const pinned16 = JSON.parse(readFileSync(join(root, 'tests', 'sim', 'fixtures', 'reference-traces-phase16.json'), 'utf8'));
  const expected16_30 = pinned16.checkpoints.find((c) => c.tick === 30)?.checksum;
  const expected16_60 = pinned16.checkpoints.find((c) => c.tick === 60)?.checksum;
  if (node16.tick30 !== expected16_30 || node16.tick60 !== expected16_60 || node16.endHash !== pinned16.finalSnapshotChecksum) {
    console.error(JSON.stringify({ status: 'FAIL', reason: 'node16-drift-vs-pinned-fixture', node16 }, null, 2));
    process.exit(1);
  }

  // Phase 19 reference: ability trigger/effect trace.
  const node19 = runNodePhase19ReferenceTrace(api);
  const pinned19 = JSON.parse(readFileSync(join(root, 'tests', 'sim', 'fixtures', 'reference-traces-phase19.json'), 'utf8'));
  const expected19_30 = pinned19.checkpoints.find((c) => c.tick === 30)?.checksum;
  const expected19_60 = pinned19.checkpoints.find((c) => c.tick === 60)?.checksum;
  if (node19.tick30 !== expected19_30 || node19.tick60 !== expected19_60 || node19.endHash !== pinned19.finalSnapshotChecksum) {
    console.error(JSON.stringify({ status: 'FAIL', reason: 'node19-drift-vs-pinned-fixture', node19 }, null, 2));
    process.exit(1);
  }

  // Phase 20 reference: synergy/summon/expiry trace.
  const node20 = runNodePhase20ReferenceTrace(api);
  const pinned20 = JSON.parse(readFileSync(join(root, 'tests', 'sim', 'fixtures', 'reference-traces-phase20.json'), 'utf8'));
  const expected20_30 = pinned20.checkpoints.find((c) => c.tick === 30)?.checksum;
  const expected20_60 = pinned20.checkpoints.find((c) => c.tick === 60)?.checksum;
  if (node20.tick30 !== expected20_30 || node20.tick60 !== expected20_60 || node20.endHash !== pinned20.finalSnapshotChecksum) {
    console.error(JSON.stringify({ status: 'FAIL', reason: 'node20-drift-vs-pinned-fixture', node20 }, null, 2));
    process.exit(1);
  }

  // Phase 21 reference: boss/objective/wave/hazard trace.
  const node21 = runNodePhase21ReferenceTrace(api);
  const pinned21 = JSON.parse(readFileSync(join(root, 'tests', 'sim', 'fixtures', 'reference-traces-phase21.json'), 'utf8'));
  const expected21_30 = pinned21.checkpoints.find((c) => c.tick === 30)?.checksum;
  const expected21_60 = pinned21.checkpoints.find((c) => c.tick === 60)?.checksum;
  if (node21.tick30 !== expected21_30 || node21.tick60 !== expected21_60 || node21.endHash !== pinned21.finalSnapshotChecksum) {
    console.error(JSON.stringify({ status: 'FAIL', reason: 'node21-drift-vs-pinned-fixture', node21 }, null, 2));
    process.exit(1);
  }

  // Build the browser oracle as a self-contained IIFE so it needs no module
  // server or ESM loader inside the page.
  const buildResult = await build({
    configFile: false,
    logLevel: 'error',
    build: {
      outDir: fixtureDir,
      emptyOutDir: true,
      minify: false,
      target: 'es2020',
      rollupOptions: {
        input: resolve(root, 'tools/sim/lib/browser-fixture.ts'),
        output: { format: 'iife', entryFileNames: 'fixture.js' },
      },
    },
  });
  const chunk = (Array.isArray(buildResult) ? buildResult[0] : buildResult).output.find((o) => o.type === 'chunk');
  const fixtureJs = join(fixtureDir, chunk.fileName);

  const runtimes = {
    node: { status: 'REFERENCE', version: process.version, host: process.platform, ...pick(node) },
  };
  const runtimes15 = {
    node: { status: 'REFERENCE', version: process.version, host: process.platform, ...pick(node15) },
  };
  const runtimes16 = {
    node: { status: 'REFERENCE', version: process.version, host: process.platform, ...pick(node16) },
  };
  const runtimes17 = {
    node: { status: 'REFERENCE', version: process.version, host: process.platform, ...pick(node17) },
  };
  const runtimes17jl = {
    node: { status: 'REFERENCE', version: process.version, host: process.platform, ...pick(node17jl), terminal: node17jl.terminal },
  };
  const runtimes18 = {
    node: { status: 'REFERENCE', version: process.version, host: process.platform, ...pick(node18) },
  };
  const runtimes19 = {
    node: { status: 'REFERENCE', version: process.version, host: process.platform, ...pick(node19) },
  };
  const runtimes20 = {
    node: { status: 'REFERENCE', version: process.version, host: process.platform, ...pick(node20) },
  };
  const runtimes21 = {
    node: { status: 'REFERENCE', version: process.version, host: process.platform, ...pick(node21) },
  };
  let browserFailures = 0;

  for (const [name, { launch }] of Object.entries(DESKTOP_BROWSERS)) {
    const browser = await launch();
    try {
      const version = browser.version();
      const page = await browser.newPage({ locale: 'en-US', timezoneId: 'UTC' });
      await page.setContent('<html><body></body></html>');
      await page.addScriptTag({ path: fixtureJs });
      const result = await page.evaluate(() => globalThis.__P14_CROSSRUNTIME__);
      const result15 = await page.evaluate(() => globalThis.__P15_CROSSRUNTIME__);
      const result16 = await page.evaluate(() => globalThis.__P16_CROSSRUNTIME__);
      const result17 = await page.evaluate(() => globalThis.__P17_CROSSRUNTIME__);
      const result17jl = await page.evaluate(() => globalThis.__P17JL_CROSSRUNTIME__);
      const result18 = await page.evaluate(() => globalThis.__P18_CROSSRUNTIME__);
      const result19 = await page.evaluate(() => globalThis.__P19_CROSSRUNTIME__);
      const result20 = await page.evaluate(() => globalThis.__P20_CROSSRUNTIME__);
      const result21 = await page.evaluate(() => globalThis.__P21_CROSSRUNTIME__);
      const drift = driftField(result, node);
      const drift15 = driftField(result15, node15);
      const drift16 = driftField(result16, node16);
      const drift17 = driftField(result17, node17);
      const drift17jl = driftField(result17jl, node17jl);
      const drift18 = driftField(result18, node18);
      const drift19 = driftField(result19, node19);
      const drift20 = driftField(result20, node20);
      const drift21 = driftField(result21, node21);
      const ok = drift === null && drift15 === null && drift16 === null && drift17 === null && drift17jl === null && drift18 === null && drift19 === null && drift20 === null && drift21 === null;
      if (!ok) browserFailures++;
      runtimes[name] = {
        status: ok ? 'PASS' : 'FAIL',
        version,
        host: `${process.platform} (Playwright)`,
        startHash: result.startHash,
        tick30: result.tick30,
        tick60: result.tick60,
        endHash: result.endHash,
        endTick: result.endTick,
        endReason: result.endReason,
        eventCount: result.eventCount,
        exitCode: ok ? 0 : 1,
        ...(drift === null ? {} : { drift }),
      };
      runtimes15[name] = {
        status: drift15 === null ? 'PASS' : 'FAIL',
        version,
        host: `${process.platform} (Playwright)`,
        startHash: result15.startHash,
        tick30: result15.tick30,
        tick60: result15.tick60,
        endHash: result15.endHash,
        endTick: result15.endTick,
        endReason: result15.endReason,
        eventCount: result15.eventCount,
        exitCode: drift15 === null ? 0 : 1,
        ...(drift15 === null ? {} : { drift: drift15 }),
      };
      runtimes16[name] = {
        status: drift16 === null ? 'PASS' : 'FAIL',
        version,
        host: `${process.platform} (Playwright)`,
        startHash: result16.startHash,
        tick30: result16.tick30,
        tick60: result16.tick60,
        endHash: result16.endHash,
        endTick: result16.endTick,
        endReason: result16.endReason,
        eventCount: result16.eventCount,
        exitCode: drift16 === null ? 0 : 1,
        ...(drift16 === null ? {} : { drift: drift16 }),
      };
      runtimes17[name] = {
        status: drift17 === null ? 'PASS' : 'FAIL',
        version,
        host: `${process.platform} (Playwright)`,
        startHash: result17.startHash,
        tick30: result17.tick30,
        tick60: result17.tick60,
        endHash: result17.endHash,
        endTick: result17.endTick,
        endReason: result17.endReason,
        eventCount: result17.eventCount,
        exitCode: drift17 === null ? 0 : 1,
        ...(drift17 === null ? {} : { drift: drift17 }),
      };
      runtimes17jl[name] = {
        status: drift17jl === null ? 'PASS' : 'FAIL',
        version,
        host: `${process.platform} (Playwright)`,
        startHash: result17jl.startHash,
        tick30: result17jl.tick30,
        tick60: result17jl.tick60,
        endHash: result17jl.endHash,
        endTick: result17jl.endTick,
        endReason: result17jl.endReason,
        eventCount: result17jl.eventCount,
        terminal: result17jl.terminal,
        exitCode: drift17jl === null ? 0 : 1,
        ...(drift17jl === null ? {} : { drift: drift17jl }),
      };
      runtimes18[name] = {
        status: drift18 === null ? 'PASS' : 'FAIL',
        version,
        host: `${process.platform} (Playwright)`,
        startHash: result18.startHash,
        tick30: result18.tick30,
        tick60: result18.tick60,
        endHash: result18.endHash,
        endTick: result18.endTick,
        endReason: result18.endReason,
        eventCount: result18.eventCount,
        exitCode: drift18 === null ? 0 : 1,
        ...(drift18 === null ? {} : { drift: drift18 }),
      };
      runtimes19[name] = {
        status: drift19 === null ? 'PASS' : 'FAIL',
        version,
        host: `${process.platform} (Playwright)`,
        startHash: result19.startHash,
        tick30: result19.tick30,
        tick60: result19.tick60,
        endHash: result19.endHash,
        endTick: result19.endTick,
        endReason: result19.endReason,
        eventCount: result19.eventCount,
        exitCode: drift19 === null ? 0 : 1,
        ...(drift19 === null ? {} : { drift: drift19 }),
      };
      runtimes20[name] = {
        status: drift20 === null ? 'PASS' : 'FAIL',
        version,
        host: `${process.platform} (Playwright)`,
        startHash: result20.startHash,
        tick30: result20.tick30,
        tick60: result20.tick60,
        endHash: result20.endHash,
        endTick: result20.endTick,
        endReason: result20.endReason,
        eventCount: result20.eventCount,
        exitCode: drift20 === null ? 0 : 1,
        ...(drift20 === null ? {} : { drift: drift20 }),
      };
      runtimes21[name] = {
        status: drift21 === null ? 'PASS' : 'FAIL',
        version,
        host: `${process.platform} (Playwright)`,
        startHash: result21.startHash,
        tick30: result21.tick30,
        tick60: result21.tick60,
        endHash: result21.endHash,
        endTick: result21.endTick,
        endReason: result21.endReason,
        eventCount: result21.eventCount,
        exitCode: drift21 === null ? 0 : 1,
        ...(drift21 === null ? {} : { drift: drift21 }),
      };
    } finally {
      await browser.close();
    }
  }

  for (const key of ['android_webview', 'ios_wkwebview']) {
    const notRun = { status: 'NOT_RUN', version: null, host: null, startHash: null, tick30: null, tick60: null, endHash: null, endTick: null, endReason: null, eventCount: null, exitCode: null };
    runtimes[key] = notRun;
    runtimes15[key] = notRun;
    runtimes16[key] = notRun;
    runtimes17[key] = notRun;
    runtimes17jl[key] = notRun;
    runtimes18[key] = notRun;
    runtimes19[key] = notRun;
    runtimes20[key] = notRun;
    runtimes21[key] = notRun;
  }

  const matrix = {
    schemaVersion: 2,
    phase: 14,
    gate: 'G14',
    sourceRevision: process.env.SOURCE_REVISION ?? null,
    fixture: 'tests/sim/fixtures/reference-traces.json',
    status: 'PARTIAL',
    note: 'Node and the three desktop browser engines are hash-identical to the pinned reference trace for both the Phase 14 noop kernel and the Phase 15 active movement kernel. Android/iOS WebViews remain NOT_RUN until executed on device hardware.',
    runtimes,
    phase15: {
      phase: 15,
      gate: 'G15',
      fixture: 'tests/sim/fixtures/reference-traces-phase15.json',
      status: 'PARTIAL',
      note: 'Phase 15 movement trace: desktop engines hash-identical to the Node reference and the pinned fixture; WebViews NOT_RUN.',
      runtimes: runtimes15,
    },
    phase16: {
      phase: 16,
      gate: 'G16',
      fixture: 'tests/sim/fixtures/reference-traces-phase16.json',
      status: 'PARTIAL',
      note: 'Phase 16 targeting/attack-prep trace: desktop engines hash-identical to the Node reference and the pinned fixture; WebViews NOT_RUN.',
      runtimes: runtimes16,
    },
    phase17: {
      phase: 17,
      gate: 'G17',
      fixture: 'tests/sim/fixtures/reference-traces-phase17.json',
      status: 'PARTIAL',
      note: 'Phase 17 basic-attack/projectile/damage trace: desktop engines hash-identical to the Node reference and the pinned fixture; WebViews NOT_RUN.',
      runtimes: runtimes17,
    },
    phase17jl: {
      phase: 17,
      gate: 'G17',
      fixture: 'tests/sim/fixtures/reference-traces-phase17jl.json',
      status: 'PARTIAL',
      note: 'Phase 17 stage J/L trace (defeat + collapse + battle-end): desktop engines hash-identical to the Node reference and the pinned fixture; WebViews NOT_RUN.',
      runtimes: runtimes17jl,
    },
    phase18: {
      phase: 18,
      gate: 'G18',
      fixture: 'tests/sim/fixtures/reference-traces-phase18.json',
      status: 'PARTIAL',
      note: 'Phase 18 status periodic/expiry trace (burn/poison/regeneration + EffectTick/EffectRemoved): desktop engines hash-identical to the Node reference and the pinned fixture; WebViews NOT_RUN.',
      runtimes: runtimes18,
    },
    phase19: {
      phase: 19,
      gate: 'G19',
      fixture: 'tests/sim/fixtures/reference-traces-phase19.json',
      status: 'PARTIAL',
      note: 'Phase 19 ability trigger/effect trace (fireball tick_interval + nearest-target damage): desktop engines hash-identical to the Node reference and the pinned fixture; WebViews NOT_RUN.',
      runtimes: runtimes19,
    },
    phase20: {
      phase: 20,
      gate: 'G20',
      fixture: 'tests/sim/fixtures/reference-traces-phase20.json',
      status: 'PARTIAL',
      note: 'Phase 20 synergy/summon/expiry trace (synergy tier commit + registry summon commit): desktop engines hash-identical to the Node reference and the pinned fixture; WebViews NOT_RUN.',
      runtimes: runtimes20,
    },
    phase21: {
      phase: 21,
      gate: 'G21',
      fixture: 'tests/sim/fixtures/reference-traces-phase21.json',
      status: 'PARTIAL',
      note: 'Phase 21 boss/objective/wave/hazard trace (boss transition + objective resolution + reinforcement wave + hazard lifecycle): desktop engines hash-identical to the Node reference and the pinned fixture; WebViews NOT_RUN.',
      runtimes: runtimes21,
    },
  };
  writeFileSync(out, `${JSON.stringify(matrix, null, 2)}\n`);
  console.log(JSON.stringify(matrix, null, 2));
  if (browserFailures > 0) process.exit(1);
} finally {
  api.close();
  rmSync(fixtureDir, { recursive: true, force: true });
}

function pick(node) {
  return { startHash: node.startHash, tick30: node.tick30, tick60: node.tick60, endHash: node.endHash, endTick: node.endTick, endReason: node.endReason, eventCount: node.eventCount, exitCode: 0 };
}

function driftField(result, node) {
  for (const key of ['startHash', 'tick30', 'tick60', 'endHash', 'endTick', 'eventCount']) {
    if (result[key] !== node[key]) return { field: key, expected: node[key], actual: result[key] };
  }
  return null;
}
