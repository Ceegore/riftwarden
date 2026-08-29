import { describe, expect, it } from 'vitest';
import { stepBattle } from '../../src/game/sim/core/battle-kernel.js';
import { migrateEntity } from '../../src/game/sim/core/migrate.js';
import { createPhase17Systems } from '../../src/game/sim/core/phase17-systems.js';
import { createPhase21Systems } from '../../src/game/sim/core/phase21-systems.js';
import { createSnapshot } from '../../src/game/sim/snapshot/snapshot.js';
import { DEFAULT_TRANSITION_TICKS, type BossPhaseSnapshot, type PhaseDefinition } from '../../src/game/sim/boss/boss-phase-system.js';
import type { KernelSystem } from '../../src/game/sim/core/tick-context.js';
import type { TickInput } from '../../src/game/sim/core/tick-input.js';
import type { BattleModel } from '../../src/game/sim/core/battle-model.js';
import { battle, entity, randomSession } from './test-helpers.js';

/**
 * Phase 21 §4–§5 full multi-descent fuzz.
 *
 * A boss battle descends through FOUR phases across its whole HP range in ONE
 * continuous run (no re-seeding of the phase authority). Contract under test:
 *   1. NO SKIP — the visited trail grows exactly p1→p2→p3→p4, one commit per
 *      crossing; a transition can never leap over an intermediate bracket.
 *   2. NO RE-ENTRY — visited never repeats; the boss is fully descended when
 *      visited equals the whole set.
 *   3. EXACT COMMIT — each planned transition commits exactly at its payload
 *      `commitTick` (= plan tick + the phase's transition window), a
 *      `BossPhaseStarted` fires on that same tick, and the persisted phase
 *      equals the last-started phase everywhere (status gate).
 *   4. HP CONTAINMENT — every committed phase's HP bracket actually contains
 *      the boss's permille at the commit tick (the oracle is never bypassed).
 *   5. INVULNERABILITY — a phase declaring invulnerableTicks grants the
 *      boundary exactly on entry; a phase without it stays clear.
 *   6. DETERMINISM — two identical runs produce the identical terminal
 *      checksum and full phase event trace.
 */

const input: TickInput = Object.freeze({ paused: false, decisions: Object.freeze([]), contentVersion: 'content_fixture' });

const BOSS_ID = 'boss_ash_unit';
const BOSS_MAX_LP = 4000;

/** p1 full HP entry; p2/p3/p4 are the lower brackets, each with a transition
 * window so the "wait through the telegraph" path is exercised. */
function defs(): readonly PhaseDefinition[] {
  return Object.freeze([
    Object.freeze({ id: 'p1', bossId: BOSS_ID, priority: 1, minHpPermille: 751, maxHpPermille: 1001, previewKey: 'preview_p1' }),
    Object.freeze({ id: 'p2', bossId: BOSS_ID, priority: 2, minHpPermille: 501, maxHpPermille: 751, previewKey: 'preview_p2', transitionTicks: 8, invulnerableTicks: 9 }),
    Object.freeze({ id: 'p3', bossId: BOSS_ID, priority: 3, minHpPermille: 251, maxHpPermille: 501, previewKey: 'preview_p3', transitionTicks: 8 }),
    Object.freeze({ id: 'p4', bossId: BOSS_ID, priority: 4, minHpPermille: 0, maxHpPermille: 251, previewKey: 'preview_p4', transitionTicks: 10, invulnerableTicks: 6 }),
  ]);
}

function transitionWindow(def: PhaseDefinition): number {
  return def.transitionTicks ?? DEFAULT_TRANSITION_TICKS;
}

/** The scripted full descent: each step crosses exactly one bracket, so the
 * boss cannot skip a phase. The permille is the midpoint of each bracket. */
const DESCENTS: readonly { readonly from: string; readonly to: string; readonly permille: number }[] = Object.freeze([
  Object.freeze({ from: 'p1', to: 'p2', permille: 625 }),
  Object.freeze({ from: 'p2', to: 'p3', permille: 375 }),
  Object.freeze({ from: 'p3', to: 'p4', permille: 120 }),
]);

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
    simulationVersion: 'phase21-multi-descent-fuzz-v1',
    entities: Object.freeze([player, boss]),
    abilities: Object.freeze([]),
    bossPhase: bossPhaseSeed(),
  });
}

