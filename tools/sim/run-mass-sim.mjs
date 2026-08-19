#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildRandom, loadKernel, buildBattle } from './lib/kernel-loader.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..', '..');

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  if (i >= 0 && process.argv[i + 1] !== undefined) return process.argv[i + 1];
  return fallback;
}

const battles = Number(arg('battles', '10000'));
const ticksPerBattle = Number(arg('ticks', '60'));
const phase15 = process.argv.includes('--phase15');
const phase16 = process.argv.includes('--phase16');
const phase17 = process.argv.includes('--phase17');
const phase18 = process.argv.includes('--phase18');
const phase19 = process.argv.includes('--phase19');
const out = resolve(arg('out', resolve(root, 'docs', 'reports', phase19 ? 'phase19-mass-sim.json' : phase18 ? 'phase18-mass-sim.json' : phase17 ? 'phase17-mass-sim.json' : phase16 ? 'phase16-mass-sim.json' : phase15 ? 'phase15-mass-sim.json' : 'phase14-mass-sim.json')));

const api = await loadKernel();
const { battleKernel, noopSystems, snapshot } = api;

function buildPhase15Battle(_api, simulationVersion = 'phase15-fixture-v1') {
  const { primitives, random, migrate } = api;
  const rnd = buildRandom(api);
  const entity = (id, side, lane, x100, radiusX100, maxLp = 1000) =>
    migrate.migrateEntity({ entity: { id, side, phase: Object.freeze({ phase: 'ACTIVE', enteredTick: primitives.tick(0), controlledReturn: null }), maxLp, lp: maxLp, shield: 0, lane, x100, targetId: null, timers: Object.freeze({}) }, radiusX100 });
  return Object.freeze({
    schemaVersion: 1,
    simulationVersion,
    battleId: 'battle_fixture',
    tick: primitives.tick(0),
    nextSequence: primitives.sequence(0),
    emittedEventCount: 0,
    phase: Object.freeze({ phase: 'ACTIVE', enteredTick: primitives.tick(0), resolvingEndTicks: 0 }),
    entities: Object.freeze([
      entity('unit_p1', 'player', 'middle', 2400, 100),
      entity('unit_p2', 'player', 'middle', 2660, 120),
      entity('unit_p3', 'player', 'top', 2000, 90),
      entity('unit_e1', 'enemy', 'middle', 6200, 140),
      entity('unit_e2', 'enemy', 'top', 7000, 90),
      entity('unit_e3', 'enemy', 'middle', 5800, 110),
    ]),
    scheduledEvents: Object.freeze([]),
    authoritativeStreams: rnd.streams.snapshotAuthoritative(),
    endReason: null,
  });
}

