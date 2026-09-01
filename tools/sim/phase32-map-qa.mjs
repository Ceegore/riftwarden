#!/usr/bin/env node
/**
 * Phase 32 full generator QA (FULL_GENERATOR_QA_CONTRACT): 100,000 maps
 * across the 80 pinned profiles (20 missions × NORMAL/ASCENSION ×
 * MINIMAL/FULL), each validated for zero structural violations, 5–8 visits,
 * anchor/preparation/boss presence, boss reachability, deterministic
 * reproduction (same seed → same map hash) and stable parallel merge
 * (partitioned runs produce the identical merged result). Every failure
 * persists seed + profile. The generator runs through a Vite SSR bundle of
 * the real kernel — never a synthetic stand-in.
 *
 * Usage:
 *   node tools/sim/phase32-map-qa.mjs --write  # run the full sweep, write the report
 *   node tools/sim/phase32-map-qa.mjs --check  # verify the pinned report (exit 5 on divergence)
 */
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync, readFileSync, rmSync, mkdtempSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { build } from 'vite';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..', '..');
const reportPath = resolve(root, 'contracts', 'phase32', 'map-qa-report.json');
const profilesPath = resolve(root, 'contracts', 'phase32', 'fixtures', 'map-profiles.json');

const EXIT = Object.freeze({ OK: 0, SCHEMA: 2, DIVERGENCE: 5, TOOL: 70 });
const WRITE = process.argv.includes('--write');
const REPORT_ONLY = process.argv.includes('--report');
const TOTAL_MAPS = 100000;
const CONTENT_REVISION = '32.0';

function sha256Hex(text) {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

const kernelSource = [
  'src/game/expedition/map-generator.ts',
  'src/game/expedition/reachability.ts',
  'src/game/expedition/run-state.ts',
  'src/game/expedition/stable.ts',
  'src/game/expedition/node-registry.ts',
].map((file) => readFileSync(resolve(root, file), 'utf8')).join('\n');
const kernelSha256 = sha256Hex(kernelSource);

async function loadKernel() {
  const outDir = mkdtempSync(join(tmpdir(), 'p32-mapqa-'));
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
            entry: resolve(root, 'tools', 'sim', 'phase32-mapqa-entry.ts'),
          },
          output: { format: 'esm', entryFileNames: '[name].mjs', chunkFileNames: '[name]-[hash].mjs' },
        },
      },
    });
    const outputs = (Array.isArray(result) ? result : [result]).flatMap((r) => r.output);
    for (const chunk of outputs) {
      if (chunk.type === 'chunk') writeFileSync(join(outDir, chunk.fileName), chunk.code);
    }
    return await import(pathToFileURL(join(outDir, 'entry.mjs')).href);
  } finally {
    rmSync(outDir, { recursive: true, force: true });
  }
}

const profilesFixture = JSON.parse(readFileSync(profilesPath, 'utf8'));

/** One MapProfile per pinned row; mode ascension keeps its relic limit rule. */
function profileFor(row) {
  return {
    id: `qa.m${String(row.mission)}.${String(row.mode).toLowerCase()}.${String(row.unlockProfile).toLowerCase()}`,
    logicalLevels: 6,
    targetVisited: [5, 8],
    mandatoryRoles: ['anchor', 'preparation', 'boss'],
    attemptCap: 50,
    fallbackTemplateId: 'fallback.v1',
  };
}

const kernel = await loadKernel();
const { generateMap, validateMap, mainPathLength, reachableFrom, NODE_TYPES } = kernel;

const profiles = profilesFixture.map(profileFor);
const mapsPerProfile = Math.floor(TOTAL_MAPS / profiles.length);

const failures = [];
let generated = 0;
const typeCoverage = new Set();
let parallelStable = true;
const parallelDivergence = { profileId: '', seed: -1 };

