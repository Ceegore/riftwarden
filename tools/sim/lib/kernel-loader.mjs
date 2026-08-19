import { build } from 'vite';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..', '..', '..');

const ENTRY_MODULES = {
  primitives: 'src/game/sim/core/primitives.ts',
  battleKernel: 'src/game/sim/core/battle-kernel.ts',
  noopSystems: 'src/game/sim/core/noop-systems.ts',
  snapshot: 'src/game/sim/snapshot/snapshot.ts',
  random: 'src/game/sim/random/index.ts',
  events: 'src/game/sim/events/index.ts',
  migrate: 'src/game/sim/core/migrate.ts',
  phase15Systems: 'src/game/sim/core/phase15-systems.ts',
  phase16Systems: 'src/game/sim/core/phase16-systems.ts',
  phase17Systems: 'src/game/sim/core/phase17-systems.ts',
  phase18Systems: 'src/game/sim/core/phase18-systems.ts',
  phase19Systems: 'src/game/sim/core/phase19-systems.ts',
  phase20Systems: 'src/game/sim/core/phase20-systems.ts',
  phase21Systems: 'src/game/sim/core/phase21-systems.ts',
  abilitySystem: 'src/game/sim/ability/ability-system.ts',
  x100: 'src/game/sim/geometry/x100.ts',
  monitor: 'src/game/sim/monitor/invariant-monitor.ts',
};

/**
 * Loads the sim kernel by bundling it with Vite's SSR build (Rolldown) into a
 * temp directory and importing the resulting ESM chunks. This avoids the
 * dev-server module runner, whose WebSocket transport deadlocks on the kernel's
 * transitive import graph when running headless; the kernel uses only relative
 * imports, so no aliases or plugins are needed.
 */
export async function loadKernel() {
  const outDir = mkdtempSync(join(tmpdir(), 'p14-kernel-'));
  const input = Object.fromEntries(Object.entries(ENTRY_MODULES).map(([name, path]) => [name, resolve(root, path)]));
  const result = await build({
    configFile: false,
    logLevel: 'error',
    build: {
      ssr: true,
      write: false,
      minify: false,
      target: 'node18',
      rollupOptions: {
        input,
        output: { format: 'esm', entryFileNames: '[name].mjs', chunkFileNames: '[name]-[hash].mjs' },
      },
    },
  });
  const outputs = (Array.isArray(result) ? result : [result]).flatMap((r) => r.output);
  for (const chunk of outputs) {
    if (chunk.type === 'chunk') writeFileSync(join(outDir, chunk.fileName), chunk.code);
  }
  const loaded = {};
  for (const name of Object.keys(ENTRY_MODULES)) {
    loaded[name] = await import(pathToFileURL(join(outDir, `${name}.mjs`)).href);
  }
  return {
    ...loaded,
    close() {
      rmSync(outDir, { recursive: true, force: true });
    },
  };
}

/** Builds a RandomSession with the canonical Phase 14 fixture seed. */
export function buildRandom({ random }) {
  const streams = random.RngStreamMap.fromRunSeed(random.parseRunSeed(['00000001', '00000002', '00000003', '00000004']));
  return new random.RandomSession(streams, new random.RollSlotRegistry([]), false);
}

/** Builds a Phase 14 fixture entity. */
export function buildEntity({ primitives }, id, side, x100) {
  return Object.freeze({
    id,
    side,
    phase: Object.freeze({ phase: 'ACTIVE', enteredTick: primitives.tick(0), controlledReturn: null }),
    maxLp: 1000,
    lp: 1000,
    shield: 0,
    lane: 'middle',
    x100,
    targetId: null,
    timers: Object.freeze({}),
  });
}

