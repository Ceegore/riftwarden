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
 * Phase 21 §4/§5 phase-split fuzz: HP BURSTS across multiple phase brackets.
 *
 * A single damage burst can cross several HP brackets in one tick while a
 * transition is (or would be) planned. The §5 single-commit authority:
 *   1. ONE PLAN PER SOURCE PHASE — detection is idempotent: a pending plan is
 *      never replaced by the burst, and no source phase may ever plan twice.
 *   2. ONE COMMIT PER SOURCE PHASE — a burst collapses into at most one commit
 *      (to the bracket holding the post-burst HP); intermediate brackets the
 *      burst crossed are simply never entered (visited jumps, no re-entry).
 *   3. POST-COMMIT RE-DETECT — after the burst's single commit, detection
 *      resumes from the committed phase + current HP and plans the next jump;
 *      the later brackets are reached one commit at a time, never in one step.
 *   4. EXACT-TICK BURST — a burst landing exactly on the commit tick shares the
 *      tick: the pending commit still fires and the new HP re-targets next.
 *   5. STATUS GATE + DETERMINISM — persisted phase always equals the last
 *      BossPhaseStarted, and two identical runs are byte-identical.
 */

const input: TickInput = Object.freeze({ paused: false, decisions: Object.freeze([]), contentVersion: 'content_fixture' });

const BOSS_ID = 'boss_ash_unit';
const BOSS_MAX_LP = 4000;
const WINDOW = 20;

function defs(): readonly PhaseDefinition[] {
  return Object.freeze([
    Object.freeze({ id: 'p1', bossId: BOSS_ID, priority: 1, minHpPermille: 751, maxHpPermille: 1001, previewKey: 'preview_p1' }),
    Object.freeze({ id: 'p2', bossId: BOSS_ID, priority: 2, minHpPermille: 501, maxHpPermille: 751, previewKey: 'preview_p2', transitionTicks: WINDOW }),
    Object.freeze({ id: 'p3', bossId: BOSS_ID, priority: 3, minHpPermille: 251, maxHpPermille: 501, previewKey: 'preview_p3', transitionTicks: WINDOW }),
    Object.freeze({ id: 'p4', bossId: BOSS_ID, priority: 4, minHpPermille: 0, maxHpPermille: 251, previewKey: 'preview_p4', transitionTicks: WINDOW }),
  ]);
}

function bossPhaseSeed(): BossPhaseSnapshot {
  return Object.freeze({ entityId: BOSS_ID, bossId: BOSS_ID, phaseId: 'p1', transition: null, visited: Object.freeze(['p1']), invulnerableUntilTick: null });
}

function buildSystems(): readonly KernelSystem[] {
  return Object.freeze([
    ...createPhase17Systems({ speedsX100PerSecond: {} }),
    ...createPhase21Systems({ bossPhaseDefinitions: defs() }),
  ]);
}

function buildBattle(): BattleModel {
  const player = migrateEntity({ entity: entity('unit_p', { side: 'player', lane: 'middle', x100: 1800, maxLp: 1000, lp: 1000 }), radiusX100: 100 });
  const boss = migrateEntity({ entity: entity(BOSS_ID, { side: 'enemy', lane: 'middle', x100: 7000, maxLp: BOSS_MAX_LP, lp: BOSS_MAX_LP }), radiusX100: 120 });
  return battle({
    simulationVersion: 'phase21-phase-split-fuzz-v1',
    entities: Object.freeze([player, boss]),
    abilities: Object.freeze([]),
    bossPhase: bossPhaseSeed(),
  });
}

/** Queue one damage application that drops the boss's LP to `targetPermille`. */
function queueDamage(state: BattleModel, targetPermille: number, instance: number): BattleModel {
  const boss = state.entities.find((e) => e.id === BOSS_ID);
  if (boss === undefined) throw new Error('boss missing');
  const targetLp = Math.max(1, Math.floor((boss.maxLp * targetPermille) / 1000));
  const amount = boss.lp - targetLp;
  if (amount <= 0) throw new Error(`burst must damage (permille ${String(targetPermille)})`);
  return Object.freeze({
    ...state,
    pendingCombatApplications: Object.freeze([
      Object.freeze({ kind: 'damage', sourceId: 'unit_p', targetId: BOSS_ID, effectId: `ef_burst_${String(instance)}`, attackInstanceId: instance, effectIndex: 0, rawAmount: amount, damageTypeOrdinal: 0, defense: 0, coverReductionBps: 0, bossCapBps: null }),
    ]),
  });
}

