import { describe, expect, it } from 'vitest';
import { stepBattle } from '../../src/game/sim/core/battle-kernel.js';
import { migrateEntity } from '../../src/game/sim/core/migrate.js';
import { createPhase17Systems } from '../../src/game/sim/core/phase17-systems.js';
import { createPhase21Systems } from '../../src/game/sim/core/phase21-systems.js';
import { createSnapshot } from '../../src/game/sim/snapshot/snapshot.js';
import { GLOBAL_NO_PROGRESS_WARNING_TICKS } from '../../src/game/sim/anti-stuck/anti-stuck.js';
import type { PhaseDefinition } from '../../src/game/sim/boss/boss-phase-system.js';
import type { KernelSystem } from '../../src/game/sim/core/tick-context.js';
import type { TickInput } from '../../src/game/sim/core/tick-input.js';
import type { BattleModel } from '../../src/game/sim/core/battle-model.js';
import type { Wave, ReinforcementBody } from '../../src/game/sim/world/reinforcement-system.js';
import { battle, entity, randomSession } from './test-helpers.js';

/**
 * Phase 21 §8/§9.4/§10 wave × boss-phase interplay fuzz.
 *
 * ONE battle carries reinforcement waves AND a boss that descends across its
 * HP: wave bodies spawn and reset the §9.4 no-progress endcap while the boss
 * sits inside its committed invulnerable window. Contract:
 *   1. WAVES SPAWN ON SCHEDULE DURING THE WINDOW — a wave scheduled INSIDE the
 *      boss's invulnerable window spawns its bodies exactly at its scheduled
 *      tick (the window gates boss damage, never world spawns), and a damage
 *      hit at that same tick is immune (0 HP delta).
 *   2. ENDCAP SILENT — every committed wave that spawns bodies is §9.4
 *      qualifying progress, so across 1100+ ticks (far past the 300+300
 *      no-progress window) the global counter never warns, `riftCollapseTicks`
 *      stays 0 and no `RiftCollapseEndRequest` fires.
 *   3. DESCENT UNIMPEDED — the boss still descends p1→p2 across its HP while
 *      the waves flow (the wave cursor never disturbs the phase authority).
 *   4. EXACT TICKS — each wave commits at its scheduled tick, never late
 *      (a blocked spawn would surface as a delayed `ReinforcementSpawned`).
 *   5. DETERMINISM — two identical runs produce the identical checksum and
 *      spawn trace.
 */

const input: TickInput = Object.freeze({ paused: false, decisions: Object.freeze([]), contentVersion: 'content_fixture' });
const BOSS_ID = 'boss_ash_unit';
const BOSS_MAX_LP = 4000;
const DESCENT_TICK = 40;
const DESCENT_PERMILLE = 625;
const HARD_LIMIT = 1100;
const WAVE_GAP = 200;

const defs: readonly PhaseDefinition[] = Object.freeze([
  Object.freeze({ id: 'p1', bossId: BOSS_ID, priority: 1, minHpPermille: 751, maxHpPermille: 1001, previewKey: 'preview_p1' }),
  Object.freeze({ id: 'p2', bossId: BOSS_ID, priority: 2, minHpPermille: 501, maxHpPermille: 751, previewKey: 'preview_p2', transitionTicks: 8, invulnerableTicks: 9 }),
  Object.freeze({ id: 'p3', bossId: BOSS_ID, priority: 3, minHpPermille: 0, maxHpPermille: 501, previewKey: 'preview_p3', transitionTicks: 8 }),
]);

function buildSystems(waves?: readonly Wave[]): readonly KernelSystem[] {
  return Object.freeze([
    ...createPhase17Systems({ speedsX100PerSecond: {} }),
    ...createPhase21Systems({
      bossPhaseDefinitions: defs,
      ...(waves === undefined ? {} : { waves, spawnBodies }),
    }),
  ]);
}

/** §8 content resolver: every wave body matches the wave's fixed spawn order. */
const spawnBodies = (wave: Wave): readonly ReinforcementBody[] => Object.freeze(
  wave.entityIds.map((entityId, i) => Object.freeze({
    entityId,
    lane: 'middle',
    x100: 6200 + i * 300,
    radiusX100: 80,
    maxLp: 500,
  })),
);

