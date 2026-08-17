#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadKernel, buildBattle } from './lib/kernel-loader.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..', '..');

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  if (i >= 0 && process.argv[i + 1] !== undefined) return process.argv[i + 1];
  return fallback;
}

const battles = Number(arg('battles', '10000'));
const ticksPerBattle = Number(arg('ticks', '60'));
const out = resolve(arg('out', resolve(root, 'docs', 'reports', 'phase14-mass-sim.json')));

const api = await loadKernel();
const { battleKernel, noopSystems, snapshot } = api;

// A representative Phase 14 fixture: 3v3 entities plus one event-emitting
// system that exercises event validation, the shared sequence allocator, the
// event log and the reducer. Combat logic is Phase 15+, so remaining stages are
// explicit no-ops.
const damageEvent = {
  type: 'DamageApplied',
  sourceId: 'entity_alpha',
  targetIds: Object.freeze(['entity_delta']),
  contentIds: Object.freeze([]),
  payload: Object.freeze({ amount: 100, damageTypeOrdinal: 0 }),
  logTags: Object.freeze(['sim.fixture']),
};
const emitter = {
  id: 'fixture.emit', stage: 'H',
  run(c) {
    c.commands.push({ kind: 'append_event', event: damageEvent });
  },
};
const systems = Object.freeze([...noopSystems.createNoopSystems(), emitter]);
const input = Object.freeze({ paused: false, decisions: Object.freeze([]), contentVersion: 'content_fixture' });

function pct(sorted, p) {
  if (sorted.length === 0) return 0;
  const index = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return Number(sorted[index].toFixed(3));
}

function max(sorted) {
  if (sorted.length === 0) return 0;
  return Number(sorted[sorted.length - 1].toFixed(3));
}

function variance(sorted) {
  if (sorted.length === 0) return 0;
  const mean = sorted.reduce((a, b) => a + b, 0) / sorted.length;
  const v = sorted.reduce((a, b) => a + (b - mean) ** 2, 0) / sorted.length;
  return Number(v.toFixed(6));
}

function latency(sample) {
  return { median: pct(sample, 50), p95: pct(sample, 95), p99: pct(sample, 99), max: max(sample), variance: variance(sample) };
}

try {
  const tickDurations = [];
  const hashDurations = [];
  let totalEvents = 0;
  let invariantErrors = 0;
  let hashDrift = 0;
  let referenceFinalHash = null;

  // Warmup: prime Vite/JS JIT before measuring.
  for (let i = 0; i < 10; i++) {
    const warmState = buildBattle(api);
    const warmRandom = (() => {
      const streams = api.random.RngStreamMap.fromRunSeed(api.random.parseRunSeed(['00000001', '00000002', '00000003', '00000004']));
      return new api.random.RandomSession(streams, new api.random.RollSlotRegistry([]), false);
    })();
    for (let t = 0; t < ticksPerBattle; t++) {
      const r = battleKernel.stepBattle({ state: warmState, input, random: warmRandom, rules: {}, content: {}, systems });
      if (r.checkpoint) snapshot.createSnapshot(r.state);
    }
  }

  const startRss = process.memoryUsage().rss;
  let peakRss = startRss;
  let peakHeap = process.memoryUsage().heapUsed;

  for (let b = 0; b < battles; b++) {
    let state = buildBattle(api);
    const random = (() => {
      const streams = api.random.RngStreamMap.fromRunSeed(api.random.parseRunSeed(['00000001', '00000002', '00000003', '00000004']));
      return new api.random.RandomSession(streams, new api.random.RollSlotRegistry([]), false);
    })();
    try {
      for (let t = 0; t < ticksPerBattle; t++) {
        const t0 = process.hrtime.bigint();
        const r = battleKernel.stepBattle({ state, input, random, rules: {}, content: {}, systems });
        const tickMs = Number(process.hrtime.bigint() - t0) / 1e6;
        tickDurations.push(tickMs);
        state = r.state;
        if (r.checkpoint) {
          const h0 = process.hrtime.bigint();
          snapshot.createSnapshot(state);
          hashDurations.push(Number(process.hrtime.bigint() - h0) / 1e6);
        }
      }
      const finalHash = snapshot.createSnapshot(state).checksum;
      if (referenceFinalHash === null) referenceFinalHash = finalHash;
      else if (finalHash !== referenceFinalHash) hashDrift++;
      totalEvents += state.emittedEventCount;
    } catch (error) {
      invariantErrors++;
      if (invariantErrors <= 3) console.error(`battle ${b}: ${error?.message ?? error}`);
    }
    const mem = process.memoryUsage();
    if (mem.rss > peakRss) peakRss = mem.rss;
    if (mem.heapUsed > peakHeap) peakHeap = mem.heapUsed;
  }

  tickDurations.sort((a, b) => a - b);
  hashDurations.sort((a, b) => a - b);

  const report = {
    schemaVersion: 1,
    phase: 14,
    gate: 'G14',
    sourceRevision: process.env.SOURCE_REVISION ?? null,
    runtime: { node: process.version, platform: process.platform, arch: process.arch },
    battles,
    ticksPerBattle,
    totalTicks: tickDurations.length,
    totalEvents,
    entityDistribution: { player: 3, enemy: 3 },
    warmup: 10,
    runs: 1,
    tickLatencyMs: latency(tickDurations),
    hashLatencyMs: latency(hashDurations),
    peakRssBytes: peakRss,
    peakHeapBytes: peakHeap,
    endRssBytes: process.memoryUsage().rss,
    endHeapBytes: process.memoryUsage().heapUsed,
    invariantErrors,
    hashDrift,
    status: invariantErrors === 0 && hashDrift === 0 ? 'PASS' : 'FAIL',
  };
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
  if (report.status !== 'PASS') process.exit(1);
} finally {
  api.close();
}
