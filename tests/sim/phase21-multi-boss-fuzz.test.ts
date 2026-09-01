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
 * Phase 21 §10 multi-boss fuzz.
 *
 * ONE battle carries TWO boss-phase authorities (`bossPhase` + the second
 * `bossPhaseSecondary` slot), each descending INDEPENDENTLY across its own HP
 * and INTERLEAVED in time. Contract under test:
 *   1. INDEPENDENCE — each authority's visited trail is its own strict chain
 *      (primary p1→p2→p3, secondary q1→q2); damage to one boss never moves
 *      the other's phase, and each slot's invulnerability gates only its own
 *      entity.
 *   2. INTERLEAVING — the two authorities commit in a genuine alternating
 *      order in the event stream (primary, secondary, primary), never
 *      serialized into separate battles.
 *   3. EXACT COMMIT — every planned transition commits exactly at its payload
 *      `commitTick` (= plan tick + that phase's transition window), per slot.
 *   4. HP CONTAINMENT — each committed phase's bracket holds its boss's HP
 *      permille at the commit tick.
 *   5. STATUS GATE — the persisted `bossPhase` / `bossPhaseSecondary` always
 *      match the last `BossPhaseStarted` event of their slot.
 *   6. DETERMINISM — two identical runs produce the identical checksum and
 *      full phase event trace.
 */

const input: TickInput = Object.freeze({ paused: false, decisions: Object.freeze([]), contentVersion: 'content_fixture' });
const PRIMARY_ID = 'boss_ash_unit';
const SECONDARY_ID = 'boss_ember_unit';
const BOSS_MAX_LP = 4000;

function defs(): readonly PhaseDefinition[] {
  return Object.freeze([
    // Primary: p1 full-HP entry; p2 (with invulnerability); p3 floor.
    Object.freeze({ id: 'p1', bossId: PRIMARY_ID, priority: 1, minHpPermille: 751, maxHpPermille: 1001, previewKey: 'preview_p1' }),
    Object.freeze({ id: 'p2', bossId: PRIMARY_ID, priority: 2, minHpPermille: 501, maxHpPermille: 751, previewKey: 'preview_p2', transitionTicks: 8, invulnerableTicks: 9 }),
    Object.freeze({ id: 'p3', bossId: PRIMARY_ID, priority: 3, minHpPermille: 0, maxHpPermille: 501, previewKey: 'preview_p3', transitionTicks: 8 }),
    // Secondary: q1 full-HP entry; q2 floor (invulnerable on entry).
    Object.freeze({ id: 'q1', bossId: SECONDARY_ID, priority: 1, minHpPermille: 601, maxHpPermille: 1001, previewKey: 'preview_q1' }),
    Object.freeze({ id: 'q2', bossId: SECONDARY_ID, priority: 2, minHpPermille: 0, maxHpPermille: 601, previewKey: 'preview_q2', transitionTicks: 10, invulnerableTicks: 6 }),
  ]);
}

function transitionWindow(def: PhaseDefinition): number {
  return def.transitionTicks ?? DEFAULT_TRANSITION_TICKS;
}

/** Interleaved scripted descents: primary, then secondary, then primary again. */
const DESCENTS: readonly { readonly bossId: string; readonly to: string; readonly permille: number }[] = Object.freeze([
  Object.freeze({ bossId: PRIMARY_ID, to: 'p2', permille: 625 }),
  Object.freeze({ bossId: SECONDARY_ID, to: 'q2', permille: 400 }),
  Object.freeze({ bossId: PRIMARY_ID, to: 'p3', permille: 120 }),
]);

function slotFor(state: BattleModel, bossId: string): BossPhaseSnapshot | null {
  if (state.bossPhase?.entityId === bossId) return state.bossPhase;
  if (state.bossPhaseSecondary?.entityId === bossId) return state.bossPhaseSecondary;
  return null;
}

function buildSystems(): readonly KernelSystem[] {
  return Object.freeze([
    ...createPhase17Systems({ speedsX100PerSecond: {} }),
    ...createPhase21Systems({ bossPhaseDefinitions: defs() }),
  ]);
}

function buildBattle(): BattleModel {
  const player = migrateEntity({ entity: entity('unit_p', { side: 'player', lane: 'middle', x100: 1800, maxLp: 1000, lp: 1000 }), radiusX100: 100 });
  const primary = migrateEntity({ entity: entity(PRIMARY_ID, { side: 'enemy', lane: 'middle', x100: 7000, maxLp: BOSS_MAX_LP, lp: BOSS_MAX_LP }), radiusX100: 120 });
  const secondary = migrateEntity({ entity: entity(SECONDARY_ID, { side: 'enemy', lane: 'bottom', x100: 7000, maxLp: BOSS_MAX_LP, lp: BOSS_MAX_LP }), radiusX100: 120 });
  return battle({
    simulationVersion: 'phase21-multi-boss-fuzz-v1',
    entities: Object.freeze([player, primary, secondary]),
    abilities: Object.freeze([]),
    bossPhase: Object.freeze({ entityId: PRIMARY_ID, bossId: PRIMARY_ID, phaseId: 'p1', transition: null, visited: Object.freeze(['p1']), invulnerableUntilTick: null }),
    bossPhaseSecondary: Object.freeze({ entityId: SECONDARY_ID, bossId: SECONDARY_ID, phaseId: 'q1', transition: null, visited: Object.freeze(['q1']), invulnerableUntilTick: null }),
  });
}

/** Queue one damage application that drops `bossId`'s LP to `targetPermille`. */
function queueDamage(state: BattleModel, bossId: string, targetPermille: number, instance: number): BattleModel {
  const boss = state.entities.find((e) => e.id === bossId);
  if (boss === undefined) throw new Error(`boss ${bossId} missing`);
  const targetLp = Math.max(1, Math.floor((boss.maxLp * targetPermille) / 1000));
  const amount = boss.lp - targetLp;
  if (amount <= 0) throw new Error(`descent damage must be positive (permille ${String(targetPermille)})`);
  return Object.freeze({
    ...state,
    pendingCombatApplications: Object.freeze([
      Object.freeze({ kind: 'damage', sourceId: 'unit_p', targetId: bossId, effectId: `ef_duo_${String(instance)}`, attackInstanceId: instance, effectIndex: 0, rawAmount: amount, damageTypeOrdinal: 0, defense: 0, coverReductionBps: 0, bossCapBps: null }),
    ]),
  });
}

/** Step (with no queued damage) until `bossId`'s committed invulnerable window has elapsed. */
function waitPastInvulnerable(state: BattleModel, bossId: string, systems: readonly KernelSystem[], random: ReturnType<typeof randomSession>): BattleModel {
  for (let i = 0; i < 200; i++) {
    const until = slotFor(state, bossId)?.invulnerableUntilTick ?? null;
    if (until === null || state.tick >= until) return state;
    const r = stepBattle({ state, input, random, rules: {}, content: {}, systems });
    state = r.state;
  }
  throw new Error(`invulnerable window did not elapse for ${bossId}`);
}

interface CommitRecord {
  readonly bossId: string;
  readonly phaseId: string;
  readonly permilleAtCommit: number;
  readonly planTick: number;
  readonly commitTick: number;
  readonly invulnerableUntilTick: number | null;
}

function runBattle(): { readonly commits: readonly CommitRecord[]; readonly trace: readonly (readonly [string, number, string])[]; readonly checksum: string; readonly primaryVisited: readonly string[]; readonly secondaryVisited: readonly string[] } {
  const systems = buildSystems();
  let state = buildBattle();
  const random = randomSession();
  const trace: [string, number, string][] = [];
  const commits: CommitRecord[] = [];
  for (let index = 0; index < DESCENTS.length; index++) {
    const seg = DESCENTS[index];
    if (seg === undefined) throw new Error('descent segment missing');
    // The prior commit on THIS boss may have granted invulnerability; let it
    // elapse before the next damage so the descent actually resumes.
    if (index > 0) state = waitPastInvulnerable(state, seg.bossId, systems, random);
    state = queueDamage(state, seg.bossId, seg.permille, index + 1);
    let planned: { planTick: number; commitTick: number } | null = null;
    let startedAt: number | null = null;
    for (let i = 0; i < 400; i++) {
      const r = stepBattle({ state, input, random, rules: {}, content: {}, systems });
      state = r.state;
      for (const e of r.events) {
        if (['PhaseTransitionPlanned', 'BossPhaseStarted', 'BossPhaseCompleted'].includes(e.type)) {
          trace.push([e.type, state.tick, e.contentIds.join('/')]);
        }
        if (e.type === 'PhaseTransitionPlanned' && e.sourceId === seg.bossId && e.contentIds.includes(seg.to)) {
          planned = { planTick: state.tick, commitTick: e.payload['commitTick'] ?? 0 };
        }
        if (e.type === 'BossPhaseStarted' && e.sourceId === seg.bossId && e.contentIds.includes(seg.to)) startedAt = state.tick;
      }
      if (slotFor(state, seg.bossId)?.phaseId === seg.to) {
        if (planned === null) throw new Error(`phase ${seg.to} reached without a plan`);
        if (startedAt === null) throw new Error(`phase ${seg.to} reached without a start event`);
        break;
      }
      if (i === 399) throw new Error(`descent stalled at ${seg.to} for ${seg.bossId}`);
    }
    const boss = state.entities.find((e) => e.id === seg.bossId);
    const permilleAtCommit = boss === undefined ? 0 : Math.floor((boss.lp * 1000) / Math.max(1, boss.maxLp));
    commits.push({
      bossId: seg.bossId,
      phaseId: seg.to,
      permilleAtCommit,
      planTick: planned?.planTick ?? -1,
      commitTick: startedAt ?? -1,
      invulnerableUntilTick: slotFor(state, seg.bossId)?.invulnerableUntilTick ?? null,
    });
  }
  return {
    commits: Object.freeze(commits),
    trace: Object.freeze(trace),
    checksum: createSnapshot(state).checksum,
    primaryVisited: Object.freeze([...(state.bossPhase?.visited ?? [])]),
    secondaryVisited: Object.freeze([...(state.bossPhaseSecondary?.visited ?? [])]),
  };
}

describe('P21 §10 multi-boss phase authorities', () => {
  it('descends both bosses independently and interleaved, deterministically', { timeout: 120_000 }, () => {
    const a = runBattle();
    const b = runBattle();
    // 6. Determinism: identical checksum and full event trace.
    expect(b.checksum).toBe(a.checksum);
    expect(b.trace).toEqual(a.trace);
    expect(b.primaryVisited).toEqual(a.primaryVisited);
    expect(b.secondaryVisited).toEqual(a.secondaryVisited);

    // 1. INDEPENDENCE: each authority's trail is its own strict chain.
    expect(a.primaryVisited).toEqual(['p1', 'p2', 'p3']);
    expect(a.secondaryVisited).toEqual(['q1', 'q2']);
    expect(a.commits.map((c) => `${c.bossId}:${c.phaseId}`)).toEqual([
      'boss_ash_unit:p2',
      'boss_ember_unit:q2',
      'boss_ash_unit:p3',
    ]);

    const byId = new Map(defs().map((d) => [d.id, d] as const));
    for (const commit of a.commits) {
      const def = byId.get(commit.phaseId);
      expect(def, `def for ${commit.phaseId}`).toBeDefined();
      if (def === undefined) throw new Error('missing def');
      // 3. EXACT COMMIT per slot: commit tick = plan tick + transition window.
      expect(commit.commitTick - commit.planTick, `${commit.phaseId} window`).toBe(transitionWindow(def));
      // 4. HP CONTAINMENT: the committed phase's bracket holds the boss's permille.
      expect(commit.permilleAtCommit, `${commit.phaseId} in bracket`).toBeGreaterThanOrEqual(def.minHpPermille);
      expect(commit.permilleAtCommit, `${commit.phaseId} in bracket`).toBeLessThan(def.maxHpPermille);
      // Per-slot invulnerability: p2 (9) and q2 (6) grant a window on entry;
      // p3 declares none and stays clear.
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

  it('the interleaved event stream alternates bosses with no cross-slot contamination', { timeout: 60_000 }, () => {
    const a = runBattle();
    // 2. INTERLEAVING: a secondary-boss commit lands BETWEEN two primary-boss
    // commits in the single event stream (proves two live authorities).
    const starts = a.trace.filter(([type]) => type === 'BossPhaseStarted').map(([, , ids]) => ids.split('/')[0]);
    expect(starts.filter((bossId) => bossId === PRIMARY_ID).length).toBe(2);
    expect(starts.filter((bossId) => bossId === SECONDARY_ID).length).toBe(1);
    const firstPrimary = starts.indexOf(PRIMARY_ID);
    const secondaryAt = starts.indexOf(SECONDARY_ID);
    const lastPrimary = starts.lastIndexOf(PRIMARY_ID);
    expect(firstPrimary).toBeGreaterThanOrEqual(0);
    expect(secondaryAt).toBeGreaterThan(firstPrimary);
    expect(lastPrimary).toBeGreaterThan(secondaryAt);
    // 5. STATUS GATE: the persisted slots equal the last-started phase of each slot.
    const startedByBoss = new Map<string, string>();
    for (const [, , ids] of a.trace.filter(([type]) => type === 'BossPhaseStarted')) {
      const [bossId, phaseId] = ids.split('/');
      if (bossId !== undefined && phaseId !== undefined) startedByBoss.set(bossId, phaseId);
    }
    expect(a.primaryVisited.at(-1)).toBe(startedByBoss.get(PRIMARY_ID));
    expect(a.secondaryVisited.at(-1)).toBe(startedByBoss.get(SECONDARY_ID));
    expect(a.checksum.length).toBe(64);
  });
});