// A representative Phase 14 fixture: 3v3 entities plus one event-emitting
// system that exercises event validation, the shared sequence allocator, the
// event log and the reducer. Combat logic is Phase 15+, so remaining stages are
// explicit no-ops.
const damageEvent = {
  type: 'DamageApplied',
  sourceId: 'entity_alpha',
  targetIds: Object.freeze(['entity_delta']),
  contentIds: Object.freeze([]),
  payload: Object.freeze({
    rawAmount: 100,
    damageTypeOrdinal: 0,
    effectiveDefense: 0,
    preShieldAmount: 100,
    absorbedShield: 0,
    finalHpDelta: 100,
    hpBefore: 1000,
    hpAfter: 900,
    shieldBefore: 0,
    shieldAfter: 0,
    attackInstanceId: 1,
    effectIndex: 0,
  }),
  logTags: Object.freeze(['sim.fixture']),
};
const emitter = {
  id: 'fixture.emit', stage: 'H',
  run(c) {
    c.commands.push({ kind: 'append_event', event: damageEvent });
  },
};
// Phase 15 mode exercises the F separation/movement and K spawn/separation paths
// with a deterministic spawn + large-summon schedule on top of the Phase 14
// base fixture. Phase 14 mode stays the committed G14 evidence configuration.
const input = Object.freeze({ paused: false, decisions: Object.freeze([]), contentVersion: 'content_fixture' });
let systems;
let buildBattleFor = buildBattle;
let entityDistribution;
if (phase15) {
  const speeds = { unit_p1: 300, unit_p2: 320, unit_p3: 290, unit_e1: 290, unit_e2: 295, unit_e3: 300 };
  systems = Object.freeze(api.phase15Systems.createPhase15Systems({
    speedsX100PerSecond: speeds,
    spawnRequests: (ctx) => {
      if (ctx.state.tick === 3) return [{ kind: 'summon', reservedId: 'summon_a', side: 'player', targetLane: 'middle', radiusX100: 100, maxLp: 500, startZoneX100: 200 }];
      if (ctx.state.tick === 18) return [{ kind: 'summon', reservedId: 'summon_large', side: 'player', targetLane: 'middle', radiusX100: 160, maxLp: 2000, startZoneX100: 200, displacementPolicy: 'displace' }];
      return [];
    },
  }));
  buildBattleFor = buildPhase15Battle;
  entityDistribution = { player: 3, enemy: 3 };
} else if (phase16) {
  buildBattleFor = (_api) => buildPhase15Battle(_api, 'phase16-fixture-v1');
  const speeds = { unit_p1: 300, unit_p2: 320, unit_p3: 290, unit_e1: 290, unit_e2: 295, unit_e3: 300 };
  systems = Object.freeze(api.phase16Systems.createPhase16Systems({
    speedsX100PerSecond: speeds,
    attackPrep: {
      preferredRangeX100: Object.fromEntries(Object.keys(speeds).map((id) => [id, api.x100.asX100(2500)])),
    },
    spawnRequests: (ctx) => {
      if (ctx.state.tick === 3) return [{ kind: 'summon', reservedId: 'summon_a', side: 'player', targetLane: 'middle', radiusX100: 100, maxLp: 500, startZoneX100: 200 }];
      if (ctx.state.tick === 18) return [{ kind: 'summon', reservedId: 'summon_large', side: 'player', targetLane: 'middle', radiusX100: 160, maxLp: 2000, startZoneX100: 200, displacementPolicy: 'displace' }];
      return [];
    },
  }));
  buildBattleFor = buildPhase15Battle;
  entityDistribution = { player: 3, enemy: 3 };
} else if (phase17) {
  buildBattleFor = (_api) => buildPhase15Battle(_api, 'phase17-fixture-v1');
  const speeds = { unit_p1: 300, unit_p2: 320, unit_p3: 290, unit_e1: 290, unit_e2: 295, unit_e3: 300 };
  systems = Object.freeze(api.phase17Systems.createPhase17Systems({
    speedsX100PerSecond: speeds,
    attackPrep: {
      preferredRangeX100: Object.fromEntries(Object.keys(speeds).map((id) => [id, api.x100.asX100(2500)])),
    },
    basicAttack: {
      parameters: Object.fromEntries(
        Object.keys(speeds).map((id) => [
          id,
          {
            attackIntervalTicks: 20,
            prepareTicks: 1,
            recoveryTicks: 3,
            preferredRangeX100: api.x100.asX100(9000),
            delivery: {
              kind: 'projectile',
              speedX100PerSecond: 3000,
              homing: false,
              maxTurnX100PerTick: 0,
              expiryTicks: 60,
              lostTargetPolicy: 'impact_stored_position',
              coverIgnoring: true,
              piercing: false,
              rawAmount: 120,
              damageTypeOrdinal: 0,
              defense: 0,
              bossCapBps: null,
            },
          },
        ]),
      ),
    },
    spawnRequests: (ctx) => {
      if (ctx.state.tick === 3) return [{ kind: 'summon', reservedId: 'summon_a', side: 'player', targetLane: 'middle', radiusX100: 100, maxLp: 500, startZoneX100: 200 }];
      if (ctx.state.tick === 18) return [{ kind: 'summon', reservedId: 'summon_large', side: 'player', targetLane: 'middle', radiusX100: 160, maxLp: 2000, startZoneX100: 200, displacementPolicy: 'displace' }];
      return [];
    },
  }));
  buildBattleFor = buildPhase15Battle;
  entityDistribution = { player: 3, enemy: 3 };
} else if (phase18) {
  // Phase 18 mode: same Phase 17 combat surface plus the stage-I status
  // system with burn/poison/regeneration coefficients per battle.
  buildBattleFor = (_api) => {
    const base = buildPhase15Battle(_api, 'phase18-fixture-v1');
    const statuses = (id, kind, polarity, targetId, sourceId, effectId, stackGroup, sequence, endTick, intervalTicks, nextTick, dedupKey) =>
      Object.freeze({
        statusId: id,
        kind,
        polarity,
        targetId,
        sourceId,
        effectId,
        startTick: 0,
        endTick,
        strength: 1,
        stackGroup,
        sequence,
        stackPolicy: 'extend_duration_capped',
        maxStacks: 5,
        flags: Object.freeze([]),
        periodic: Object.freeze({ effectKind: kind, intervalTicks, nextTick, tickIndex: 0, initialTick: false, dedupKey }),
      });
    return Object.freeze({
      ...base,
      statuses: Object.freeze([
        statuses('st_burn_p1', 'burn', 'negative', 'unit_p1', 'unit_e1', 'ef_burn', 'burn', 1, 100, 10, 10, 'burn_01'),
        statuses('st_poison_e1', 'poison', 'negative', 'unit_e1', 'unit_p1', 'ef_poison', 'poison', 2, 45, 15, 15, 'poison_01'),
        statuses('st_regen_p2', 'regeneration', 'positive', 'unit_p2', 'unit_p1', 'ef_regen', 'regen', 3, 100, 20, 20, 'regen_01'),
      ]),
    });
  };
  const speeds = { unit_p1: 300, unit_p2: 320, unit_p3: 290, unit_e1: 290, unit_e2: 295, unit_e3: 300 };
  systems = Object.freeze(api.phase18Systems.createPhase18Systems({
    speedsX100PerSecond: speeds,
    status: {
      periodic: {
        burn_01: { effectKind: 'burn', amountPerTick: 50 },
        poison_01: { effectKind: 'poison', amountPerTick: 40 },
        regen_01: { effectKind: 'regeneration', amountPerTick: 25 },
      },
    },
  }));
  entityDistribution = { player: 3, enemy: 3 };
} else if (phase19) {
  // Phase 19 mode: the Phase 18 surface plus the ability-trigger framework —
  // one fireball on unit_p1 cycling tick_interval → target → cast → damage.
  const fireball = {
    config: {
      abilityId: 'ability_fireball',
      chargeTicks: null,
      cooldownTicks: 3,
      castTicks: 2,
      recoveryTicks: 1,
      interruptPolicy: 'interruptible',
      usesPerBattle: null,
      invalidTargetPolicy: 'wait',
      bossPhaseCancelAllowed: false,
    },
    trigger: { type: 'tick_interval', everyTicks: 15 },
    targetQuery: { space: 'enemy_entity', profile: 'nearest' },
    effects: (ctx) => [
      Object.freeze({
        commandId: `${ctx.abilityInstanceId}_effect_0`,
        abilityInstanceId: ctx.abilityInstanceId,
        abilityId: ctx.abilityId,
        effectIndex: 0,
        sourceId: ctx.source.sourceId,
        targetRef: Object.freeze({ kind: 'entity', entityId: ctx.target.entityId, groundKey: null, slotId: null }),
        scheduledTick: ctx.commitTick,
        stage: 'I',
        sourceSnapshot: ctx.source,
        sequence: 0,
        kind: 'damage',
        amount: 120,
      }),
    ],
  };
  buildBattleFor = (_api) => {
    const base = buildPhase15Battle(_api, 'phase19-fixture-v1');
    return Object.freeze({ ...base, abilities: Object.freeze([api.abilitySystem.createAbilityInstance(fireball.config, 'inst_fireball', 'unit_p1')]) });
  };
  const speeds = { unit_p1: 300, unit_p2: 320, unit_p3: 290, unit_e1: 290, unit_e2: 295, unit_e3: 300 };
  systems = Object.freeze(api.phase19Systems.createPhase19Systems({
    speedsX100PerSecond: speeds,
    status: {
      periodic: {
        burn_01: { effectKind: 'burn', amountPerTick: 50 },
        poison_01: { effectKind: 'poison', amountPerTick: 40 },
        regen_01: { effectKind: 'regeneration', amountPerTick: 25 },
      },
    },
    abilities: { definitions: { ability_fireball: fireball } },
  }));
  entityDistribution = { player: 3, enemy: 3 };
} else {
  systems = Object.freeze([...noopSystems.createNoopSystems(), emitter]);
  entityDistribution = { player: 3, enemy: 3 };
}

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
    const warmState = buildBattleFor(api);
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
    let state = buildBattleFor(api);
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

  // Capture the post-soak footprint before the latency sort/stringify, so the
  // end figures reflect the simulation, not the measurement pass.
  const endRss = process.memoryUsage().rss;
  const endHeap = process.memoryUsage().heapUsed;

  tickDurations.sort((a, b) => a - b);
  hashDurations.sort((a, b) => a - b);

  const report = {
    schemaVersion: 1,
    phase: phase19 ? 19 : phase18 ? 18 : phase17 ? 17 : phase16 ? 16 : phase15 ? 15 : 14,
    gate: phase19 ? 'G18' : phase18 ? 'G17' : phase17 ? 'G16' : phase16 ? 'G15' : phase15 ? 'G14' : 'G13',
    sourceRevision: process.env.SOURCE_REVISION ?? null,
    runtime: { node: process.version, platform: process.platform, arch: process.arch },
    battles,
    ticksPerBattle,
    totalTicks: tickDurations.length,
    totalEvents,
    entityDistribution,
    mode: phase19 ? 'phase19-ability-trigger' : phase18 ? 'phase18-status-periodic' : phase17 ? 'phase17-basicattack-projectile' : phase16 ? 'phase16-targeting-attackprep' : phase15 ? 'phase15-spawn-separation' : 'phase14-noop',
    warmup: 10,
    runs: 1,
    tickLatencyMs: latency(tickDurations),
    hashLatencyMs: latency(hashDurations),
    peakRssBytes: peakRss,
    peakHeapBytes: peakHeap,
    endRssBytes: endRss,
    endHeapBytes: endHeap,
    invariantErrors,
    hashDrift,
    referenceFinalHash,
    status: invariantErrors === 0 && hashDrift === 0 ? 'PASS' : 'FAIL',
  };
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
  if (report.status !== 'PASS') process.exit(1);
} finally {
  api.close();
}