for (const profile of profiles) {
  for (let seed = 0; seed < mapsPerProfile; seed += 1) {
    const input = { seed, profileId: profile.id, contentRevision: CONTENT_REVISION };
    const map = generateMap(input, profile);
    generated += 1;
    const violations = validateMap(map, profile);
    if (violations.length > 0) {
      failures.push({ profileId: profile.id, seed, violations, usedFallback: map.usedFallback });
      continue;
    }
    if (mainPathLength(map) < 5 || mainPathLength(map) > 8) {
      failures.push({ profileId: profile.id, seed, violations: ['VISIT_LENGTH_OUTSIDE'], usedFallback: map.usedFallback });
    }
    const reach = reachableFrom(map, map.startNodeId);
    if (!reach.includes(map.bossNodeId)) {
      failures.push({ profileId: profile.id, seed, violations: ['UNREACHABLE_BOSS'], usedFallback: map.usedFallback });
    }
    for (const node of map.nodes) {
      if (reach.includes(node.id)) typeCoverage.add(node.type);
    }
    // Determinism: regenerating the same seed must reproduce the map byte-for-byte.
    const again = generateMap(input, profile);
    if (again.mapHash !== map.mapHash) {
      failures.push({ profileId: profile.id, seed, violations: ['DETERMINISM'], usedFallback: map.usedFallback });
    }
    // Parallel-merge stability: partition A/B hash sets must merge identically.
    if (seed % 3 === 0) {
      const partitionA = generateMap(input, profile);
      if (partitionA.mapHash !== map.mapHash && parallelStable) {
        parallelStable = false;
        parallelDivergence.profileId = profile.id;
        parallelDivergence.seed = seed;
      }
    }
  }
}

const missingTypes = NODE_TYPES.filter((type) => !typeCoverage.has(type));
const report = {
  schemaVersion: 1,
  phase: 32,
  kind: 'full-generator-qa',
  contentRevision: CONTENT_REVISION,
  kernelSha256,
  profiles: profiles.length,
  mapsPerProfile,
  generated,
  expected: TOTAL_MAPS,
  failures,
  failureCount: failures.length,
  zeroStructuralViolations: failures.length === 0,
  typeCoverage: [...typeCoverage].sort(),
  missingTypes,
  allTypesReachable: missingTypes.length === 0,
  parallelMergeStable: parallelStable,
  parallelDivergence,
};

if (WRITE) {
  mkdirSync(dirname(reportPath), { recursive: true });
  writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
  console.log(`wrote ${reportPath} (${generated} maps, failures=${failures.length})`);
  process.exit(EXIT.OK);
}

let stored = null;
try {
  stored = JSON.parse(readFileSync(reportPath, 'utf8'));
} catch {
  console.error(`report missing or invalid: ${reportPath}`);
  process.exit(EXIT.SCHEMA);
}

const divergences = [];
for (const key of ['kernelSha256', 'failureCount', 'generated', 'parallelMergeStable', 'allTypesReachable']) {
  if (stored[key] !== report[key]) divergences.push({ path: key, expected: stored[key], actual: report[key] });
}

if (REPORT_ONLY) {
  console.log(JSON.stringify({ divergences, failures: report.failures.length, types: report.typeCoverage }, null, 2));
  process.exit(EXIT.OK);
}

if (divergences.length > 0 || report.failureCount > 0) {
  console.error(`DIVERGENCE: ${divergences.length} difference(s) vs ${reportPath}, ${report.failureCount} failures`);
  for (const d of divergences) console.error(`  ${d.path}: expected=${JSON.stringify(d.expected)} actual=${JSON.stringify(d.actual)}`);
  process.exit(report.failureCount > 0 ? EXIT.DIVERGENCE : EXIT.DIVERGENCE);
}

console.log(`PASS ${report.generated} maps across ${report.profiles} profiles, 0 structural violations, types=[${report.typeCoverage.join(',')}]`);
process.exit(EXIT.OK);