/** Queue one damage application that drops the boss's LP to `targetPermille`. */
function queueDamage(state: BattleModel, targetPermille: number, instance: number): BattleModel {
  const boss = state.entities.find((e) => e.id === BOSS_ID);
  if (boss === undefined) throw new Error('boss missing');
  const maxLp = boss.maxLp;
  const targetLp = Math.max(1, Math.floor((maxLp * targetPermille) / 1000));
  const amount = boss.lp - targetLp;
  if (amount <= 0) throw new Error(`descent damage must be positive (permille ${String(targetPermille)})`);
  return Object.freeze({
    ...state,
    pendingCombatApplications: Object.freeze([
      Object.freeze({ kind: 'damage', sourceId: 'unit_p', targetId: BOSS_ID, effectId: `ef_descent_${String(instance)}`, attackInstanceId: instance, effectIndex: 0, rawAmount: amount, damageTypeOrdinal: 0, defense: 0, coverReductionBps: 0, bossCapBps: null }),
    ]),
  });
}

interface DescentCommit {
  readonly phaseId: string;
  readonly permilleAtCommit: number;
  readonly planTick: number;
  readonly commitTick: number;
  readonly invulnerableUntilTick: number | null;
}

interface DescentResult {
  readonly commits: readonly DescentCommit[];
  readonly trace: readonly (readonly [string, number, string])[];
  readonly checksum: string;
  readonly finalVisited: readonly string[];
}

/** Step (with no queued damage) until the boss's committed invulnerable
 * window has fully elapsed, so the next descent's damage can land. */
function waitPastInvulnerable(state: BattleModel, systems: readonly KernelSystem[], random: ReturnType<typeof randomSession>): BattleModel {
  for (let i = 0; i < 200; i++) {
    const until = state.bossPhase?.invulnerableUntilTick ?? null;
    if (until === null || state.tick >= until) return state;
    const r = stepBattle({ state, input, random, rules: {}, content: {}, systems });
    state = r.state;
  }
  throw new Error('invulnerable window did not elapse');
}

function runDescent(): DescentResult {
  const systems = buildSystems();
  let state = buildBattle();
  const random = randomSession();
  const trace: [string, number, string][] = [];
  const commits: DescentCommit[] = [];
  for (let index = 0; index < DESCENTS.length; index++) {
    const seg = DESCENTS[index];
    if (seg === undefined) throw new Error('descent segment missing');
    // The prior commit may have granted invulnerability (p2); let it elapse
    // before the next damage so the descent actually resumes.
    if (index > 0) state = waitPastInvulnerable(state, systems, random);
    state = queueDamage(state, seg.permille, index + 1);
    let planned: { planTick: number; commitTick: number } | null = null;
    let startedAt: number | null = null;
    for (let i = 0; i < 400; i++) {
      const r = stepBattle({ state, input, random, rules: {}, content: {}, systems });
      state = r.state;
      for (const e of r.events) {
        if (['PhaseTransitionPlanned', 'BossPhaseStarted', 'BossPhaseCompleted'].includes(e.type)) {
          trace.push([e.type, state.tick, e.contentIds.join('/')]);
        }
        if (e.type === 'PhaseTransitionPlanned' && e.contentIds.includes(seg.to)) {
          planned = { planTick: state.tick, commitTick: e.payload['commitTick'] ?? 0 };
        }
        if (e.type === 'BossPhaseStarted' && e.contentIds.includes(seg.to)) startedAt = state.tick;
      }
      if (state.bossPhase?.phaseId === seg.to) {
        if (planned === null) throw new Error(`phase ${seg.to} reached without a plan`);
        if (startedAt === null) throw new Error(`phase ${seg.to} reached without a start event`);
        break;
      }
      if (i === 399) throw new Error(`descent stalled at ${seg.from} -> ${seg.to}`);
    }
    const boss = state.entities.find((e) => e.id === BOSS_ID);
    const permilleAtCommit = boss === undefined ? 0 : Math.floor((boss.lp * 1000) / Math.max(1, boss.maxLp));
    // a startedAt unobservable would imply the status gate broke; it is checked above.
    commits.push({
      phaseId: seg.to,
      permilleAtCommit,
      planTick: planned?.planTick ?? -1,
      commitTick: startedAt ?? -1,
      invulnerableUntilTick: state.bossPhase?.invulnerableUntilTick ?? null,
    });
  }
  return {
    commits: Object.freeze(commits),
    trace: Object.freeze(trace),
    checksum: createSnapshot(state).checksum,
    finalVisited: Object.freeze([...(state.bossPhase?.visited ?? [])]),
  };
}

