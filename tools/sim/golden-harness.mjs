#!/usr/bin/env node
/**
 * Phase 22 golden replay harness (P22-T03).
 *
 * The registry pins the twelve canonical seeds (GDD 85.3) with versions, seed,
 * start hash, 30-tick checkpoint hashes, end hash, event count and curated
 * vector metadata. Baselines are generated ONLY via an explicit local review
 * tool (`--write`); CI and every other invocation verify byte-for-byte and
 * report the first divergence. A silent baseline update is refused.
 *
 * Usage:
 *   node tools/sim/golden-harness.mjs --check          # verify vs registry (exit 5 on divergence)
 *   node tools/sim/golden-harness.mjs --write          # regenerate baselines (explicit review tool)
 *   node tools/sim/golden-harness.mjs --report         # print the divergence report only
 */
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadKernel } from './lib/kernel-loader.mjs';
import { GOLDEN_ENTRIES, SCENARIOS, goldenSeedWords, sessionFromSeed } from './lib/scenario-registry.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..', '..');
const registryPath = resolve(root, 'contracts', 'phase22', 'golden-registry.json');

const EXIT = Object.freeze({ OK: 0, SCHEMA: 2, REPLAY: 5, TOOL: 70 });

function arg(name, fallback = undefined) {
  const i = process.argv.indexOf(`--${name}`);
  if (i >= 0 && process.argv[i + 1] !== undefined) return process.argv[i + 1];
  return fallback;
}

const WRITE = process.argv.includes('--write');
const REPORT_ONLY = process.argv.includes('--report');

function json(api, value) {
  return api.monitor.canonicalJson(value);
}

function probeFromState(state, missionCapTicks) {
  const laneOrdinal = { top: 0, middle: 1, bottom: 2 };
  const entities = (state.entities ?? []).map((entity) => ({
    id: entity.id,
    hp: entity.lp,
    maxHp: entity.maxLp,
    shield: entity.shield,
    lane: laneOrdinal[entity.lane] ?? -1,
    x100: entity.x100,
    state: entity.phase?.phase ?? 'ACTIVE',
  }));
  return { tick: state.tick, events: state.emittedEventCount, entities, missionCapTicks, rewardsCommitted: false };
}

/** Runs one golden vector and returns its canonical result + first violation. */
async function runVector(api, entry) {
  const scenario = SCENARIOS[entry.scenario];
  const seed = goldenSeedWords(entry.id);
  const input = Object.freeze({ paused: false, decisions: Object.freeze([]), contentVersion: 'content_fixture' });
  let state = scenario.build(api, seed);
  const startHash = api.snapshot.createSnapshot(state).checksum;
  const random = sessionFromSeed(api, seed);
  const systems = scenario.systems(api);
  const checkpoints = [];
  let violations = [];
  let terminal = false;
  let outcome = null;

  for (let i = 0; i < entry.capTicks; i++) {
    const found = api.monitor.inspectBattle(probeFromState(state, 5400));
    if (found.length > 0) {
      violations = [...found];
      break;
    }
    const step = api.battleKernel.stepBattle({ state, input, random, rules: {}, content: {}, systems });
    state = step.state;
    if (step.checkpoint) checkpoints.push({ tick: state.tick, checksum: step.checkpoint.checksum });
    if (['VICTORY', 'DEFEAT', 'DRAW_ABORT'].includes(state.phase?.phase)) {
      terminal = true;
      outcome = state.phase.phase;
      break;
    }
  }
  if (violations.length === 0) {
    violations = [...api.monitor.inspectBattle(probeFromState(state, 5400))];
  }

  return {
    id: entry.id,
    purpose: entry.purpose,
    scenario: entry.scenario,
    simulationVersion: scenario.simulationVersion,
    contentVersion: 'content_fixture',
    seed,
    startHash,
    checkpoints,
    endTick: state.tick,
    endHash: api.snapshot.createSnapshot(state).checksum,
    endReason: state.endReason,
    eventCount: state.emittedEventCount,
    outcome,
    terminal,
    violations,
  };
}