function buildBattle(): BattleModel {
  const player = migrateEntity({ entity: entity('unit_p', { side: 'player', lane: 'middle', x100: 1800, maxLp: 1000, lp: 1000 }), radiusX100: 100 });
  const boss = migrateEntity({ entity: entity(BOSS_ID, { side: 'enemy', lane: 'middle', x100: 7000, maxLp: BOSS_MAX_LP, lp: BOSS_MAX_LP }), radiusX100: 120 });
  return battle({
    simulationVersion: 'phase21-wave-phase-interplay-v1',
    entities: Object.freeze([player, boss]),
    abilities: Object.freeze([]),
    bossPhase: Object.freeze({ entityId: BOSS_ID, bossId: BOSS_ID, phaseId: 'p1', transition: null, visited: Object.freeze(['p1']), invulnerableUntilTick: null }),
  });
}

function queueDescent(state: BattleModel, instance: number): BattleModel {
  const boss = state.entities.find((e) => e.id === BOSS_ID);
  if (boss === undefined) throw new Error('boss missing');
  const targetLp = Math.max(1, Math.floor((boss.maxLp * DESCENT_PERMILLE) / 1000));
  const amount = boss.lp - targetLp;
  if (amount <= 0) throw new Error('descent damage must be positive');
  return Object.freeze({
    ...state,
    pendingCombatApplications: Object.freeze([
      Object.freeze({ kind: 'damage', sourceId: 'unit_p', targetId: BOSS_ID, effectId: `ef_desc_${String(instance)}`, attackInstanceId: instance, effectIndex: 0, rawAmount: amount, damageTypeOrdinal: 0, defense: 0, coverReductionBps: 0, bossCapBps: null }),
    ]),
  });
}

function queueImmuneProbe(state: BattleModel): BattleModel {
  return Object.freeze({
    ...state,
    pendingCombatApplications: Object.freeze([
      Object.freeze({ kind: 'damage', sourceId: 'unit_p', targetId: BOSS_ID, effectId: 'ef_probe', attackInstanceId: 999, effectIndex: 0, rawAmount: 250, damageTypeOrdinal: 0, defense: 0, coverReductionBps: 0, bossCapBps: null }),
    ]),
  });
}

interface ProbeResult {
  readonly commitTick: number;
  readonly invulnerableUntilTick: number;
}

/** Dry run (no waves) to calibrate the boss's committed invulnerable window. */
function probe(): ProbeResult {
  const systems = buildSystems();
  let state = buildBattle();
  const random = randomSession();
  let commitTick = -1;
  let invulnerableUntilTick = -1;
  for (let t = 0; t < 200; t++) {
    if (t === DESCENT_TICK) state = queueDescent(state, t);
    const r = stepBattle({ state, input, random, rules: {}, content: {}, systems });
    state = r.state;
    for (const event of r.events) {
      if (event.type === 'BossPhaseStarted' && event.contentIds.includes('p2')) {
        commitTick = state.tick;
        invulnerableUntilTick = state.bossPhase?.invulnerableUntilTick ?? -1;
      }
    }
    if (state.bossPhase?.phaseId === 'p2' && commitTick > 0) break;
  }
  if (commitTick < 0 || invulnerableUntilTick < 0) throw new Error('p2 never committed in probe');
  return { commitTick, invulnerableUntilTick };
}

interface RunResult {
  readonly spawns: readonly (readonly [string, number])[];
  readonly wave2BodyPresent: boolean;
  readonly immuneProbeDelta: number;
  readonly visited: readonly string[];
  readonly collapseRequests: number;
  readonly maxNoProgressTicks: number;
  readonly checksum: string;
}

function run(waves: readonly Wave[]): RunResult {
  const systems = buildSystems(waves);
  let state = buildBattle();
  const random = randomSession();
  const spawns: [string, number][] = [];
  const spawnById = new Map(waves.map((w) => [w.id, w.scheduledTick] as const));
  const wave2Id = waves[1]?.id ?? '';
  const wave2Tick = spawnById.get(wave2Id) ?? -1;
  let wave2BodyPresent = false;
  const immuneDeltas: number[] = [];
  let collapseRequests = 0;
  let maxNoProgressTicks = 0;
  for (let t = 0; t < HARD_LIMIT; t++) {
    if (t === DESCENT_TICK) state = queueDescent(state, t);
    // Probe the boss's invulnerability exactly on the wave-2 spawn tick.
    if (t === wave2Tick) state = queueImmuneProbe(state);
    const r = stepBattle({ state, input, random, rules: {}, content: {}, systems });
    state = r.state;
    for (const event of r.events) {
      if (event.type === 'ReinforcementSpawned') {
        const waveId = event.targetIds[0] ?? '';
        spawns.push([waveId, state.tick]);
      }
      if (event.type === 'DamageApplied' && event.sourceId === 'unit_p' && event.contentIds.includes('ef_probe')) {
        immuneDeltas.push(event.payload['finalHpDelta'] ?? -1);
      }
      if (event.type === 'RiftCollapseEndRequest') collapseRequests += 1;
    }
    maxNoProgressTicks = Math.max(maxNoProgressTicks, state.globalNoProgressTicks ?? 0);
    if (state.tick === wave2Tick + 1) {
      wave2BodyPresent = state.entities.some((e) => e.id === 'unit_w2a');
    }
  }
  return {
    spawns: Object.freeze(spawns),
    wave2BodyPresent,
    immuneProbeDelta: immuneDeltas[0] ?? -1,
    visited: Object.freeze([...(state.bossPhase?.visited ?? [])]),
    collapseRequests,
    maxNoProgressTicks,
    checksum: createSnapshot(state).checksum,
  };
}

