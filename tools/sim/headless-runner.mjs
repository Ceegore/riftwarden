#!/usr/bin/env node
/**
 * Phase 22 headless battle runner (P22-T01).
 *
 * Runs a canonical battle vector to a terminal outcome or a tick cap, checking
 * the Phase 22 invariant monitor every tick and hashing the canonical snapshot
 * every 30 ticks. Input and output are canonical JSON; the same input must
 * produce byte-identical output on every run.
 *
 * Exit codes (P22 contract):
 *   0  success
 *   2  schema/argument error
 *   3  incompatible version/content
 *   4  invariant violation (first tick + code + path + excerpt)
 *   5  replay divergence (golden baseline mismatch)
 *   6  safety cap / deadlock reached without terminal outcome
 *   70 internal tool error
 *
 * Usage:
 *   node tools/sim/headless-runner.mjs --golden <id> [--cap N] [--baseline <file>] [--out <file>]
 *   node tools/sim/headless-runner.mjs --request <file.json> [--baseline <file>] [--out <file>]
 */
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadKernel } from './lib/kernel-loader.mjs';
import { SCENARIOS, goldenById, goldenSeedWords, sessionFromSeed } from './lib/scenario-registry.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..', '..');

const EXIT = Object.freeze({ OK: 0, SCHEMA: 2, VERSION: 3, INVARIANT: 4, REPLAY: 5, CAP: 6, TOOL: 70 });

function arg(name, fallback = undefined) {
  const i = process.argv.indexOf(`--${name}`);
  if (i >= 0 && process.argv[i + 1] !== undefined) return process.argv[i + 1];
  return fallback;
}

let currentApi = null;

function fail(code, message, extra = {}) {
  const body = { status: 'FAIL', exitCode: code, reason: message, ...extra };
  process.stdout.write(currentApi ? currentApi.monitor.canonicalJson(body) : `${JSON.stringify(body)}\n`);
  process.exit(code);
}

const HEX_WORD = /^[0-9a-f]{8}$/;

/** Validates a 4-word hex seed; returns the words or throws with a schema code. */
function parseSeed(value) {
  if (!Array.isArray(value) || value.length !== 4 || value.some((w) => typeof w !== 'string' || !HEX_WORD.test(w))) {
    throw new Error('P22_SEED_FORMAT');
  }
  return Object.freeze([...value]);
}

/** Converts a BattleModel into a read-only invariant-monitor probe. */
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
  return {
    tick: state.tick,
    events: state.emittedEventCount,
    entities,
    missionCapTicks,
    rewardsCommitted: false,
  };
}