function entryOf(result) {
  return {
    id: result.id,
    purpose: result.purpose,
    scenario: result.scenario,
    simulationVersion: result.simulationVersion,
    contentVersion: result.contentVersion,
    seed: result.seed,
    startHash: result.startHash,
    checkpoints: result.checkpoints,
    endTick: result.endTick,
    endHash: result.endHash,
    endReason: result.endReason,
    eventCount: result.eventCount,
    outcome: result.outcome,
    terminal: result.terminal,
  };
}

/** Finds the first divergence between two golden entries. */
function firstDivergence(actual, expected) {
  if (actual.startHash !== expected.startHash) return { path: 'startHash', expected: expected.startHash, actual: actual.startHash };
  const n = Math.max((expected.checkpoints ?? []).length, (actual.checkpoints ?? []).length);
  for (let i = 0; i < n; i++) {
    const e = (expected.checkpoints ?? [])[i];
    const a = (actual.checkpoints ?? [])[i];
    if (e?.tick !== a?.tick || e?.checksum !== a?.checksum) {
      return { tick: a?.tick ?? e?.tick ?? -1, path: `checkpoints[${i}]`, expected: e, actual: a };
    }
  }
  if (actual.endHash !== expected.endHash) return { tick: actual.endTick, path: 'endHash', expected: expected.endHash, actual: actual.endHash };
  if (actual.eventCount !== expected.eventCount) return { tick: actual.endTick, path: 'eventCount', expected: expected.eventCount, actual: actual.eventCount };
  if (actual.outcome !== expected.outcome) return { tick: actual.endTick, path: 'outcome', expected: expected.outcome, actual: actual.outcome };
  return undefined;
}

const api = await loadKernel();
try {
  const results = [];
  for (const entry of GOLDEN_ENTRIES) {
    const result = await runVector(api, entry);
    if (result.violations.length > 0) {
      const first = result.violations[0];
      process.stderr.write(json(api, { status: 'FAIL', id: entry.id, code: first.code, tick: first.tick, path: first.path, excerpt: first.excerpt }));
      process.exit(EXIT.TOOL);
    }
    results.push(result);
  }

  if (WRITE) {
    const registry = {
      schemaVersion: 1,
      gate: 'G22',
      generatedBy: 'tools/sim/golden-harness.mjs --write',
      note: 'Baselines are real repository output. Changes require an explicit --write review; CI never writes.',
      entries: results.map(entryOf),
    };
    mkdirSync(dirname(registryPath), { recursive: true });
    writeFileSync(registryPath, json(api, registry));
    process.stdout.write(json(api, { status: 'WRITTEN', entries: results.length, path: 'contracts/phase22/golden-registry.json' }));
    process.exit(EXIT.OK);
  }

  let registry;
  try {
    registry = JSON.parse(readFileSync(registryPath, 'utf8'));
  } catch {
    process.stderr.write('P22_GOLDEN_REGISTRY_MISSING — run `node tools/sim/golden-harness.mjs --write` first.\n');
    process.exit(EXIT.SCHEMA);
  }

  const expectedById = new Map((registry.entries ?? []).map((e) => [e.id, e]));
  const divergences = [];
  const report = [];
  for (const result of results) {
    const expected = expectedById.get(result.id);
    const diff = expected ? firstDivergence(result, expected) : { path: 'missing', expected: 'registry entry', actual: result.id };
    report.push({ id: result.id, status: diff ? 'DIVERGED' : 'MATCH', ...(diff ?? {}) });
    if (diff) divergences.push({ id: result.id, ...diff });
  }

  const summary = {
    schemaVersion: 1,
    status: divergences.length === 0 ? 'PASS' : 'FAIL',
    gate: 'G22',
    entries: report.length,
    diverged: divergences.length,
    firstDivergence: divergences[0] ?? null,
  };
  if (REPORT_ONLY) {
    process.stdout.write(json(api, summary));
    process.exit(EXIT.OK);
  }
  process.stdout.write(json(api, summary));
  if (divergences.length > 0) process.exit(EXIT.REPLAY);
  process.exit(EXIT.OK);
} finally {
  api.close();
}
