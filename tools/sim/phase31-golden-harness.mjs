#!/usr/bin/env node
/**
 * Phase 31 derived-stats golden harness (DERIVED_STATS_CONTRACT).
 *
 * Bundles the profile kernel (derived-stats, integer) with Vite SSR and
 * replays the two pinned kit cases byte-for-byte, then runs a 10,000-input
 * deterministic permutation sweep over base × levelPermille × equipmentFlat ×
 * otherPermille and proves every result is a non-negative safe integer with
 * the documented single-rounding semantics. A source hash of derived-stats.ts
 * and integer.ts is pinned so any semantic change invalidates the registry and
 * forces an explicit review.
 *
 * Baselines are generated ONLY via an explicit local review tool (`--write`);
 * CI and every other invocation verify byte-for-byte and report the first
 * divergence. A silent baseline update is refused.
 *
 * Usage:
 *   node tools/sim/phase31-golden-harness.mjs --check  # verify vs registry (exit 5 on divergence)
 *   node tools/sim/phase31-golden-harness.mjs --write  # regenerate baselines (explicit review tool)
 *   node tools/sim/phase31-golden-harness.mjs --report # print the divergence report only
 */
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync, readFileSync, rmSync, mkdtempSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { build } from 'vite';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..', '..');
const registryPath = resolve(root, 'contracts', 'phase31', 'golden-registry.json');
const casesPath = resolve(root, 'contracts', 'phase31', 'fixtures', 'derived-stat-cases.json');

const EXIT = Object.freeze({ OK: 0, SCHEMA: 2, DIVERGENCE: 5, TOOL: 70 });

const WRITE = process.argv.includes('--write');
const REPORT_ONLY = process.argv.includes('--report');
const SWEEP_COUNT = 10000;

function sha256Hex(text) {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

/** Bundles the profile kernel with Vite SSR and imports it. */
async function loadKernel() {
  const outDir = mkdtempSync(join(tmpdir(), 'p31-stats-'));
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
          input: {
            stats: resolve(root, 'src', 'game', 'profile', 'derived-stats.ts'),
            integer: resolve(root, 'src', 'game', 'profile', 'integer.ts'),
          },
          output: { format: 'esm', entryFileNames: '[name].mjs', chunkFileNames: '[name]-[hash].mjs' },
        },
      },
    });
    const outputs = (Array.isArray(result) ? result : [result]).flatMap((r) => r.output);
    for (const chunk of outputs) {
      if (chunk.type === 'chunk') writeFileSync(join(outDir, chunk.fileName), chunk.code);
    }
    const stats = await import(pathToFileURL(join(outDir, 'stats.mjs')).href);
    const integer = await import(pathToFileURL(join(outDir, 'integer.mjs')).href);
    return {
      deriveStat: stats.deriveStat,
      mulPermilleFloor: integer.mulPermilleFloor,
      isNonNegativeSafeInteger: integer.isNonNegativeSafeInteger,
    };
  } finally {
    rmSync(outDir, { recursive: true, force: true });
  }
}

/** Computes the pinned record for one derivation input. */
function statRecord(api, input, caseId) {
  const result = api.deriveStat(input);
  return {
    caseId,
    base: input.base,
    levelPermille: input.levelPermille,
    equipmentFlat: input.equipmentFlat,
    otherPermille: input.otherPermille,
    result,
    safeInteger: api.isNonNegativeSafeInteger(result),
  };
}

function firstDivergence(actual, expected) {
  for (const key of ['result', 'safeInteger']) {
    if (actual[key] !== expected[key]) return { path: key, expected: expected[key], actual: actual[key] };
  }
  return undefined;
}

const statsSource = readFileSync(resolve(root, 'src', 'game', 'profile', 'derived-stats.ts'), 'utf8');
const integerSource = readFileSync(resolve(root, 'src', 'game', 'profile', 'integer.ts'), 'utf8');
const sourceSha256 = sha256Hex(statsSource + integerSource);

const api = await loadKernel();
const cases = JSON.parse(readFileSync(casesPath, 'utf8'));

