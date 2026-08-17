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
};

/**
 * Loads the Phase 14 sim kernel by bundling it with Vite's SSR build (Rolldown)
 * into a temp directory and importing the resulting ESM chunks. This avoids the
 * dev-server module runner, whose WebSocket transport deadlocks on the kernel's
 * transitive import graph when running headless. `configFile: false` skips the
 * app build-config env requirements; the kernel uses only relative imports, so
 * no aliases or plugins are needed.
 */
export async function loadKernel() {
  const outDir = mkdtempSync(join(tmpdir(), 'p14-kernel-'));
  const input = Object.fromEntries(
    Object.entries(ENTRY_MODULES).map(([name, path]) => [name, resolve(root, path)]),
  );
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
