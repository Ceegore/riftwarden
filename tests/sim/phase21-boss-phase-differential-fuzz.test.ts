import { describe, expect, it } from 'vitest';
import { stepBattle } from '../../src/game/sim/core/battle-kernel.js';
import { migrateEntity } from '../../src/game/sim/core/migrate.js';
import { createPhase17Systems } from '../../src/game/sim/core/phase17-systems.js';
import { createPhase19Systems } from '../../src/game/sim/core/phase19-systems.js';
import { createPhase20Systems } from '../../src/game/sim/core/phase20-systems.js';
import { createPhase21Systems, type Phase21RuntimeConfig } from '../../src/game/sim/core/phase21-systems.js';
import { createAbilityInstance } from '../../src/game/sim/ability/ability-system.js';
import { createSnapshot } from '../../src/game/sim/snapshot/snapshot.js';
import {
  commitTransition, createBossPhaseSnapshot, detectTransition, phaseInvulnerableTicks,
  validateBossPhases, type BossPhaseState, type BossPhaseSnapshot, type PhaseDefinition,
} from '../../src/game/sim/boss/boss-phase-system.js';
import type { AbilityRuntimeDefinition } from '../../src/game/sim/ability/ability-runtime.js';
import type { EffectCommand } from '../../src/game/sim/ability/effect-command.js';
import type { KernelSystem } from '../../src/game/sim/core/tick-context.js';
import type { TickInput } from '../../src/game/sim/core/tick-input.js';
import type { BattleModel } from '../../src/game/sim/core/battle-model.js';
import { asciiCompare } from '../../src/game/sim/core/primitives.js';
import { battle, entity, randomSession } from './test-helpers.js';

/**
 * Phase 21 §4–§5 boss-phase differential fuzz. Two layers:
 *
 * 1. Pure level: random valid phase definition sets + random monotone HP walks
 *    are driven through detectTransition/commitTransition, asserting the §5
 *    invariants: detection is idempotent and range-valid, a planned transition
 *    commits exactly once at its inclusive commit tick, visited never repeats,
 *    and a locked phase never plans. Corrupted sets must always be flagged by
 *    validateBossPhases (gaps, overlaps, ambiguity).
 * 2. Kernel level: a real battle with fireballs driving the boss HP down is
 *    stepped; an oracle that replays the pure detect/commit functions against
 *    the same per-tick HP must produce a bossPhase state byte-identical to the
 *    kernel's every tick, across several seeds (invulnerability included).
 */

/** Deterministic 32-bit PRNG (mulberry32) for value generation. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PHASE_IDS: readonly string[] = ['phase_a', 'phase_b', 'phase_c', 'phase_d'];

/**
 * Builds a valid, fully-covering phase set: the HP range [0,1001) is split
 * into `count` contiguous intervals (entry phase covers full HP), with
 * distinct priorities, stable ids, preview keys and bounded invulnerability.
 */
function randomPhaseSet(rand: () => number, count: number): readonly PhaseDefinition[] {
  // Pick count-1 cut points in (0, 1001), ascending.
  const cuts = new Set<number>();
  while (cuts.size < count - 1) cuts.add(1 + Math.floor(rand() * 1000));
  const sorted = [...cuts].sort((a, b) => a - b);
  const bounds = [0, ...sorted, 1001];
  const ids = [...PHASE_IDS].sort(() => rand() - 0.5);
  return Object.freeze(
    Array.from({ length: count }, (_, i) => {
      const min = bounds[i] ?? 0;
      const max = bounds[i + 1] ?? 1001;
      const id = ids[i] ?? `phase_${String(i)}`;
      return Object.freeze({
        id,
        bossId: 'boss_ash',
        priority: count - i,
        minHpPermille: min,
        maxHpPermille: max,
        previewKey: `preview_${id}`,
        ...(rand() < 0.5 ? { transitionTicks: 1 + Math.floor(rand() * 40) } : {}),
        ...(rand() < 0.4 ? { invulnerableTicks: Math.floor(rand() * 45) } : {}),
        ...(i === 0 && rand() < 0.25 ? { transitionLocked: true } : {}),
      } as PhaseDefinition);
    }),
  );
}