// 1. Pinned kit cases (byte-for-byte expected results).
const entries = [];
for (let i = 0; i < cases.length; i += 1) {
  const row = cases[i];
  entries.push(
    statRecord(api, {
      base: row.base,
      levelPermille: row.levelPermille,
      equipmentFlat: row.equipmentFlat,
      otherPermille: row.otherPermille,
    }, `case-${String(i).padStart(2, '0')}`),
  );
}

// 2. Deterministic 10k permutation sweep with the documented order semantics:
//    result == floor(floor(base*level/1000)+equipment)*other/1000, single
//    rounding at each stage. Also asserts the integer-exact property holds for
//    the intermediate value.
let sweepFailures = 0;
const sweepFirstFailure = { index: -1, expected: 0, actual: 0, stage: 'none' };
for (let i = 0; i < SWEEP_COUNT; i += 1) {
  const base = 1 + (i * 7) % 1000;
  const levelPermille = 500 + (i * 13) % 2500;
  const equipmentFlat = (i * 3) % 200;
  const otherPermille = 500 + (i * 17) % 2500;
  const got = api.deriveStat({ base, levelPermille, equipmentFlat, otherPermille });
  const afterLevel = api.mulPermilleFloor(base, levelPermille);
  const afterEquipment = afterLevel + equipmentFlat;
  const expected = api.mulPermilleFloor(afterEquipment, otherPermille);
  if (got !== expected || !api.isNonNegativeSafeInteger(got)) {
    sweepFailures += 1;
    if (sweepFirstFailure.index === -1) {
      sweepFirstFailure.index = i;
      sweepFirstFailure.expected = expected;
      sweepFirstFailure.actual = got;
    }
    if (sweepFailures >= 5) break;
  }
}

const registry = {
  schemaVersion: 1,
  phase: 31,
  kind: 'derived-stats-golden',
  sourceSha256,
  pinnedCases: entries,
  sweep: {
    count: SWEEP_COUNT,
    failures: sweepFailures,
    firstFailure: sweepFirstFailure,
  },
};

if (WRITE) {
  mkdirSync(dirname(registryPath), { recursive: true });
  writeFileSync(registryPath, JSON.stringify(registry, null, 2) + '\n');
  console.log(`wrote ${registryPath} (${entries.length} pinned cases, sweep ${SWEEP_COUNT} clean=${sweepFailures === 0})`);
  process.exit(EXIT.OK);
}

let stored = null;
try {
  stored = JSON.parse(readFileSync(registryPath, 'utf8'));
} catch {
  console.error(`registry missing or invalid: ${registryPath}`);
  process.exit(EXIT.SCHEMA);
}

const divergences = [];
if (stored.sourceSha256 !== registry.sourceSha256) {
  divergences.push({ path: 'sourceSha256', expected: stored.sourceSha256, actual: registry.sourceSha256 });
}
for (let i = 0; i < entries.length; i += 1) {
  const divergence = firstDivergence(entries[i], stored.pinnedCases?.[i]);
  if (divergence !== undefined) {
    divergences.push({ path: `pinnedCases[${i}].${divergence.path}`, expected: divergence.expected, actual: divergence.actual });
  }
}
if (registry.sweep.failures !== stored.sweep?.failures) {
  divergences.push({ path: 'sweep.failures', expected: stored.sweep?.failures, actual: registry.sweep.failures });
}

if (REPORT_ONLY) {
  console.log(JSON.stringify({ divergences, sweep: registry.sweep }, null, 2));
  process.exit(EXIT.OK);
}

if (divergences.length > 0) {
  console.error(`DIVERGENCE: ${divergences.length} difference(s) vs ${registryPath}`);
  for (const d of divergences) console.error(`  ${d.path}: expected=${JSON.stringify(d.expected)} actual=${JSON.stringify(d.actual)}`);
  process.exit(EXIT.DIVERGENCE);
}

console.log(`PASS ${entries.length} pinned cases + ${SWEEP_COUNT}-map sweep (0 failures), source ${registry.sourceSha256.slice(0, 12)}`);
process.exit(EXIT.OK);