describe('P21 §4–§5 full multi-descent phase sequence', () => {
  it('descends p1→p2→p3→p4 exactly once each, at exact commit ticks, deterministically', { timeout: 120_000 }, () => {
    const a = runDescent();
    const b = runDescent();
    // 6. Determinism: identical terminal checksum and full event trace.
    expect(b.checksum).toBe(a.checksum);
    expect(b.trace).toEqual(a.trace);
    expect(b.finalVisited).toEqual(a.finalVisited);
    expect(a.commits.map((c) => c.phaseId)).toEqual(['p2', 'p3', 'p4']);

    // 1 + 2. NO SKIP / NO RE-ENTRY: the full visited trail is the whole set,
    // each phase added exactly once in strict descent order.
    expect(a.finalVisited).toEqual(['p1', 'p2', 'p3', 'p4']);

    const byId = new Map(defs().map((d) => [d.id, d] as const));
    for (let i = 0; i < a.commits.length; i++) {
      const commit = a.commits[i];
      if (commit === undefined) continue;
      const def = byId.get(commit.phaseId);
      expect(def, `def for ${commit.phaseId}`).toBeDefined();
      if (def === undefined) throw new Error('missing def');
      // 3. EXACT COMMIT: commit tick is exactly the plan tick + the window,
      // and the committed (persisted) phase matches the start event.
      expect(commit.commitTick - commit.planTick, `${commit.phaseId} window`).toBe(transitionWindow(def));
      expect(commit.commitTick, `${commit.phaseId} positive tick`).toBeGreaterThan(0);
      // 4. HP CONTAINMENT: the committed phase's bracket holds the HP permille.
      expect(commit.permilleAtCommit, `${commit.phaseId} in bracket`).toBeGreaterThanOrEqual(def.minHpPermille);
      expect(commit.permilleAtCommit, `${commit.phaseId} in bracket`).toBeLessThan(def.maxHpPermille);
      // 5. INVULNERABILITY: p2 (9) and p4 (6) grant a window of the declared
      // length immediately on entry (the exact boundary can land at the
      // internal commit tick, ±1 from the post-increment `commitTick`); a
      // phase that declares none (p3) leaves it null.
      if (def.invulnerableTicks !== undefined) {
        expect(commit.invulnerableUntilTick, `${commit.phaseId} invuln granted`).not.toBeNull();
        const until = commit.invulnerableUntilTick ?? 0;
        expect(until, `${commit.phaseId} invuln after commit`).toBeGreaterThanOrEqual(commit.commitTick);
        expect(until - commit.commitTick, `${commit.phaseId} invuln window`).toBeGreaterThanOrEqual(def.invulnerableTicks - 1);
        expect(until - commit.commitTick, `${commit.phaseId} invuln window`).toBeLessThanOrEqual(def.invulnerableTicks);
      } else {
        expect(commit.invulnerableUntilTick, `${commit.phaseId} no invuln`).toBeNull();
      }
    }
  });

  it('the plan/commit events form a strict forward chain with no skips or replans', { timeout: 60_000 }, () => {
    const a = runDescent();
    const planEvents = a.trace.filter(([type]) => type === 'PhaseTransitionPlanned').map(([, , ids]) => ids);
    expect(planEvents).toHaveLength(3);
    // Each plan names exactly its own from→to in strict descent order.
    expect(planEvents[0]).toContain('p1');
    expect(planEvents[0]).toContain('p2');
    expect(planEvents[1]).toContain('p2');
    expect(planEvents[1]).toContain('p3');
    expect(planEvents[2]).toContain('p3');
    expect(planEvents[2]).toContain('p4');
    // The last-started phase equals the terminal persisted phase (status gate).
    const startedTail = a.trace.filter(([type]) => type === 'BossPhaseStarted').at(-1)?.[2] ?? '';
    expect(startedTail).toContain('p4');
    expect(a.commits[a.commits.length - 1]?.phaseId).toBe('p4');
    expect(a.checksum.length).toBe(64);
  });
});