/** Builds a PREPARED battle model like the vitest test-helpers fixture. */
export function buildBattle(api, overrides = {}) {
  const { primitives } = api;
  const rnd = buildRandom(api);
  const entities = [
    buildEntity(api, 'entity_alpha', 'player', 1800),
    buildEntity(api, 'entity_beta', 'player', 2400),
    buildEntity(api, 'entity_gamma', 'player', 3000),
    buildEntity(api, 'entity_delta', 'enemy', 6200),
    buildEntity(api, 'entity_epsilon', 'enemy', 7600),
    buildEntity(api, 'entity_zeta', 'enemy', 8200),
  ];
  return Object.freeze({
    schemaVersion: 1,
    simulationVersion: 'phase14-fixture-v1',
    battleId: 'battle_fixture',
    tick: primitives.tick(0),
    nextSequence: primitives.sequence(0),
    emittedEventCount: 0,
    phase: Object.freeze({ phase: 'ACTIVE', enteredTick: primitives.tick(0), resolvingEndTicks: 0 }),
    entities: Object.freeze(entities),
    scheduledEvents: Object.freeze([]),
    authoritativeStreams: rnd.streams.snapshotAuthoritative(),
    endReason: null,
    ...overrides,
  });
}

/** The 60-tick canonical trace setup that matches tests/sim/fixtures/reference-traces.json. */
export function buildReferenceBattle(api) {
  return buildBattle(api, {
    entities: Object.freeze([buildEntity(api, 'entity_alpha', 'player', 1800)]),
    battleId: 'battle_fixture',
    simulationVersion: 'phase14-fixture-v1',
  });
}

/** Runs the canonical 60-tick trace and returns its hashes (the Node reference column). */
export function runNodeReferenceTrace(api) {
  const { battleKernel, noopSystems, snapshot } = api;
  const input = Object.freeze({ paused: false, decisions: Object.freeze([]), contentVersion: 'content_fixture' });
  let state = buildReferenceBattle(api);
  const startHash = snapshot.createSnapshot(state).checksum;
  const random = buildRandom(api);
  const checkpoints = [];
  for (let i = 0; i < 60; i++) {
    const r = battleKernel.stepBattle({ state, input, random, rules: {}, content: {}, systems: noopSystems.createNoopSystems() });
    state = r.state;
    if (r.checkpoint) checkpoints.push({ tick: state.tick, checksum: r.checkpoint.checksum });
  }
  return {
    startHash,
    tick30: checkpoints.find((c) => c.tick === 30)?.checksum ?? null,
    tick60: checkpoints.find((c) => c.tick === 60)?.checksum ?? null,
    endHash: snapshot.createSnapshot(state).checksum,
    endTick: state.tick,
    endReason: state.endReason,
    eventCount: state.emittedEventCount,
  };
}

/**
 * Builds the Phase 15 60-tick reference battle: migrated entities, Phase 15
 * systems (movement/lane-change/anti-stuck active), matching
 * tests/sim/fixtures/reference-traces-phase15.json exactly.
 */
export function buildPhase15Battle(api) {
  const { migrate, primitives } = api;
  const mk = (id, side, x100, lane, radius) =>
    migrate.migrateEntity({
      entity: Object.freeze({
        id,
        side,
        phase: Object.freeze({ phase: 'ACTIVE', enteredTick: primitives.tick(0), controlledReturn: null }),
        maxLp: 1000,
        lp: 1000,
        shield: 0,
        lane,
        x100,
        targetId: null,
        timers: Object.freeze({}),
      }),
      radiusX100: radius,
    });
  const entities = [
    mk('unit_player_a', 'player', 1800, 'top', 100),
    mk('unit_player_b', 'player', 2400, 'middle', 120),
    mk('unit_enemy_a', 'enemy', 6200, 'middle', 140),
    mk('unit_enemy_b', 'enemy', 7600, 'bottom', 150),
  ];
  const rnd = buildRandom(api);
  return Object.freeze({
    schemaVersion: 1,
    simulationVersion: 'phase15-fixture-v1',
    battleId: 'battle_fixture',
    tick: primitives.tick(0),
    nextSequence: primitives.sequence(0),
    emittedEventCount: 0,
    phase: Object.freeze({ phase: 'ACTIVE', enteredTick: primitives.tick(0), resolvingEndTicks: 0 }),
    entities: Object.freeze(entities),
    scheduledEvents: Object.freeze([]),
    authoritativeStreams: rnd.streams.snapshotAuthoritative(),
    endReason: null,
  });
}

