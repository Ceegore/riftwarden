#!/usr/bin/env node
/**
 * Phase 28 map golden-seed harness (MAP_GENERATOR_CONTRACT + GENERATOR_QA_CONTRACT).
 *
 * Bundles the expedition kernel (map-generator, reachability, stable) with
 * Vite SSR and replays the twelve pinned golden seeds from
 * contracts/phase28/fixtures/map-golden-seeds.json plus a 10,000-map
 * deterministic PR gate. Every map must be structurally valid (zero
 * violations), the boss must be reachable, mandatory roles must exist and the
 * target visit length must be within 5–8. A source hash of map-generator.ts
 * and reachability.ts is pinned so any semantic change invalidates the
 * registry and forces an explicit review.
 *
 * Baselines are generated ONLY via an explicit local review tool (`--write`);
 * CI and every other invocation verify byte-for-byte and report the first
 * divergence. A silent baseline update is refused.
 *
 * Usage:
 *   node tools/sim/phase28-golden-harness.mjs --check  # verify vs registry (exit 5 on divergence)
 *   node tools/sim/phase28-golden-harness.mjs --write  # regenerate baselines (explicit review tool)
 *   node tools/sim/phase28-golden-harness.mjs --report # print the divergence report only
 */
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'vite';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..', '..');
const registryPath = resolve(root, 'contracts', 'phase28', 'golden-registry.json');
const seedsPath = resolve(root, 'contracts', 'phase28', 'fixtures', 'map-golden-seeds.json');

const EXIT = Object.freeze({ OK: 0, SCHEMA: 2, DIVERGENCE: 5, TOOL: 70 });

const WRITE = process.argv.includes('--write');
const REPORT_ONLY = process.argv.includes('--report');
const GATE_MAPS = 10000;

const PROFILE = Object.freeze({
  id: 'slice.act1.standard',
  logicalLevels: 6,
  targetVisited: [5, 8],
  mandatoryRoles: ['anchor', 'preparation', 'boss'],
  attemptCap: 50,
  fallbackTemplateId: 'slice.act1.safe',
});

function canonicalJson(value) {
  return JSON.stringify(value);
}

function sha256Hex(text) {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

/** Bundles the expedition kernel with Vite SSR and imports it. */
async function loadKernel() {
  const outDir = mkdtempSync(join(tmpdir(), 'p28-map-'));
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
            generator: resolve(root, 'src', 'game', 'expedition', 'map-generator.ts'),
            reachability: resolve(root, 'src', 'game', 'expedition', 'reachability.ts'),
          },
          output: { format: 'esm', entryFileNames: '[name].mjs', chunkFileNames: '[name]-[hash].mjs' },
        },
      },
    });
    const outputs = (Array.isArray(result) ? result : [result]).flatMap((r) => r.output);
    for (const chunk of outputs) {
      if (chunk.type === 'chunk') writeFileSync(join(outDir, chunk.fileName), chunk.code);
    }
    const generator = await import(pathToFileURL(join(outDir, 'generator.mjs')).href);
    const reachability = await import(pathToFileURL(join(outDir, 'reachability.mjs')).href);
    return {
      generateMap: generator.generateMap,
      validateMap: reachability.validateMap,
      reachableFrom: reachability.reachableFrom,
      mainPathLength: reachability.mainPathLength,
    };
  } finally {
    rmSync(outDir, { recursive: true, force: true });
  }
}

/** Generates and structurally validates one map; returns the pinned record. */
function mapRecord(api, seed) {
  const input = { seed, profileId: PROFILE.id, contentRevision: 'test-content-revision' };
  const map = api.generateMap(input, PROFILE);
  const violations = api.validateMap(map, PROFILE);
  if (violations.length > 0) throw new Error(`seed ${String(seed)} violations: ${violations.join(',')}`);
  const roles = {};
  for (const role of PROFILE.mandatoryRoles) roles[role] = map.nodes.some((node) => node.role === role);
  const reach = api.reachableFrom(map, map.startNodeId);
  return {
    seed,
    profileId: map.profileId,
    mapHash: map.mapHash,
    nodeCount: map.nodes.length,
    edgeCount: map.edges.length,
    mainPathLength: api.mainPathLength(map),
    startNodeId: map.startNodeId,
    bossNodeId: map.bossNodeId,
    bossReachable: reach.includes(map.bossNodeId),
    usedFallback: map.usedFallback,
    attempts: map.attempts,
    roles,
  };
}

function entryOf(caseId, seed, record) {
  return { caseId, seed, ...record };
}