/** Random monotone (non-increasing) HP walk in permille. */
function randomHpWalk(rand: () => number, steps: number): readonly number[] {
  const out: number[] = [];
  let hp = 1000;
  for (let i = 0; i < steps; i++) {
    hp = Math.max(0, hp - Math.floor(rand() * 60));
    out.push(hp);
  }
  return Object.freeze(out);
}

function initialState(defs: readonly PhaseDefinition[], hpPermille: number): BossPhaseState {
  const entry = defs.find((p) => p.maxHpPermille === 1001);
  if (entry === undefined) throw new Error('no entry phase');
  return Object.freeze({
    entityId: 'boss_ash_unit',
    bossId: 'boss_ash',
    hpPermille,
    phaseId: entry.id,
    transition: null,
    visited: Object.freeze([entry.id]),
  });
}

describe('P21 §4–§5 boss-phase fuzz — pure invariants', () => {
  it('detect/commit walk satisfies every §5 invariant across 20k random phase sets and HP walks', { timeout: 120_000 }, () => {
    const rand = mulberry32(0x5e_c0_21);
    for (let i = 0; i < 20_000; i++) {
      const count = 2 + Math.floor(rand() * 3);
      const defs = randomPhaseSet(rand, count);
      // Generator must always produce a valid set (sanity of the oracle input).
      const issues = validateBossPhases(defs);
      expect(issues, `generated set ${String(i)} must be valid: ${JSON.stringify(issues)}`).toEqual([]);
      const walk = randomHpWalk(rand, 5 + Math.floor(rand() * 40));
      const entry = defs.find((p) => p.maxHpPermille === 1001);
      const entryLocked = entry?.transitionLocked === true;
      let state = initialState(defs, walk[0] ?? 1000);
      const visitedSeen = new Set<string>([state.phaseId]);
      let committedAny = false;
      for (let t = 0; t < walk.length; t++) {
        const hp = walk[t] ?? 0;
        state = Object.freeze({ ...state, hpPermille: hp });
        // Detection is idempotent: replaying with the same state is a no-op.
        const first = detectTransition(state, defs, t);
        const second = detectTransition(state, defs, t);
        expect(second, `detect idempotence case ${String(i)} tick ${String(t)}`).toEqual(first);
        if (first !== null) {
          committedAny = true;
          // Detection is only a fresh plan when the state had no transition;
          // otherwise it returns the already-planned one unchanged.
          if (state.transition === null) {
            // Detected transition is range-valid at the detection tick.
            const target = defs.find((p) => p.id === first.to);
            expect(target, `target exists case ${String(i)}`).toBeDefined();
            expect(hp, `range containment case ${String(i)}`).toBeGreaterThanOrEqual(target?.minHpPermille ?? 0);
            expect(hp, `range containment case ${String(i)}`).toBeLessThan(target?.maxHpPermille ?? 0);
            expect(first.commitTick).toBeGreaterThan(first.startTick);
            // A locked current phase must never plan.
            const currentDef = defs.find((p) => p.id === state.phaseId);
            expect(currentDef?.transitionLocked, `locked phase case ${String(i)}`).not.toBe(true);
          } else {
            // Carried-over plan: detect must return exactly the existing one.
            expect(first, `carried plan case ${String(i)}`).toEqual(state.transition);
          }
        }
        const planned = first === null ? state : Object.freeze({ ...state, transition: first });
        const committed = commitTransition(planned, t);
        if (committed.phaseId !== state.phaseId) {
          // Commit is atomic and exactly-once: the target joins visited.
          expect(committed.transition).toBeNull();
          expect(committed.phaseId).toBe(first?.to);
          expect(visitedSeen.has(committed.phaseId), `no re-entry case ${String(i)}`).toBe(false);
          visitedSeen.add(committed.phaseId);
        }
        state = committed;
      }
      // Sanity: an unlocked set with a full descent must reach a lower phase.
      if (!entryLocked && (walk[walk.length - 1] ?? 0) < (entry?.minHpPermille ?? 0)) {
        expect(committedAny, `walk ${String(i)} exercised a transition`).toBe(true);
      }
    }
  });

  it('validateBossPhases flags every corrupted set (gap, overlap, empty range, ambiguity)', () => {
    const rand = mulberry32(0xc0_22_21);
    for (let i = 0; i < 8000; i++) {
      const defs = randomPhaseSet(rand, 3);
      const corrupt = [...defs].map((d) => ({ ...d }));
      const mode = Math.floor(rand() * 4);
      // Only phases with width >= 2 can be shifted/cloned into a real defect;
      // width-1 phases degenerate the mutation into a no-op.
      const wide = corrupt.filter((p) => p.maxHpPermille - p.minHpPermille >= 2);
      if (mode === 0) {
        // Delete one phase -> coverage gap.
        corrupt.splice(Math.floor(rand() * corrupt.length), 1);
      } else if (mode === 1) {
        // Swap min/max on one phase -> empty range.
        const target = corrupt[Math.floor(rand() * corrupt.length)];
        if (target !== undefined) {
          const tmp = target.minHpPermille;
          target.minHpPermille = target.maxHpPermille;
          target.maxHpPermille = tmp;
        }
      } else if (mode === 2) {
        // Shift a min boundary up -> hole at that boundary.
        const target = wide[Math.floor(rand() * wide.length)];
        if (target !== undefined) target.minHpPermille += 1;
      } else {
        // Clone a wide phase with a shifted range -> overlap with duplicate priority.
        const source = wide[Math.floor(rand() * wide.length)];
        if (source !== undefined) {
          const clone = { ...source, id: `clone_${String(i)}`, minHpPermille: source.minHpPermille + 1, maxHpPermille: Math.min(1001, source.maxHpPermille + 1) };
          if (clone.minHpPermille < clone.maxHpPermille) corrupt.push(clone);
        }
      }
      const issues = validateBossPhases(corrupt);
      expect(issues.length, `corruption ${String(i)} mode ${String(mode)} must be flagged: ${JSON.stringify(corrupt)}`).toBeGreaterThan(0);
    }
  });
});