/** Runs the Phase 15 60-tick trace and returns its hashes (the P15 Node reference column). */
export function runNodePhase15ReferenceTrace(api) {
  const { battleKernel, phase15Systems, snapshot } = api;
  const input = Object.freeze({ paused: false, decisions: Object.freeze([]), contentVersion: 'content_fixture' });
  let state = buildPhase15Battle(api);
  const startHash = snapshot.createSnapshot(state).checksum;
  const random = buildRandom(api);
  const systems = phase15Systems.createPhase15Systems({ speedsX100PerSecond: { unit_player_a: 305, unit_player_b: 300 } });
  const checkpoints = [];
  let callOrder = [];
  for (let i = 0; i < 60; i++) {
    const r = battleKernel.stepBattle({ state, input, random, rules: {}, content: {}, systems });
    state = r.state;
    if (i === 0) callOrder = [...r.callOrder];
    if (r.checkpoint) checkpoints.push({ tick: state.tick, checksum: r.checkpoint.checksum });
  }
  return {
    startHash,
    tick30: checkpoints.find((c) => c.tick === 30)?.checksum ?? null,
    tick60: checkpoints.find((c) => c.tick === 60)?.checksum ?? null,
    endHash: snapshot.createSnapshot(state).checksum,
    endTick: state.tick,
    endReason: state.endReason,
    eventCount: state.emittedEventCount,
    callOrder,
  };
}

/**
 * Builds the Phase 16 60-tick reference battle: migrated entities with the
 * Phase 16 additive fields, targeting (stage E) and attack-prep (stage G)
 * active, matching tests/sim/fixtures/reference-traces-phase16.json exactly.
 */
export function buildPhase16Battle(api) {
  const { migrate, primitives } = api;
  const mk = (id, side, x100, lane, radius) =>
    migrate.migrateEntity({
      entity: Object.freeze({
        id,
        side,
        phase: Object.freeze({ phase: 'ACTIVE', enteredTick: primitives.tick(0), controlledReturn: null }),
        maxLp: 1000,
        lp: 1000,
        shield: 0,
        lane,
        x100,
        targetId: null,
        timers: Object.freeze({}),
      }),
      radiusX100: radius,
    });
  const entities = [
    mk('unit_player_a', 'player', 1800, 'top', 100),
    mk('unit_player_b', 'player', 2400, 'middle', 120),
    mk('unit_enemy_a', 'enemy', 6200, 'middle', 140),
    mk('unit_enemy_b', 'enemy', 7600, 'bottom', 150),
  ];
  const rnd = buildRandom(api);
  return Object.freeze({
    schemaVersion: 1,
    simulationVersion: 'phase16-fixture-v1',
    battleId: 'battle_fixture',
    tick: primitives.tick(0),
    nextSequence: primitives.sequence(0),
    emittedEventCount: 0,
    phase: Object.freeze({ phase: 'ACTIVE', enteredTick: primitives.tick(0), resolvingEndTicks: 0 }),
    entities: Object.freeze(entities),
    scheduledEvents: Object.freeze([]),
    authoritativeStreams: rnd.streams.snapshotAuthoritative(),
    endReason: null,
  });
}

/**
 * Builds the Phase 17 60-tick reference battle: migrated entities with the
 * Phase 17 basic-attack lifecycle (projectile delivery), matching
 * tests/sim/fixtures/reference-traces-phase17.json exactly.
 */
export function buildPhase17Battle(api) {
  const { migrate, primitives } = api;
  const mk = (id, side, x100, lane, radius) =>
    migrate.migrateEntity({
      entity: Object.freeze({
        id,
        side,
        phase: Object.freeze({ phase: 'ACTIVE', enteredTick: primitives.tick(0), controlledReturn: null }),
        maxLp: 1000,
        lp: 1000,
        shield: 0,
        lane,
        x100,
        targetId: null,
        timers: Object.freeze({}),
      }),
      radiusX100: radius,
    });
  const entities = [
    mk('unit_player_a', 'player', 1800, 'top', 100),
    mk('unit_player_b', 'player', 2400, 'middle', 120),
    mk('unit_enemy_a', 'enemy', 6200, 'middle', 140),
    mk('unit_enemy_b', 'enemy', 7600, 'bottom', 150),
  ];
  const rnd = buildRandom(api);
  return Object.freeze({
    schemaVersion: 1,
    simulationVersion: 'phase17-fixture-v1',
    battleId: 'battle_fixture',
    tick: primitives.tick(0),
    nextSequence: primitives.sequence(0),
    emittedEventCount: 0,
    phase: Object.freeze({ phase: 'ACTIVE', enteredTick: primitives.tick(0), resolvingEndTicks: 0 }),
    entities: Object.freeze(entities),
    scheduledEvents: Object.freeze([]),
    authoritativeStreams: rnd.streams.snapshotAuthoritative(),
    endReason: null,
  });
}