function firstDivergence(actual, expected) {
  for (const key of ['mapHash', 'nodeCount', 'edgeCount', 'mainPathLength', 'startNodeId', 'bossNodeId', 'bossReachable', 'usedFallback', 'attempts']) {
    if (actual[key] !== expected[key]) return { path: key, expected: expected[key], actual: actual[key] };
  }
  for (const role of PROFILE.mandatoryRoles) {
    if (actual.roles[role] !== expected.roles[role]) return { path: `roles.${role}`, expected: expected.roles[role], actual: actual.roles[role] };
  }
  return undefined;
}

const generatorSource = readFileSync(resolve(root, 'src', 'game', 'expedition', 'map-generator.ts'), 'utf8');
const reachabilitySource = readFileSync(resolve(root, 'src', 'game', 'expedition', 'reachability.ts'), 'utf8');
const sourceSha256 = sha256Hex(generatorSource + reachabilitySource);

const api = await loadKernel();
const seeds = JSON.parse(readFileSync(seedsPath, 'utf8')).vectors;

const entries = [];
for (const vector of seeds) {
  entries.push(entryOf(vector.caseId, vector.seed, mapRecord(api, vector.seed)));
}

// PR gate: 10,000 deterministic maps, zero structural violations.
let gateViolations = 0;
let gateFallbacks = 0;
const gateSeedStart = 100000;
for (let i = 0; i < GATE_MAPS; i += 1) {
  const seed = gateSeedStart + i;
  const input = { seed, profileId: PROFILE.id, contentRevision: 'test-content-revision' };
  const map = api.generateMap(input, PROFILE);
  const violations = api.validateMap(map, PROFILE);
  if (violations.length > 0) gateViolations += 1;
  if (map.usedFallback) gateFallbacks += 1;
  if (gateViolations > 0) break;
}

if (WRITE) {
  const registry = {
    schemaVersion: 1,
    gate: 'G28',
    generatedBy: 'tools/sim/phase28-golden-harness.mjs --write',
    note: 'Baselines are canonical deterministic-map semantics of the expedition contract layer. Changes require an explicit --write review; CI never writes.',
    profileId: PROFILE.id,
    contentRevision: 'test-content-revision',
    gateSampleMaps: GATE_MAPS,
    kernelSha256: sourceSha256,
    entries,
  };
  mkdirSync(dirname(registryPath), { recursive: true });
  writeFileSync(registryPath, canonicalJson(registry));
  process.stdout.write(canonicalJson({ status: 'WRITTEN', entries: registry.entries.length, path: 'contracts/phase28/golden-registry.json', kernelSha256: sourceSha256 }));
  process.exit(EXIT.OK);
}

let registry;
try {
  registry = JSON.parse(readFileSync(registryPath, 'utf8'));
} catch {
  process.stderr.write('P28_GOLDEN_REGISTRY_MISSING — run `node tools/sim/phase28-golden-harness.mjs --write` first.\n');
  process.exit(EXIT.SCHEMA);
}

if (registry.kernelSha256 !== sourceSha256) {
  const summary = { schemaVersion: 1, status: 'FAIL', gate: 'G28', reason: 'kernelSha256 drift — explicit --write review required', expected: registry.kernelSha256, actual: sourceSha256 };
  process.stdout.write(canonicalJson(summary));
  process.exit(EXIT.DIVERGENCE);
}

const expectedById = new Map((registry.entries ?? []).map((entry) => [entry.caseId, entry]));
const divergences = [];
const report = [];
for (const result of entries) {
  const expected = expectedById.get(result.caseId);
  const diff = expected ? firstDivergence(result, expected) : { path: 'missing', expected: 'registry entry', actual: result.caseId };
  report.push({ caseId: result.caseId, status: diff ? 'DIVERGED' : 'MATCH', ...(diff ?? {}) });
  if (diff) divergences.push({ caseId: result.caseId, ...diff });
}

const summary = {
  schemaVersion: 1,
  status: divergences.length === 0 && gateViolations === 0 ? 'PASS' : 'FAIL',
  gate: 'G28',
  entries: report.length,
  diverged: divergences.length,
  gateSampleMaps: GATE_MAPS,
  gateViolations,
  gateFallbacks,
  firstDivergence: divergences[0] ?? null,
};
process.stdout.write(canonicalJson(summary));
if (REPORT_ONLY) process.exit(EXIT.OK);
process.exit(divergences.length === 0 && gateViolations === 0 ? EXIT.OK : EXIT.DIVERGENCE);
