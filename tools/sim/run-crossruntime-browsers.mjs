#!/usr/bin/env node
import { chromium, firefox, webkit } from '@playwright/test';
import { build } from 'vite';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadKernel, runNodeReferenceTrace } from './lib/kernel-loader.mjs';

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
  let browserFailures = 0;

  for (const [name, { launch }] of Object.entries(DESKTOP_BROWSERS)) {
    const browser = await launch();
    try {
      const version = browser.version();
      const page = await browser.newPage({ locale: 'en-US', timezoneId: 'UTC' });
      await page.setContent('<html><body></body></html>');
      await page.addScriptTag({ path: fixtureJs });
      const result = await page.evaluate(() => globalThis.__P14_CROSSRUNTIME__);
      const drift = driftField(result, node);
      const ok = drift === null;
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
    } finally {
      await browser.close();
    }
  }

  for (const key of ['android_webview', 'ios_wkwebview']) {
    runtimes[key] = { status: 'NOT_RUN', version: null, host: null, startHash: null, tick30: null, tick60: null, endHash: null, endTick: null, endReason: null, eventCount: null, exitCode: null };
  }

  const matrix = {
    schemaVersion: 1,
    phase: 14,
    gate: 'G14',
    sourceRevision: process.env.SOURCE_REVISION ?? null,
    fixture: 'tests/sim/fixtures/reference-traces.json',
    status: 'PARTIAL',
    note: 'Node and the three desktop browser engines are hash-identical to the pinned reference trace. Android/iOS WebViews remain NOT_RUN until executed on device hardware.',
    runtimes,
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
