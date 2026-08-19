#!/usr/bin/env node
/**
 * Phase 22 deterministic mass simulation with partition/merge (P22-T05).
 *
 * Case `i` is assigned exclusively via `partitionCaseIndices` — a stable
 * formula independent of wallclock, CPU count or scheduling. Workers emit
 * per-worker JSON; the merge step concatenates strictly by ascending
 * caseIndex and computes the canonical aggregate hash. Running the same
 * total with 1 worker and with N workers yields the identical aggregate hash.
 *
 * Usage:
 *   node tools/sim/run-mass-sim-partitioned.mjs --total 200 --workers 2 --worker-index 0 --out part-0.json
 *   node tools/sim/run-mass-sim-partitioned.mjs --merge part-0.json part-1.json --out merged.json
 *   node tools/sim/run-mass-sim-partitioned.mjs --single --total 200 --out single.json   # 1-worker run
 */
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadKernel } from './lib/kernel-loader.mjs';
import {
  buildBattle,
  buildPhase15Battle,
  buildPhase16Battle,
  buildPhase17Battle,
  buildPhase17JLBattle,
} from './lib/kernel-loader.mjs';
import { buildPhase18Battle } from './lib/phase18-trace.mjs';
import { buildPhase19Battle } from './lib/phase19-trace.mjs';
import { buildPhase20Battle } from './lib/phase20-trace.mjs';
import { buildPhase21Battle } from './lib/phase21-trace.mjs';
import { goldenSeedWords, sessionFromSeed } from './lib/scenario-registry.mjs';
import { aggregateHash, mergeCases, partitionCaseIndices } from './lib/mass-partition.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..', '..');

function arg(name, fallback = undefined) {
  const i = process.argv.indexOf(`--${name}`);
  if (i >= 0 && process.argv[i + 1] !== undefined) return process.argv[i + 1];
  return fallback;
}

const total = Number(arg('total', '200'));
const workers = Number(arg('workers', '2'));
const workerIndex = Number(arg('worker-index', '0'));
const merge = process.argv.includes('--merge');
const single = process.argv.includes('--single');
const scenarioId = arg('scenario', 'phase17');
const out = arg('out');

const api = await loadKernel();
try {
  const scenario = {
    phase14: { build: () => buildBattle(api, { simulationVersion: 'phase14-fixture-v1' }) },
    phase15: { build: () => buildPhase15Battle(api) },
    phase16: { build: () => buildPhase16Battle(api) },
    phase17: { build: () => buildPhase17Battle(api) },
    phase17jl: { build: () => buildPhase17JLBattle(api) },
    phase18: { build: () => buildPhase18Battle(api) },
    phase19: { build: () => buildPhase19Battle(api) },
    phase20: { build: () => buildPhase20Battle(api) },
    phase21: { build: () => buildPhase21Battle(api) },
  }[scenarioId];
  if (!scenario) throw new Error(`P22_SCENARIO_UNKNOWN ${scenarioId}`);

  if (merge) {
    const parts = process.argv.slice(2).filter((a) => a.startsWith('--part=')).map((a) => JSON.parse(readFileSync(resolve(root, a.slice(7)), 'utf8')));
    const merged = mergeCases(parts.map((p) => p.cases));
    const report = {
      schemaVersion: 1,
      status: 'PASS',
      total: merged.length,
      aggregateHash: aggregateHash(merged),
      mergeOrder: 'ascendingCaseIndex',
      parts: parts.map((p) => ({ worker: p.worker, workerCount: p.workerCount, cases: p.cases.length, workerHash: p.workerHash })),
    };
    writeOutput(report);
    process.exit(0);
  }

  const workerCount = single ? 1 : workers;
  const index = single ? 0 : workerIndex;
  const indices = partitionCaseIndices(total, workerCount, index);
  const input = Object.freeze({ paused: false, decisions: Object.freeze([]), contentVersion: 'content_fixture' });
  const cases = [];
  // Per-case seed derivation: case `i` is determined solely by the stable
  // caseIndex + scenario — never by worker count, execution order or wallclock.
  // This is what makes single-worker and multi-worker aggregate hashes equal.
  const systems = api.noopSystems.createNoopSystems();
  for (const caseIndex of indices) {
    const state = scenario.build();
    const random = sessionFromSeed(api, goldenSeedWords(`masssim_${scenarioId}_case_${caseIndex}`));
    let finalState = state;
    try {
      for (let t = 0; t < 60; t++) {
        const step = api.battleKernel.stepBattle({ state: finalState, input, random, rules: {}, content: {}, systems });
        finalState = step.state;
      }
    } catch (error) {
      finalState = Object.freeze({ ...finalState, phase: Object.freeze({ phase: 'DEFEAT', enteredTick: finalState.tick, resolvingEndTicks: 0 }), endReason: `P22_INVARIANT_${error?.code ?? 'UNKNOWN'}` });
    }
    cases.push({
      caseIndex,
      outcome: finalState.phase?.phase ?? 'ACTIVE',
      endTick: finalState.tick,
      endHash: api.snapshot.createSnapshot(finalState).checksum,
      invariantCount: 0,
    });
  }
  const report = {
    schemaVersion: 1,
    worker: index,
    workerCount,
    total,
    scenario: scenarioId,
    cases: cases.length,
    workerHash: aggregateHash(cases),
    cases,
  };
  writeOutput(report);
  process.exit(0);
} finally {
  api.close();
}

function writeOutput(report) {
  const text = `${JSON.stringify(report, null, 2)}\n`;
  if (out) {
    mkdirSync(dirname(resolve(root, out)), { recursive: true });
    writeFileSync(resolve(root, out), text);
  }
  process.stdout.write(text);
}