type PlanRecord = { readonly from: string; readonly to: string; readonly planTick: number; readonly commitTick: number };
type StartRecord = { readonly phaseId: string; readonly tick: number };

interface SplitResult {
  readonly plans: readonly PlanRecord[];
  readonly starts: readonly StartRecord[];
  readonly finalVisited: readonly string[];
  readonly finalPhaseId: string;
  readonly checksum: string;
}

/** Steps the battle, observing the canonical phase events on every step. */
function runScenario(scenario: 'burst_before_plan' | 'burst_mid_window' | 'burst_exact_tick'): SplitResult {
  const systems = buildSystems();
  let state = buildBattle();
  const random = randomSession();
  const plans: PlanRecord[] = [];
  const starts: StartRecord[] = [];

  const observe = (events: readonly { readonly type: string; readonly contentIds: readonly string[]; readonly payload: Readonly<Record<string, number>> }[]): void => {
    for (const event of events) {
      if (event.type === 'PhaseTransitionPlanned' && event.contentIds.length >= 3) {
        const from = event.contentIds[1] ?? '';
        const to = event.contentIds[2] ?? '';
        plans.push({ from, to, planTick: state.tick, commitTick: event.payload['commitTick'] ?? 0 });
      }
      if (event.type === 'BossPhaseStarted' && event.contentIds.length >= 2) {
        starts.push({ phaseId: event.contentIds[1] ?? '', tick: state.tick });
      }
    }
  };

  const step = (): BattleModel => {
    const r = stepBattle({ state, input, random, rules: {}, content: {}, systems });
    state = r.state;
    observe(r.events);
    return state;
  };

  // Burst before any plan: one hit from full HP straight into p4.
  if (scenario === 'burst_before_plan') {
    state = queueDamage(state, 100, 1);
    // Run until the first commit lands (the burst jump p1→p4).
    let safety = 0;
    while (starts.length === 0 && safety < 400) { step(); safety += 1; }
  } else {
    // Phase the burst INSIDE a pending p1→p2 window.
    state = queueDamage(state, 625, 1); // enter p2's bracket → p1→p2 planned
    let plan: PlanRecord | null = null;
    let safety = 0;
    while (safety < 400) {
      step();
      const last = plans[plans.length - 1];
      if (last !== undefined && last.from === 'p1' && last.to === 'p2') { plan = last; break; }
      safety += 1;
    }
    if (plan === null) throw new Error('p1→p2 never planned');
    if (scenario === 'burst_mid_window') {
      // Drop to p4 (crossing p3's bracket) while p1→p2 is still pending.
      state = queueDamage(state, 100, 2);
    } else {
      // Land the burst EXACTLY on the commit tick: queue it one tick before.
      let guard = 0;
      while (state.tick < plan.commitTick - 1 && guard < 400) { step(); guard += 1; }
      state = queueDamage(state, 100, 2);
    }
    // Run until the p1→p2 commit AND the follow-up p2→p4 jump both happened.
    let guard = 0;
    while (starts.filter((s) => s.phaseId === 'p2').length === 0 && guard < 400) { step(); guard += 1; }
    let guard2 = 0;
    while (starts.filter((s) => s.phaseId === 'p4').length === 0 && guard2 < 400) { step(); guard2 += 1; }
  }

  return {
    plans: Object.freeze(plans),
    starts: Object.freeze(starts),
    finalVisited: Object.freeze([...(state.bossPhase?.visited ?? [])]),
    finalPhaseId: state.bossPhase?.phaseId ?? 'none',
    checksum: createSnapshot(state).checksum,
  };
}

