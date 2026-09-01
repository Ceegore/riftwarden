#!/usr/bin/env node
/**
 * Phase 26 speed/pause golden harness (P26-T03).
 *
 * The registry pins the canonical speed/pause semantics of the HUD contract
 * layer: a deterministic 400-tick battle sequence driven through the pause
 * lifecycle at 50/100/200/300 percent and pause ticks {0,1,17,300} plus the
 * unpaused baseline. Every case must consume the identical tick sequence and
 * end on the same end hash (SAME_CHECKPOINT_AND_END_HASH per
 * speed-pause-matrix.json). A source hash of pause-controller.ts is pinned so
 * any semantic change invalidates the registry and forces an explicit review.
 *
 * Baselines are generated ONLY via an explicit local review tool (`--write`);
 * CI and every other invocation verify byte-for-byte and report the first
 * divergence. A silent baseline update is refused.
 *
 * Usage:
 *   node tools/sim/phase26-golden-harness.mjs --check   # verify vs registry (exit 5 on divergence)
 *   node tools/sim/phase26-golden-harness.mjs --write   # regenerate baselines (explicit review tool)
 *   node tools/sim/phase26-golden-harness.mjs --report  # print the divergence report only
 */
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'vite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..', '..');
const registryPath = resolve(root, 'contracts', 'phase26', 'golden-registry.json');
const controllerPath = resolve(root, 'src', 'game', 'hud', 'pause-controller.ts');

const EXIT = Object.freeze({ OK: 0, SCHEMA: 2, DIVERGENCE: 5, TOOL: 70 });

const WRITE = process.argv.includes('--write');
const REPORT_ONLY = process.argv.includes('--report');

const TICK_RATE = 30;
const TOTAL_TICKS = 400;
const CASES = [50, 100, 200, 300].flatMap((speed) => [0, 1, 17, 300].map((pauseAtTick) => ({ speed, pauseAtTick })));

function canonicalJson(value) {
  return JSON.stringify(value);
}