/** Runs the Phase 17 60-tick trace and returns its hashes (the P17 Node reference column). */
export function runNodePhase17ReferenceTrace(api) {
  const { battleKernel, phase17Systems, snapshot, x100 } = api;
  const input = Object.freeze({ paused: false, decisions: Object.freeze([]), contentVersion: 'content_fixture' });
  let state = buildPhase17Battle(api);
  const startHash = snapshot.createSnapshot(state).checksum;
  const random = buildRandom(api);
  const systems = phase17Systems.createPhase17Systems({
    speedsX100PerSecond: { unit_player_a: 305, unit_player_b: 300 },
    attackPrep: {
      preferredRangeX100: {
        unit_player_a: x100.asX100(5000),
        unit_player_b: x100.asX100(4000),
      },
    },
    basicAttack: {
      parameters: {
        unit_player_a: {
          attackIntervalTicks: 40,
          prepareTicks: 1,
          recoveryTicks: 3,
          preferredRangeX100: x100.asX100(9000),
          delivery: {
            kind: 'projectile',
            speedX100PerSecond: 3000,
            homing: false,
            maxTurnX100PerTick: 0,
            expiryTicks: 60,
            lostTargetPolicy: 'impact_stored_position',
            coverIgnoring: true,
            piercing: false,
            rawAmount: 100,
            damageTypeOrdinal: 0,
            defense: 0,
            bossCapBps: null,
          },
        },
      },
    },
  });
  const checkpoints = [];
  let callOrder = [];
  for (let i = 0; i < 60; i++) {
    const r = battleKernel.stepBattle({ state, input, random, rules: {}, content: {}, systems });
    state = r.state;
    if (i === 0) callOrder = [...r.callOrder];
    if (r.checkpoint) checkpoints.push({ tick: state.tick, checksum: r.checkpoint.checksum });
  }
  return {
    startHash,
    tick30: checkpoints.find((c) => c.tick === 30)?.checksum ?? null,
    tick60: checkpoints.find((c) => c.tick === 60)?.checksum ?? null,
    endHash: snapshot.createSnapshot(state).checksum,
    endTick: state.tick,
    endReason: state.endReason,
    eventCount: state.emittedEventCount,
    callOrder,
  };
}

/**
 * Builds the Phase 17 stage J/L reference battle: lethal basic attack (direct
 * delivery) on a battle seeded at tick 2680 so defeats (stage J) and the
 * rift-collapse window + Chapter-76 resolution (stage L) both fire, matching
 * tests/sim/fixtures/reference-traces-phase17jl.json exactly.
 */
export function buildPhase17JLBattle(api) {
  const { migrate, primitives } = api;
  const mk = (id, side, x100, lane, lp) =>
    migrate.migrateEntity({
      entity: Object.freeze({
        id,
        side,
        phase: Object.freeze({ phase: 'ACTIVE', enteredTick: primitives.tick(0), controlledReturn: null }),
        maxLp: 1000,
        lp,
        shield: 0,
        lane,
        x100,
        targetId: null,
        timers: Object.freeze({}),
      }),
      radiusX100: 100,
    });
  const entities = [
    mk('unit_player_a', 'player', 1800, 'top', 1000),
    mk('unit_player_b', 'player', 2400, 'middle', 1000),
    mk('unit_enemy_a', 'enemy', 6200, 'middle', 500),
    mk('unit_enemy_b', 'enemy', 7600, 'bottom', 400),
  ];
  const rnd = buildRandom(api);
  return Object.freeze({
    schemaVersion: 1,
    simulationVersion: 'phase17jl-fixture-v1',
    battleId: 'battle_fixture',
    tick: primitives.tick(2680),
    nextSequence: primitives.sequence(0),
    emittedEventCount: 0,
    phase: Object.freeze({ phase: 'ACTIVE', enteredTick: primitives.tick(0), resolvingEndTicks: 0 }),
    entities: Object.freeze(entities),
    scheduledEvents: Object.freeze([]),
    authoritativeStreams: rnd.streams.snapshotAuthoritative(),
    endReason: null,
  });
}