const input: TickInput = Object.freeze({ paused: false, decisions: Object.freeze([]), contentVersion: 'content_fixture' });

// Short transitions so the commit lands well before the fireballs kill the
// boss (the default 45-tick transition would outlive the ~40-tick battle).
const defs: readonly PhaseDefinition[] = Object.freeze([
  Object.freeze({ id: 'p1', bossId: 'boss_ash', priority: 1, minHpPermille: 501, maxHpPermille: 1001, previewKey: 'preview_p1' }),
  Object.freeze({ id: 'p2', bossId: 'boss_ash', priority: 2, minHpPermille: 251, maxHpPermille: 501, previewKey: 'preview_p2', transitionTicks: 5, invulnerableTicks: 12 }),
  Object.freeze({ id: 'p3', bossId: 'boss_ash', priority: 3, minHpPermille: 0, maxHpPermille: 251, previewKey: 'preview_p3', transitionTicks: 5 }),
]);

/** Minimal RNG-free fireball: cast 2, recover 1, cooldown 3, 200 damage. */
function fireballDefinition(): AbilityRuntimeDefinition {
  return {
    config: {
      abilityId: 'ability_fireball', chargeTicks: null, cooldownTicks: 3, castTicks: 2, recoveryTicks: 1,
      interruptPolicy: 'interruptible', usesPerBattle: 60, invalidTargetPolicy: 'wait', bossPhaseCancelAllowed: false,
    },
    trigger: { type: 'tick_interval', everyTicks: 5 },
    targetQuery: { space: 'enemy_entity', profile: 'nearest' },
    effects: (ctx): readonly EffectCommand[] => [
      Object.freeze({
        commandId: `${ctx.abilityInstanceId}_effect_0`, abilityInstanceId: ctx.abilityInstanceId, abilityId: ctx.abilityId,
        effectIndex: 0, sourceId: ctx.source.sourceId,
        targetRef: Object.freeze({ kind: 'entity' as const, entityId: ctx.target.entityId, groundKey: null, slotId: null }),
        scheduledTick: ctx.commitTick, stage: 'I' as const, sourceSnapshot: ctx.source, sequence: 0,
        kind: 'damage' as const, amount: 200,
      }),
    ],
  };
}