async function run() {
  const api = await loadKernel();
  currentApi = api;
  try {
    const requestFile = arg('request');
    let request;
    if (requestFile) {
      let raw;
      try {
        raw = readFileSync(resolve(root, requestFile), 'utf8');
      } catch (error) {
        fail(EXIT.SCHEMA, 'P22_REQUEST_UNREADABLE', { file: requestFile });
        return;
      }
      try {
        request = JSON.parse(raw);
      } catch {
        fail(EXIT.SCHEMA, 'P22_REQUEST_INVALID_JSON', { file: requestFile });
        return;
      }
    } else {
      const goldenId = arg('golden');
      if (!goldenId) fail(EXIT.SCHEMA, 'P22_MISSING_REQUEST');
      const entry = goldenById(goldenId);
      if (!entry) fail(EXIT.SCHEMA, 'P22_GOLDEN_UNKNOWN', { id: goldenId });
      request = {
        schemaVersion: 1,
        goldenId,
        scenario: entry.scenario,
        seed: [...goldenSeedWords(goldenId)],
        endTickCap: entry.capTicks,
        contentVersion: 'content_fixture',
        requireTerminal: false,
      };
    }

    // ---- schema validation (exit 2) ----
    if (typeof request !== 'object' || request === null || Array.isArray(request)) fail(EXIT.SCHEMA, 'P22_REQUEST_NOT_OBJECT');
    const scenarioId = request.scenario;
    if (typeof scenarioId !== 'string' || !SCENARIOS[scenarioId]) fail(EXIT.SCHEMA, 'P22_SCENARIO_UNKNOWN', { scenario: scenarioId });
    let seed;
    try {
      seed = parseSeed(request.seed ?? goldenSeedWords(request.goldenId ?? 'golden_default'));
    } catch {
      fail(EXIT.SCHEMA, 'P22_SEED_FORMAT', { seed: request.seed });
    }
    const capTicks = request.endTickCap ?? 5400;
    if (!Number.isSafeInteger(capTicks) || capTicks < 1 || capTicks > 5400) fail(EXIT.SCHEMA, 'P22_CAP_INVALID', { capTicks });
    const missionCapTicks = request.missionCapTicks ?? 5400;
    if (!Number.isSafeInteger(missionCapTicks) || missionCapTicks < 1 || missionCapTicks > 5400) fail(EXIT.SCHEMA, 'P22_MISSION_CAP_INVALID', { missionCapTicks });
    if (request.contentVersion !== 'content_fixture') fail(EXIT.SCHEMA, 'P22_CONTENT_UNKNOWN', { contentVersion: request.contentVersion });

    const scenario = SCENARIOS[scenarioId];

    // ---- version/content compatibility (exit 3) ----
    if (request.simulationVersion !== undefined && request.simulationVersion !== scenario.simulationVersion) {
      fail(EXIT.VERSION, 'P22_VERSION_MISMATCH', { expected: scenario.simulationVersion, actual: request.simulationVersion });
    }

    // ---- run ----
    const input = Object.freeze({ paused: false, decisions: Object.freeze([]), contentVersion: 'content_fixture' });
    let state;
    if (request.startSnapshot !== undefined) {
      // Canonical start snapshot input (ReplayInput.startSnapshot): the caller
      // supplies the full battle state; validation happens on the first tick.
      if (typeof request.startSnapshot !== 'object' || request.startSnapshot === null || Array.isArray(request.startSnapshot)) {
        fail(EXIT.SCHEMA, 'P22_START_SNAPSHOT_INVALID');
      }
      state = request.startSnapshot;
    } else {
      state = scenario.build(api, seed);
    }
    let startHash;
    try {
      startHash = api.snapshot.createSnapshot(state).checksum;
    } catch (error) {
      // A kernel snapshot error (e.g. P14_DUPLICATE_ENTITY) is an input
      // schema violation, not a runtime invariant — exit 2 with the stable
      // kernel code preserved.
      fail(EXIT.SCHEMA, 'P22_START_SNAPSHOT_INVALID', { kernelCode: error?.code ?? error?.message });
    }
    const random = sessionFromSeed(api, seed);
    const systems = scenario.systems(api);
    const checkpoints = [];
    const violations = [];
    let terminal = false;
    let outcome = null;

    for (let tickIndex = 0; tickIndex < capTicks; tickIndex++) {
      // Invariant monitor on the pre-step state (tick 0 included).
      const probe = probeFromState(state, missionCapTicks);
      const found = api.monitor.inspectBattle(probe);
      if (found.length > 0) {
        violations.push(...found);
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
      if (state.phase?.phase === 'RESOLVING_END' && state.phase.resolvingEndTicks >= 3) {
        terminal = true;
        outcome = state.phase.phase;
        break;
      }
    }
    // Monitor the final state too (post-loop).
    if (violations.length === 0) {
      const probe = probeFromState(state, missionCapTicks);
      violations.push(...api.monitor.inspectBattle(probe));
    }

    if (violations.length > 0) {
      const first = violations[0];
      fail(EXIT.INVARIANT, 'P22_INVARIANT', {
        code: first.code,
        tick: first.tick,
        path: first.path,
        excerpt: first.excerpt,
        checkpoints,
        endHash: api.snapshot.createSnapshot(state).checksum,
        endTick: state.tick,
        eventCount: state.emittedEventCount,
      });
    }

    const requireTerminal = request.requireTerminal !== false;
    if (!terminal && state.phase?.phase !== 'RESOLVING_END' && requireTerminal) {
      // Reached the cap without a terminal outcome — safety cap.
      fail(EXIT.CAP, 'P22_CAP_REACHED', {
        capTicks,
        endTick: state.tick,
        endHash: api.snapshot.createSnapshot(state).checksum,
        eventCount: state.emittedEventCount,
      });
    }

    const endHash = api.snapshot.createSnapshot(state).checksum;
    const result = {
      schemaVersion: 1,
      status: 'SUCCESS',
      exitCode: EXIT.OK,
      goldenId: request.goldenId ?? null,
      scenario: scenarioId,
      contentVersion: 'content_fixture',
      simulationVersion: scenario.simulationVersion,
      seed,
      startHash,
      checkpoints,
      endTick: state.tick,
      endHash,
      endReason: state.endReason,
      eventCount: state.emittedEventCount,
      outcome,
    };

    // ---- golden baseline comparison (exit 5) ----
    const baselineFile = arg('baseline');
    if (baselineFile) {
      let baseline;
      try {
        baseline = JSON.parse(readFileSync(resolve(root, baselineFile), 'utf8'));
      } catch {
        fail(EXIT.SCHEMA, 'P22_BASELINE_UNREADABLE', { file: baselineFile });
        return;
      }
      const firstDiff = compareResult(result, baseline);
      if (firstDiff) fail(EXIT.REPLAY, 'P22_GOLDEN_DIVERGENCE', firstDiff);
    }

    const out = arg('out');
    if (out) {
      mkdirSync(dirname(resolve(root, out)), { recursive: true });
      writeFileSync(resolve(root, out), canonicalJson(result));
    }
    process.stdout.write(api.monitor.canonicalJson(result));
  } finally {
    currentApi = null;
    api.close();
  }
}

/** Reports the first divergence between a run result and a golden baseline. */
function compareResult(actual, expected) {
  const n = Math.max((expected.checkpoints ?? []).length, actual.checkpoints.length);
  for (let i = 0; i < n; i++) {
    const e = (expected.checkpoints ?? [])[i];
    const a = actual.checkpoints[i];
    if (e?.tick !== a?.tick || e?.checksum !== a?.checksum) {
      return { tick: a?.tick ?? e?.tick ?? -1, path: `checkpoints[${i}]`, expected: e, actual: a };
    }
  }
  if (expected.endHash !== actual.endHash) return { tick: actual.endTick, path: 'endHash', expected: expected.endHash, actual: actual.endHash };
  if (expected.eventCount !== actual.eventCount) return { tick: actual.endTick, path: 'eventCount', expected: expected.eventCount, actual: actual.eventCount };
  return undefined;
}

run().catch((error) => {
  process.stderr.write(`${error?.stack ?? error}\n`);
  process.exit(EXIT.TOOL);
});
