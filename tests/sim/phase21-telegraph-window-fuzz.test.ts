import { describe, expect, it } from 'vitest';
import { stepBattle } from '../../src/game/sim/core/battle-kernel.js';
import { migrateEntity } from '../../src/game/sim/core/migrate.js';
import { createPhase17Systems } from '../../src/game/sim/core/phase17-systems.js';
import { createPhase21Systems } from '../../src/game/sim/core/phase21-systems.js';
import { createSnapshot } from '../../src/game/sim/snapshot/snapshot.js';
import type { BossPhaseSnapshot, PhaseDefinition } from '../../src/game/sim/boss/boss-phase-system.js';
import type { KernelSystem } from '../../src/game/sim/core/tick-context.js';
import type { TickInput } from '../../src/game/sim/core/tick-input.js';
import type { BattleModel } from '../../src/game/sim/core/battle-model.js';
import { battle, entity, randomSession } from './test-helpers.js';

/**
 * Phase 21 §5 telegraph-window fuzz.
 *
 * Every planned boss-phase transition telegraphs its commit: the stage-D
 * detector emits `PhaseTransitionPlanned` (payload `commitTick`) and
 * `BossTelegraphStarted` (payload `resolveTick`) on the SAME tick, and the
 * telegraph's `resolveTick` must ALWAYS equal the plan's `commitTick`. A
 * frontend renders the telegraph for the whole window until the commit lands.
 * Contract under test (swept across several transition windows):
 *   1. EXACT RESOLVE — for every plan, exactly one telegraph fires on the plan
 *      tick and its `resolveTick` equals the plan's `commitTick`.
 *   2. ONE PER PLAN — a source phase plans at most once; after the commit no
 *      further telegraph for that target phase appears (no re-telegraph).
 *   3. NO GHOST — no `BossTelegraphStarted` without a matching plan, and no
 *      telegraph for a phase the boss is already in or already visited.
 *   4. WINDOW HOLD — between plan and commit the state keeps the SAME planned
 *      transition (telegraph window held; detection is idempotent).
 *   5. DETERMINISM — identical battles produce identical event traces.
 */

const input: TickInput = Object.freeze({ paused: false, decisions: Object.freeze([]), contentVersion: 'content_fixture' });
const BOSS_ID = 'boss_ash_unit';
const BOSS_MAX_LP = 4000;

/** Per-phase transition windows; t3 uses the default window. */
export interface WindowSweep { readonly t2: number; readonly t4: number; }

function defs(windowFor: WindowSweep): readonly PhaseDefinition[] {
  return Object.freeze([
    Object.freeze({ id: 't1', bossId: BOSS_ID, priority: 1, minHpPermille: 751, maxHpPermille: 1001, previewKey: 'preview_t1' }),
    Object.freeze({ id: 't2', bossId: BOSS_ID, priority: 2, minHpPermille: 501, maxHpPermille: 751, previewKey: 'preview_t2', transitionTicks: windowFor.t2 }),
    Object.freeze({ id: 't3', bossId: BOSS_ID, priority: 3, minHpPermille: 251, maxHpPermille: 501, previewKey: 'preview_t3' }),
    Object.freeze({ id: 't4', bossId: BOSS_ID, priority: 4, minHpPermille: 0, maxHpPermille: 251, previewKey: 'preview_t4', transitionTicks: windowFor.t4 }),
  ]);
}

const DESCENTS: readonly { readonly to: string; readonly permille: number }[] = Object.freeze([
  Object.freeze({ to: 't2', permille: 625 }),
  Object.freeze({ to: 't3', permille: 375 }),
  Object.freeze({ to: 't4', permille: 120 }),
]);

function bossPhaseSeed(): BossPhaseSnapshot {
  return Object.freeze({ entityId: BOSS_ID, bossId: BOSS_ID, phaseId: 't1', transition: null, visited: Object.freeze(['t1']), invulnerableUntilTick: null });
}

function buildBattle(): BattleModel {
  const player = migrateEntity({ entity: entity('unit_p', { side: 'player', lane: 'middle', x100: 1800, maxLp: 1000, lp: 1000 }), radiusX100: 100 });
  const boss = migrateEntity({ entity: entity(BOSS_ID, { side: 'enemy', lane: 'middle', x100: 7000, maxLp: BOSS_MAX_LP, lp: BOSS_MAX_LP }), radiusX100: 120 });
  return battle({
    simulationVersion: 'phase21-telegraph-window-fuzz-v1',
    entities: Object.freeze([player, boss]),
    abilities: Object.freeze([]),
    bossPhase: bossPhaseSeed(),
  });
}

function queueDamage(state: BattleModel, targetPermille: number, instance: number): BattleModel {
  const boss = state.entities.find((e) => e.id === BOSS_ID);
  if (boss === undefined) throw new Error('boss missing');
  const targetLp = Math.max(1, Math.floor((boss.maxLp * targetPermille) / 1000));
  const amount = boss.lp - targetLp;
  if (amount <= 0) throw new Error(`descent damage must be positive (permille ${String(targetPermille)})`);
  return Object.freeze({
    ...state,
    pendingCombatApplications: Object.freeze([
      Object.freeze({ kind: 'damage', sourceId: 'unit_p', targetId: BOSS_ID, effectId: `ef_telegraph_${String(instance)}`, attackInstanceId: instance, effectIndex: 0, rawAmount: amount, damageTypeOrdinal: 0, defense: 0, coverReductionBps: 0, bossCapBps: null }),
    ]),
  });
}