function buildBattle(): BattleModel {
  const player = migrateEntity({ entity: entity('unit_p', { side: 'player', lane: 'middle', x100: 1800, maxLp: 1000, lp: 1000 }), radiusX100: 100 });
  const boss = migrateEntity({ entity: entity('boss_ash_unit', { side: 'enemy', lane: 'middle', x100: 7000, maxLp: 1000, lp: 1000 }), radiusX100: 120 });
  return battle({
    simulationVersion: 'phase21-fixture-v1',
    entities: Object.freeze([player, boss]),
    abilities: Object.freeze([createAbilityInstance(fireballDefinition().config, 'inst_fireball', 'unit_p')]),
    bossPhase: createBossPhaseSnapshot(Object.freeze({
      entityId: 'boss_ash_unit', bossId: 'boss_ash', phaseId: 'p1', transition: null,
      visited: Object.freeze(['p1']), invulnerableUntilTick: null,
    })),
  });
}

function systems(cfg: Phase21RuntimeConfig): readonly KernelSystem[] {
  return Object.freeze([
    ...createPhase17Systems({ speedsX100PerSecond: {} }),
    ...createPhase19Systems({ speedsX100PerSecond: { unit_p: 0 }, abilities: { definitions: { ability_fireball: fireballDefinition() } } }),
    ...createPhase20Systems({}),
    ...createPhase21Systems(cfg),
  ]);
}

/** Pure detect/commit replay for one tick against a given pre-step HP. */
function oracleTick(prev: BossPhaseSnapshot, defsList: readonly PhaseDefinition[], hpPermille: number, atTick: number): BossPhaseSnapshot {
  const state: BossPhaseState = Object.freeze({
    entityId: prev.entityId, bossId: prev.bossId, hpPermille, phaseId: prev.phaseId,
    transition: prev.transition, visited: prev.visited,
  });
  const detected = detectTransition(state, defsList, atTick);
  const planned = detected === null ? state : Object.freeze({ ...state, transition: detected });
  const committed = commitTransition(planned, atTick);
  const enteredNewPhase = committed.phaseId !== prev.phaseId;
  const invuln = enteredNewPhase ? phaseInvulnerableTicks(defsList, committed.phaseId) : 0;
  return createBossPhaseSnapshot(Object.freeze({
    entityId: prev.entityId,
    bossId: prev.bossId,
    phaseId: committed.phaseId,
    transition: committed.transition,
    visited: Object.freeze([...committed.visited].sort(asciiCompare)),
    invulnerableUntilTick: enteredNewPhase ? (invuln > 0 ? atTick + invuln : null) : prev.invulnerableUntilTick,
  }));
}

function bossHpPermille(state: BattleModel): number {
  const boss = state.entities.find((e) => e.id === 'boss_ash_unit');
  if (boss === undefined) return 0;
  return Math.floor((boss.lp * 1000) / Math.max(1, boss.maxLp));
}

function snapshotBossPhase(state: BattleModel): BossPhaseSnapshot {
  const bp = state.bossPhase;
  if (bp === undefined) throw new Error('no bossPhase');
  return bp;
}