/** Runs the Phase 17 stage J/L trace to its terminal outcome (the P17-JL Node reference column). */
export function runNodePhase17JLReferenceTrace(api) {
  const { battleKernel, phase17Systems, snapshot, x100 } = api;
  const input = Object.freeze({ paused: false, decisions: Object.freeze([]), contentVersion: 'content_fixture' });
  let state = buildPhase17JLBattle(api);
  const startHash = snapshot.createSnapshot(state).checksum;
  const random = buildRandom(api);
  const systems = phase17Systems.createPhase17Systems({
    speedsX100PerSecond: {},
    basicAttack: {
      parameters: {
        unit_player_a: {
          attackIntervalTicks: 10,
          prepareTicks: 1,
          recoveryTicks: 3,
          preferredRangeX100: x100.asX100(9000),
          delivery: { kind: 'direct', rawAmount: 400, damageTypeOrdinal: 0, defense: 0, bossCapBps: null },
        },
      },
    },
  });
  const checkpoints = [];
  let callOrder = [];
  let terminal = false;
  for (let i = 0; i < 500; i++) {
    const r = battleKernel.stepBattle({ state, input, random, rules: {}, content: {}, systems });
    state = r.state;
    if (i === 0) callOrder = [...r.callOrder];
    if (r.checkpoint) checkpoints.push({ tick: state.tick, checksum: r.checkpoint.checksum });
    if (['VICTORY', 'DEFEAT', 'DRAW_ABORT'].includes(state.phase.phase)) { terminal = true; break; }
  }
  return {
    startHash,
    tick30: checkpoints.find((c) => c.tick === 2700)?.checksum ?? null,
    tick60: checkpoints.find((c) => c.tick === 2880)?.checksum ?? null,
    endHash: snapshot.createSnapshot(state).checksum,
    endTick: state.tick,
    endReason: state.endReason,
    eventCount: state.emittedEventCount,
    terminal,
    callOrder,
  };
}

/** Runs the Phase 16 60-tick trace and returns its hashes (the P16 Node reference column). */
export function runNodePhase16ReferenceTrace(api) {
  const { battleKernel, phase16Systems, snapshot, x100 } = api;
  const input = Object.freeze({ paused: false, decisions: Object.freeze([]), contentVersion: 'content_fixture' });
  let state = buildPhase16Battle(api);
  const startHash = snapshot.createSnapshot(state).checksum;
  const random = buildRandom(api);
  const systems = phase16Systems.createPhase16Systems({
    speedsX100PerSecond: { unit_player_a: 305, unit_player_b: 300 },
    attackPrep: {
      preferredRangeX100: {
        unit_player_a: x100.asX100(5000),
        unit_player_b: x100.asX100(4000),
      },
    },
  });
  const checkpoints = [];
  let callOrder = [];
  for (let i = 0; i < 60; i++) {
    const r = battleKernel.stepBattle({ state, input, random, rules: {}, content: {}, systems });
    state = r.state;
    if (i === 0) callOrder = [...r.callOrder];
    if (r.checkpoint) checkpoints.push({ tick: state.tick, checksum: r.checkpoint.checksum });
  }
  return {
    startHash,
    tick30: checkpoints.find((c) => c.tick === 30)?.checksum ?? null,
    tick60: checkpoints.find((c) => c.tick === 60)?.checksum ?? null,
    endHash: snapshot.createSnapshot(state).checksum,
    endTick: state.tick,
    endReason: state.endReason,
    eventCount: state.emittedEventCount,
    callOrder,
  };
}