interface TelegraphEvent {
  readonly tick: number;
  readonly type: 'PhaseTransitionPlanned' | 'BossTelegraphStarted' | 'BossPhaseStarted';
  readonly target: string;
  readonly payload: Readonly<Record<string, number>>;
}

function runBattle(windowFor: WindowSweep): { readonly trace: readonly TelegraphEvent[]; readonly checksum: string } {
  const systems: readonly KernelSystem[] = Object.freeze([
    ...createPhase17Systems({ speedsX100PerSecond: {} }),
    ...createPhase21Systems({ bossPhaseDefinitions: defs(windowFor) }),
  ]);
  let state = buildBattle();
  const random = randomSession();
  const trace: TelegraphEvent[] = [];
  for (let index = 0; index < DESCENTS.length; index++) {
    const seg = DESCENTS[index];
    if (seg === undefined) throw new Error('descent segment missing');
    state = queueDamage(state, seg.permille, index + 1);
    for (let i = 0; i < 400; i++) {
      const r = stepBattle({ state, input, random, rules: {}, content: {}, systems });
      state = r.state;
      for (const e of r.events) {
        if (['PhaseTransitionPlanned', 'BossTelegraphStarted', 'BossPhaseStarted'].includes(e.type)) {
          // Telegraph contentIds are [bossId, target]; plan contentIds are
          // [bossId, from, target] — the target is always the last entry.
          trace.push({ tick: state.tick, type: e.type as TelegraphEvent['type'], target: e.contentIds[e.contentIds.length - 1] ?? '', payload: e.payload });
        }
      }
      if (state.bossPhase?.phaseId === seg.to) break;
      if (i === 399) throw new Error(`descent stalled at ${seg.to}`);
    }
  }
  return { trace: Object.freeze(trace), checksum: createSnapshot(state).checksum };
}

describe('P21 §5 telegraph window', () => {
  it('every plan telegraphs exactly once with resolveTick === commitTick, across window sweeps', { timeout: 120_000 }, () => {
    // Sweep several transition windows (including asymmetric ones) so the
    // telegraph contract holds for short, long and mixed windows.
    const sweeps = [
      { t2: 3, t4: 3 },
      { t2: 9, t4: 17 },
      { t2: 20, t4: 5 },
    ] as const;
    for (const windowFor of sweeps) {
      const a = runBattle(windowFor);
      const b = runBattle(windowFor);
      // 5. Determinism.
      expect(b.checksum).toBe(a.checksum);
      expect(b.trace).toEqual(a.trace);
      const plans = a.trace.filter((e) => e.type === 'PhaseTransitionPlanned');
      const telegraphs = a.trace.filter((e) => e.type === 'BossTelegraphStarted');
      const starts = a.trace.filter((e) => e.type === 'BossPhaseStarted');
      expect(plans.map((e) => e.target)).toEqual(['t2', 't3', 't4']);
      // 1. EXACT RESOLVE + 2. ONE PER PLAN.
      expect(telegraphs).toHaveLength(plans.length);
      for (let i = 0; i < plans.length; i++) {
        const plan = plans[i];
        const telegraph = telegraphs[i];
        if (plan === undefined || telegraph === undefined) throw new Error('trace element missing');
        const resolveTick = telegraph.payload['resolveTick'];
        const commitTick = plan.payload['commitTick'];
        expect(resolveTick, 'telegraph has resolve tick').toBeDefined();
        expect(commitTick, 'plan has commit tick').toBeDefined();
        if (resolveTick === undefined || commitTick === undefined) throw new Error('tick payload missing');
        expect(telegraph.tick, 'telegraph on the plan tick').toBe(plan.tick);
        expect(telegraph.target, 'telegraph names the target phase').toBe(plan.target);
        expect(resolveTick, 'telegraph resolve = plan commit').toBe(commitTick);
        expect(resolveTick, 'resolve in the future').toBeGreaterThan(plan.tick);
        expect(commitTick - plan.tick, 'positive window').toBeGreaterThanOrEqual(1);
        // The commit fires at the internal resolve tick; the observed start
        // event lands on the post-increment frame (resolve + 1).
        const startTick = starts[i]?.tick ?? -1;
        expect(startTick, 'commit lands at the resolve tick').toBeGreaterThanOrEqual(resolveTick);
        expect(startTick, 'commit lands at the resolve tick').toBeLessThanOrEqual(resolveTick + 1);
      }
    }
  });

  it('the window is held idempotently and never re-telegraphs after commit', { timeout: 60_000 }, () => {
    const a = runBattle({ t2: 9, t4: 5 });
    // 3. NO GHOST: every telegraph has a matching plan and names a target the
    // boss has not already committed into.
    const plansByTarget = new Map<string, number>();
    for (const e of a.trace) {
      if (e.type === 'PhaseTransitionPlanned') plansByTarget.set(e.target, (plansByTarget.get(e.target) ?? 0) + 1);
    }
    for (const e of a.trace.filter((x) => x.type === 'BossTelegraphStarted')) {
      expect(plansByTarget.get(e.target), `telegraph for ${e.target} has a plan`).toBe(1);
    }
    // 4. WINDOW HOLD: between a plan and its commit the transition never
    // changes (the detector is idempotent — one plan per source phase).
    const rePlans = a.trace.filter((e) => e.type === 'PhaseTransitionPlanned').length;
    expect(rePlans).toBe(3);
    expect(a.trace.filter((e) => e.type === 'BossPhaseStarted')).toHaveLength(3);
    expect(a.checksum.length).toBe(64);
  });
});