describe('P21 §4–§5 boss-phase fuzz — kernel vs pure oracle', () => {
  it('kernel bossPhase equals the pure detect/commit oracle every tick, across seeds (invulnerability included)', { timeout: 120_000 }, () => {
    const cfg: Phase21RuntimeConfig = Object.freeze({ bossPhaseDefinitions: defs });
    for (const battleSeed of [1, 2, 3, 4, 5]) {
      void mulberry32(0xb0_55_0000 + battleSeed);
      let current = buildBattle();
      const rnd = randomSession();
      let oracle = snapshotBossPhase(current);
      let ticksStepped = 0;
      let sawPhaseChange = false;
      for (let t = 0; t < 80; t++) {
        const hp = bossHpPermille(current);
        oracle = oracleTick(oracle, defs, hp, t);
        const r = stepBattle({ state: current, input, random: rnd, rules: {}, content: {}, systems: systems(cfg) });
        current = r.state;
        ticksStepped += 1;
        const actual = snapshotBossPhase(current);
        if (actual.phaseId !== 'p1') sawPhaseChange = true;
        // Byte-identical boss-phase projection every tick.
        expect(actual.phaseId, `seed ${String(battleSeed)} tick ${String(t)} phase`).toBe(oracle.phaseId);
        expect(actual.visited, `seed ${String(battleSeed)} tick ${String(t)} visited`).toEqual(oracle.visited);
        expect(actual.invulnerableUntilTick, `seed ${String(battleSeed)} tick ${String(t)} invuln`).toBe(oracle.invulnerableUntilTick);
        expect(actual.transition, `seed ${String(battleSeed)} tick ${String(t)} transition`).toEqual(oracle.transition);
        if (['VICTORY', 'DEFEAT', 'DRAW_ABORT'].includes(current.phase.phase)) break;
      }
      // The battle must genuinely cross at least one phase boundary.
      expect(sawPhaseChange, `seed ${String(battleSeed)} crossed a phase boundary`).toBe(true);
      // Determinism across an identical re-run.
      const again = (() => {
        let c = buildBattle();
        const rnd = randomSession();
        for (let t = 0; t < ticksStepped; t++) {
          const r = stepBattle({ state: c, input, random: rnd, rules: {}, content: {}, systems: systems(cfg) });
          c = r.state;
          if (['VICTORY', 'DEFEAT', 'DRAW_ABORT'].includes(c.phase.phase)) break;
        }
        return createSnapshot(c).checksum;
      })();
      expect(again).toBe(createSnapshot(current).checksum);
    }
  });

  it('invulnerability genuinely gates the battle (HP frozen while p2 invulnerable)', { timeout: 120_000 }, () => {
    const cfg: Phase21RuntimeConfig = Object.freeze({ bossPhaseDefinitions: defs });
    let current = buildBattle();
    const rnd = randomSession();
    const trace: { readonly tick: number; readonly lp: number; readonly invulnerableUntil: number | null }[] = [];
    for (let t = 0; t < 80; t++) {
      const r = stepBattle({ state: current, input, random: rnd, rules: {}, content: {}, systems: systems(cfg) });
      current = r.state;
      const boss = current.entities.find((e) => e.id === 'boss_ash_unit');
      trace.push({ tick: current.tick, lp: boss?.lp ?? 0, invulnerableUntil: current.bossPhase?.invulnerableUntilTick ?? null });
      if (['VICTORY', 'DEFEAT', 'DRAW_ABORT'].includes(current.phase.phase)) break;
    }
    // p2 grants 12 invulnerable ticks on entry. The `invulnerableUntilTick`
    // field stays set forever (it is a boundary, not a counter), so the active
    // window is the rows whose tick is still <= the boundary: HP must hold
    // absolutely still through all of them (fireballs land but deal 0).
    const active = trace.filter((row) => row.invulnerableUntil !== null && row.tick <= row.invulnerableUntil);
    expect(active.length, `active invulnerable window ${JSON.stringify(trace)}`).toBeGreaterThanOrEqual(10);
    const lpDuring = new Set(active.map((row) => row.lp));
    expect(lpDuring.size, `HP frozen during the window: ${JSON.stringify(active)}`).toBe(1);
    // After the boundary passes, the first fireball that lands drops HP again
    // (rows between fireballs naturally hold the frozen value).
    const frozenLp = [...lpDuring][0] ?? 0;
    const boundary = Math.max(0, ...active.map((row) => row.invulnerableUntil ?? 0));
    const after = trace.find((row) => row.tick > boundary && row.lp !== frozenLp);
    expect(after, 'damage resumes after invulnerability').toBeDefined();
    expect(after?.lp).toBeLessThan(frozenLp);
  });
});