describe('P21 §8/§9.4/§10 wave × boss-phase interplay', () => {
  it('spawns waves inside the boss invulnerable window, keeps the endcap silent and descends the boss', { timeout: 120_000 }, () => {
    const { commitTick, invulnerableUntilTick } = probe();
    // Wave 2 lands INSIDE the committed invulnerable window [commit, until):
    // strictly after the commit tick and before the window elapses.
    const wave2Tick = invulnerableUntilTick - 3;
    expect(wave2Tick).toBeGreaterThan(commitTick);
    expect(wave2Tick).toBeLessThan(invulnerableUntilTick);

    // Waves before, inside and after the window; then every 200 ticks so the
    // §9.4 endcap (300 no-progress + 300 resolve) can never complete.
    const waves: Wave[] = [
      Object.freeze({ id: 'wave_a', scheduledTick: 20, side: 'enemy', entityIds: Object.freeze(['unit_w1a', 'unit_w1b']), spawnProfile: 'profile_grunt', capPolicy: 'BLOCK' }),
      Object.freeze({ id: 'wave_b', scheduledTick: wave2Tick, side: 'enemy', entityIds: Object.freeze(['unit_w2a', 'unit_w2b']), spawnProfile: 'profile_grunt', capPolicy: 'BLOCK' }),
    ];
    for (let tick = wave2Tick + WAVE_GAP; tick < HARD_LIMIT; tick += WAVE_GAP) {
      const index = waves.length + 1; // body ids must stay unique per wave
      waves.push(Object.freeze({
        id: `wave_c${String(index)}`,
        scheduledTick: tick,
        side: 'enemy',
        entityIds: Object.freeze([`unit_w${index}a`, `unit_w${index}b`]),
        spawnProfile: 'profile_grunt',
        capPolicy: 'BLOCK',
      }));
    }
    const frozenWaves = Object.freeze(waves);

    const a = run(frozenWaves);
    const b = run(frozenWaves);

    // 5. DETERMINISM.
    expect(b.checksum).toBe(a.checksum);
    expect(b.spawns).toEqual(a.spawns);

    // 1. WAVES SPAWN ON SCHEDULE DURING THE WINDOW: every wave's
    // ReinforcementSpawned is observed exactly one tick after its scheduled
    // tick (never delayed), including the one inside the invulnerable window,
    // and its bodies are present at that tick.
    const spawnByWave = new Map<string, number>();
    for (const [waveId, observedTick] of a.spawns) spawnByWave.set(waveId, observedTick);
    expect(spawnByWave.size).toBe(frozenWaves.length);
    for (const wave of frozenWaves) {
      const observed = spawnByWave.get(wave.id);
      expect(observed, `wave ${wave.id} exact spawn`).toBe(wave.scheduledTick + 1);
    }
    expect(a.wave2BodyPresent).toBe(true);
    // The probe hit at the wave-2 tick was IMMUNE (boss inside its window).
    expect(a.immuneProbeDelta).toBe(0);

    // 2. ENDCAP SILENT across 1100 ticks: the warning threshold is never
    // reached and no RiftCollapseEndRequest fires.
    expect(a.collapseRequests).toBe(0);
    expect(a.maxNoProgressTicks).toBeLessThan(GLOBAL_NO_PROGRESS_WARNING_TICKS);

    // 3. DESCENT UNIMPEDED: the boss still descended p1→p2 while waves flowed.
    expect(a.visited).toEqual(['p1', 'p2']);
  });
});