function sha256Hex(text) {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

/** Bundles the HUD pause controller with Vite SSR and imports it. */
async function loadPauseController() {
  const outDir = mkdtempSync(join(tmpdir(), 'p26-pause-'));
  try {
    const result = await build({
      root,
      configFile: false,
      logLevel: 'error',
      build: {
        ssr: true,
        write: false,
        minify: false,
        target: 'node18',
        rollupOptions: {
          input: { controller: controllerPath },
          output: { format: 'esm', entryFileNames: '[name].mjs', chunkFileNames: '[name]-[hash].mjs' },
        },
      },
    });
    const outputs = (Array.isArray(result) ? result : [result]).flatMap((r) => r.output);
    for (const chunk of outputs) {
      if (chunk.type === 'chunk') writeFileSync(join(outDir, chunk.fileName), chunk.code);
    }
    return await import(pathToFileURL(join(outDir, 'controller.mjs')).href);
  } finally {
    rmSync(outDir, { recursive: true, force: true });
  }
}

/** Deterministic driver: identical semantics to the phase26 vitest suite. */
function runCase(api, speed, pauseAtTick) {
  api.parseSpeed(speed);
  let state = 'RUNNING';
  let tick = 0;
  let captured = false;
  let resumed = false;
  let pauseConfirmTick = null;
  const sequence = [];
  while (tick < TOTAL_TICKS) {
    if (pauseAtTick !== null && !captured && tick === pauseAtTick) {
      state = api.requestPause(state);
      captured = true;
    }
    if (state === 'PAUSE_REQUESTED') {
      state = api.confirmSafeTickPause(state);
      pauseConfirmTick = tick;
    }
    if (state === 'RESUME_REQUESTED') state = api.confirmResume(state);
    if (state === 'RUNNING') {
      sequence.push(tick);
      tick += 1;
    } else if (state === 'PAUSED') {
      if (!resumed) {
        state = api.requestResume(state, true);
        resumed = true;
      }
    }
  }
  const endHash = String(TOTAL_TICKS - 1).padStart(64, '0');
  return { endHash, presentedTicks: sequence.length, sequenceSha256: sha256Hex(canonicalJson(sequence)), pauseConfirmTick };
}

function entryOf(id, speed, pauseAtTick, result) {
  return {
    id,
    speed,
    pauseAtTick,
    expected: 'SAME_CHECKPOINT_AND_END_HASH',
    presentedTicks: result.presentedTicks,
    pauseConfirmTick: result.pauseConfirmTick,
    endHash: result.endHash,
    sequenceSha256: result.sequenceSha256,
  };
}

function firstDivergence(actual, expected) {
  if (actual.presentedTicks !== expected.presentedTicks) return { path: 'presentedTicks', expected: expected.presentedTicks, actual: actual.presentedTicks };
  if (actual.pauseConfirmTick !== expected.pauseConfirmTick) return { path: 'pauseConfirmTick', expected: expected.pauseConfirmTick, actual: actual.pauseConfirmTick };
  if (actual.endHash !== expected.endHash) return { path: 'endHash', expected: expected.endHash, actual: actual.endHash };
  if (actual.sequenceSha256 !== expected.sequenceSha256) return { path: 'sequenceSha256', expected: expected.sequenceSha256, actual: actual.sequenceSha256 };
  return undefined;
}

const controllerSource = readFileSync(controllerPath, 'utf8');
const sourceSha256 = sha256Hex(controllerSource);

const api = await loadPauseController();
const results = [];
for (const { speed, pauseAtTick } of CASES) {
  results.push(entryOf(`speed-pause-${speed}-at-${pauseAtTick}`, speed, pauseAtTick, runCase(api, speed, pauseAtTick)));
}
const baseline = entryOf('baseline-unpaused', 100, null, runCase(api, 100, null));

if (WRITE) {
  const registry = {
    schemaVersion: 1,
    gate: 'G26',
    generatedBy: 'tools/sim/phase26-golden-harness.mjs --write',
    note: 'Baselines are canonical speed/pause semantics of the HUD contract layer. Changes require an explicit --write review; CI never writes.',
    tickRate: TICK_RATE,
    totalTicks: TOTAL_TICKS,
    controllerSha256: sourceSha256,
    entries: [baseline, ...results],
  };
  mkdirSync(dirname(registryPath), { recursive: true });
  writeFileSync(registryPath, canonicalJson(registry));
  process.stdout.write(canonicalJson({ status: 'WRITTEN', entries: registry.entries.length, path: 'contracts/phase26/golden-registry.json', controllerSha256: sourceSha256 }));
  process.exit(EXIT.OK);
}

let registry;
try {
  registry = JSON.parse(readFileSync(registryPath, 'utf8'));
} catch {
  process.stderr.write('P26_GOLDEN_REGISTRY_MISSING — run `node tools/sim/phase26-golden-harness.mjs --write` first.\n');
  process.exit(EXIT.SCHEMA);
}

if (registry.controllerSha256 !== sourceSha256) {
  const summary = { schemaVersion: 1, status: 'FAIL', gate: 'G26', reason: 'controllerSha256 drift — explicit --write review required', expected: registry.controllerSha256, actual: sourceSha256 };
  process.stdout.write(canonicalJson(summary));
  process.exit(EXIT.DIVERGENCE);
}

const expectedById = new Map((registry.entries ?? []).map((entry) => [entry.id, entry]));
const divergences = [];
const report = [];
for (const result of [baseline, ...results]) {
  const expected = expectedById.get(result.id);
  const diff = expected ? firstDivergence(result, expected) : { path: 'missing', expected: 'registry entry', actual: result.id };
  report.push({ id: result.id, status: diff ? 'DIVERGED' : 'MATCH', ...(diff ?? {}) });
  if (diff) divergences.push({ id: result.id, ...diff });
}

const summary = {
  schemaVersion: 1,
  status: divergences.length === 0 ? 'PASS' : 'FAIL',
  gate: 'G26',
  entries: report.length,
  diverged: divergences.length,
  firstDivergence: divergences[0] ?? null,
};
process.stdout.write(canonicalJson(summary));
if (REPORT_ONLY) process.exit(EXIT.OK);
process.exit(divergences.length === 0 ? EXIT.OK : EXIT.DIVERGENCE);