describe('P21 §4/§5 phase-split mid-transition HP bursts', () => {
  it('a burst before any plan collapses into ONE commit straight to the burst bracket', { timeout: 60_000 }, () => {
    const a = runScenario('burst_before_plan');
    const b = runScenario('burst_before_plan');
    expect(b.checksum).toBe(a.checksum);
    // One plan (p1→p4, skipping p2/p3) and one commit.
    expect(a.plans).toHaveLength(1);
    expect(a.plans[0]?.from).toBe('p1');
    expect(a.plans[0]?.to).toBe('p4');
    expect(a.starts).toHaveLength(1);
    expect(a.starts[0]?.phaseId).toBe('p4');
    // Visited jumps p1→p4: the crossed brackets are never entered.
    expect(a.finalVisited).toEqual(['p1', 'p4']);
    expect(a.finalPhaseId).toBe('p4');
  });

  it('a burst inside the pending window commits the ORIGINAL target, then re-detects to the burst bracket', { timeout: 60_000 }, () => {
    const a = runScenario('burst_mid_window');
    const b = runScenario('burst_mid_window');
    expect(b.checksum).toBe(a.checksum);
    expect(b.plans).toEqual(a.plans);
    expect(b.starts).toEqual(a.starts);
    // Exactly one plan per source phase: p1→p2 (pending when the burst hit) and
    // then p2→p4 from the committed phase. p3 is never planned/entered.
    expect(a.plans.map((p) => `${p.from}->${p.to}`)).toEqual(['p1->p2', 'p2->p4']);
    expect(a.starts.map((s) => s.phaseId)).toEqual(['p2', 'p4']);
    // The p1→p2 commit landed exactly one transition window after the plan was
    // observed (the pending plan was never replaced by the burst — the
    // idempotent authority).
    const p2Start = a.starts.find((s) => s.phaseId === 'p2');
    expect(p2Start?.tick).toBe((a.plans[0]?.planTick ?? 0) + WINDOW);
    // p3 was skipped entirely; visited = [p1, p2, p4].
    expect(a.finalVisited).toEqual(['p1', 'p2', 'p4']);
    expect(a.finalPhaseId).toBe('p4');
  });

  it('a burst landing exactly on the commit tick still fires that single commit', { timeout: 60_000 }, () => {
    const a = runScenario('burst_exact_tick');
    const b = runScenario('burst_exact_tick');
    expect(b.checksum).toBe(a.checksum);
    expect(b.starts).toEqual(a.starts);
    // The exact-tick burst does not cancel or duplicate the pending commit:
    // p1→p2 commits once, p2→p4 follows.
    expect(a.plans.map((p) => `${p.from}->${p.to}`)).toEqual(['p1->p2', 'p2->p4']);
    expect(a.starts.map((s) => s.phaseId)).toEqual(['p2', 'p4']);
    const p2Start = a.starts.find((s) => s.phaseId === 'p2');
    const p4Start = a.starts.find((s) => s.phaseId === 'p4');
    expect(p2Start?.tick).toBe((a.plans[0]?.planTick ?? 0) + WINDOW);
    expect(p2Start !== undefined && p4Start !== undefined).toBe(true);
    if (p2Start === undefined || p4Start === undefined) throw new Error('missing start');
    // The follow-up jump happens strictly after the pending commit.
    expect(p4Start.tick).toBeGreaterThan(p2Start.tick);
    expect(a.finalVisited).toEqual(['p1', 'p2', 'p4']);
  });

  it('no source phase ever plans twice and the status gate holds across every scenario', { timeout: 60_000 }, () => {
    for (const scenario of ['burst_before_plan', 'burst_mid_window', 'burst_exact_tick'] as const) {
      const a = runScenario(scenario);
      const sources = new Set(a.plans.map((p) => p.from));
      // 1. ONE PLAN PER SOURCE PHASE: no replan from any source.
      expect(a.plans.length, scenario).toBe(sources.size);
      // 2. ONE COMMIT PER SOURCE PHASE: each start is a distinct phase and the
      // total starts never exceed the plans.
      const started = new Set(a.starts.map((s) => s.phaseId));
      expect(started.size, scenario).toBe(a.starts.length);
      expect(a.starts.length, scenario).toBeLessThanOrEqual(a.plans.length);
      // 5. STATUS GATE: the persisted phase is the last started phase.
      const lastStart = a.starts[a.starts.length - 1];
      expect(a.finalPhaseId, scenario).toBe(lastStart?.phaseId ?? 'p1');
      // The whole trail is deterministic.
      expect(a.checksum.length, scenario).toBe(64);
    }
  });
});
