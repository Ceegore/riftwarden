import { describe, expect, it } from 'vitest';
import { stepBattle } from '../../src/game/sim/core/battle-kernel.js';
import { migrateEntity } from '../../src/game/sim/core/migrate.js';
import { createPhase17Systems } from '../../src/game/sim/core/phase17-systems.js';
import { createPhase21Systems } from '../../src/game/sim/core/phase21-systems.js';
import { createSnapshot } from '../../src/game/sim/snapshot/snapshot.js';
import { buildBossObject, buildBossObjectBody, type BossObjectContent } from '../../src/game/sim/boss/boss-object-manager.js';
import type { BossPhaseSnapshot, PhaseDefinition } from '../../src/game/sim/boss/boss-phase-system.js';
import type { KernelSystem } from '../../src/game/sim/core/tick-context.js';
import type { TickInput } from '../../src/game/sim/core/tick-input.js';
import type { BattleModel } from '../../src/game/sim/core/battle-model.js';
import type { PendingCombatApplication } from '../../src/game/sim/combat/combat-application.js';
import { battle, entity, randomSession, tick } from './test-helpers.js';

/**
 * Phase 21 §10 cross-slot race: boss object × multi-boss phase authority.
 *
 * Two bosses share one battle (primary + secondary authority). A boss object
 * (owned by the secondary) damages the PRIMARY while the SECONDARY is
 * mid-transition and then invulnerable. Contract:
 *   1. PER-SLOT ISOLATION — the secondary's mid-transition window never blocks
 *      damage to the primary: the object's hits land every step, and the
 *      secondary's plan stays stable (same commitTick, no replan).
 *   2. PER-SLOT INVULNERABILITY — after the secondary commits its invulnerable
 *      phase, hits on the SECONDARY are immune (DamageApplied with a zero
 *      delta, LP unchanged) while hits on the PRIMARY still land — the gate is
 *      keyed to the target's own slot, not to either boss's global state.
 *   3. WINDOW BOUNDED — the immunity ends exactly when the committed
 *      invulnerable window elapses; the same hit lands again after it.
 *   4. DETERMINISM — two identical runs produce identical checksums and traces.
 */

const input: TickInput = Object.freeze({ paused: false, decisions: Object.freeze([]), contentVersion: 'content_fixture' });

const BOSS_A = 'boss_race_primary';
const BOSS_B = 'boss_race_secondary';
const OBJECT_ID = 'obj_race_hammer';
const BOSS_MAX_LP = 4000;

/** Primary: pa1 full-HP entry, pa2 low bracket, no invulnerability (always damagable). */
const primaryDefs: readonly PhaseDefinition[] = Object.freeze([
  Object.freeze({ id: 'pa1', bossId: BOSS_A, priority: 1, minHpPermille: 501, maxHpPermille: 1001, previewKey: 'preview_pa1' }),
  Object.freeze({ id: 'pa2', bossId: BOSS_A, priority: 2, minHpPermille: 0, maxHpPermille: 501, previewKey: 'preview_pa2' }),
]);
/** Secondary: q1 mid-HP entry, q2 low bracket WITH a 9-tick invulnerable window on entry. */
const secondaryDefs: readonly PhaseDefinition[] = Object.freeze([
  Object.freeze({ id: 'q1', bossId: BOSS_B, priority: 1, minHpPermille: 601, maxHpPermille: 1001, previewKey: 'preview_q1' }),
  Object.freeze({ id: 'q2', bossId: BOSS_B, priority: 2, minHpPermille: 0, maxHpPermille: 601, previewKey: 'preview_q2', invulnerableTicks: 9 }),
]);

const objectContent: BossObjectContent = Object.freeze({
  entityId: OBJECT_ID,
  side: 'enemy',
  ownerId: BOSS_B,
  sourceId: 'content_race',
  spec: Object.freeze({
    slotId: 'boss_slot_0',
    lane: 'middle',
    x100: 5000,
    targetable: true,
    objectiveLink: null,
    damagePolicy: 'normal',
    statusPolicy: 'allow',
    cleanupPolicy: 'on_battle_end',
    fallback: 'FAIL',
  }),
  maxLp: 800,
  radiusX100: 120,
});

function snapshotFor(bossId: string, phaseId: string): BossPhaseSnapshot {
  return Object.freeze({ entityId: bossId, bossId, phaseId, transition: null, visited: Object.freeze([phaseId]), invulnerableUntilTick: null });
}

function buildSystems(): readonly KernelSystem[] {
  return Object.freeze([
    ...createPhase17Systems({ speedsX100PerSecond: {} }),
    ...createPhase21Systems({ bossPhaseDefinitions: [...primaryDefs, ...secondaryDefs], bossObjects: [objectContent] }),
  ]);
}

function buildBattle(): BattleModel {
  const player = migrateEntity({ entity: entity('unit_p', { side: 'player', lane: 'middle', x100: 1800, maxLp: 1000, lp: 1000 }), radiusX100: 100 });
  // Primary at full HP (pa1); secondary seeded at 700 permille (q1, lp 2800).
  const bossA = migrateEntity({ entity: entity(BOSS_A, { side: 'enemy', lane: 'middle', x100: 7000, maxLp: BOSS_MAX_LP, lp: BOSS_MAX_LP }), radiusX100: 120 });
  const bossB = migrateEntity({ entity: entity(BOSS_B, { side: 'enemy', lane: 'bottom', x100: 7000, maxLp: BOSS_MAX_LP, lp: Math.floor((BOSS_MAX_LP * 700) / 1000) }), radiusX100: 120 });
  const objectBody = buildBossObjectBody(objectContent, tick(0));
  const objectTemp = buildBossObject(objectContent.spec, objectContent.entityId, objectContent.side, objectContent.ownerId, objectContent.sourceId, 0, 0);
  return battle({
    simulationVersion: 'phase21-multi-boss-object-race-v1',
    entities: Object.freeze([player, bossA, bossB, objectBody]),
    temporaryEntities: Object.freeze([objectTemp]),
    abilities: Object.freeze([]),
    bossPhase: snapshotFor(BOSS_A, 'pa1'),
    bossPhaseSecondary: snapshotFor(BOSS_B, 'q1'),
  });
}

function damageApp(sourceId: string, targetId: string, amount: number, instance: number): PendingCombatApplication {
  return Object.freeze({
    kind: 'damage',
    sourceId,
    targetId,
    effectId: `ef_race_${String(instance)}`,
    attackInstanceId: instance,
    effectIndex: 0,
    rawAmount: amount,
    damageTypeOrdinal: 0,
    defense: 0,
    coverReductionBps: 0,
    bossCapBps: null,
  });
}

function lpOf(state: BattleModel, id: string): number {
  const found = state.entities.find((e) => e.id === id);
  if (found === undefined) throw new Error(`entity ${id} missing`);
  return found.lp;
}

interface RaceTrace {
  planCommitTick: number | null;
  immuneHitsOnSecondary: number;
  landingHitsOnSecondary: number;
  objectHitsOnPrimary: number;
  primaryDeltaPerObjectHit: number[];
  secondaryLpBeforeImmune: number;
  secondaryLpAfterImmune: number;
  checksum: string;
}

function runRace(): RaceTrace {
  const systems = buildSystems();
  let state = buildBattle();
  const random = randomSession();
  const trace: RaceTrace = {
    planCommitTick: null,
    immuneHitsOnSecondary: 0,
    landingHitsOnSecondary: 0,
    objectHitsOnPrimary: 0,
    primaryDeltaPerObjectHit: [],
    secondaryLpBeforeImmune: -1,
    secondaryLpAfterImmune: -1,
    checksum: '',
  };
  let instance = 0;
  // 1. Queue the opening volley: the object hammers the primary and unit_p
  //    drops the secondary below q1's bracket → q2 is planned (mid-transition).
  state = Object.freeze({
    ...state,
    pendingCombatApplications: Object.freeze([
      damageApp(OBJECT_ID, BOSS_A, 300, ++instance),
      damageApp('unit_p', BOSS_B, 800, ++instance),
    ]),
  });
  // 2. Step until the secondary's q1→q2 transition is planned; while stepping,
  //    the object keeps hammering the primary every tick.
  let planned = false;
  for (let i = 0; i < 300 && !planned; i++) {
    const r = stepBattle({ state, input, random, rules: {}, content: {}, systems });
    state = r.state;
    for (const event of r.events) {
      if (event.type === 'BossTelegraphStarted' && event.contentIds.includes('q2')) {
        planned = true;
        trace.planCommitTick = event.payload['resolveTick'] ?? null;
      }
    }
    if (planned) break;
    state = Object.freeze({
      ...state,
      pendingCombatApplications: Object.freeze([damageApp(OBJECT_ID, BOSS_A, 30, ++instance)]),
    });
  }
  expect(planned, 'q1→q2 must be planned').toBe(true);
  // 3. Walk the transition window to the commit: the secondary's plan stays
  //    stable and the object's primary damage keeps landing every step.
  const primaryBefore = lpOf(state, BOSS_A);
  let committed = false;
  for (let i = 0; i < 200 && !committed; i++) {
    const r = stepBattle({ state, input, random, rules: {}, content: {}, systems });
    state = r.state;
    for (const event of r.events) {
      if (event.type === 'BossPhaseStarted' && event.contentIds.includes('q2')) {
        committed = true;
      }
      if (event.type === 'BossTelegraphStarted' && event.contentIds.includes('q2')) {
        // No replan while the window is open: the plan is idempotent.
        expect(event.payload['resolveTick'] ?? null).toBe(trace.planCommitTick);
      }
      if (event.type === 'DamageApplied' && event.targetIds.includes(BOSS_A)) {
        const delta = event.payload['finalHpDelta'] ?? 0;
        trace.objectHitsOnPrimary += 1;
        trace.primaryDeltaPerObjectHit = [...trace.primaryDeltaPerObjectHit, delta];
      }
    }
    if (committed) break;
    state = Object.freeze({
      ...state,
      pendingCombatApplications: Object.freeze([damageApp(OBJECT_ID, BOSS_A, 30, ++instance)]),
    });
  }
  expect(committed, 'q2 must commit').toBe(true);
  const primaryAfter = lpOf(state, BOSS_A);
  expect(primaryAfter, 'primary took real object damage through the whole window').toBeLessThan(primaryBefore);
  expect(trace.objectHitsOnPrimary).toBeGreaterThan(0);
  // Every object hit landed with a positive delta (the secondary's transition
  // never blocked the primary slot).
  expect(trace.primaryDeltaPerObjectHit.every((delta) => delta > 0)).toBe(true);

  // 4. During the secondary's committed invulnerable window, the same object
  //    hit on the PRIMARY lands while a hit on the SECONDARY is immune.
  const invulnUntil = state.bossPhaseSecondary?.invulnerableUntilTick ?? null;
  expect(invulnUntil, 'q2 grants an invulnerable window').not.toBeNull();
  const secondaryBeforeImmune = lpOf(state, BOSS_B);
  trace.secondaryLpBeforeImmune = secondaryBeforeImmune;
  for (let i = 0; i < 12 && state.tick < (invulnUntil ?? 0); i++) {
    const r = stepBattle({
      state: Object.freeze({
        ...state,
        pendingCombatApplications: Object.freeze([
          damageApp(OBJECT_ID, BOSS_A, 30, ++instance),
          damageApp('unit_p', BOSS_B, 300, ++instance),
        ]),
      }),
      input, random, rules: {}, content: {}, systems,
    });
    state = r.state;
    for (const event of r.events) {
      if (event.type === 'DamageApplied' && event.targetIds.includes(BOSS_B)) {
        const delta = event.payload['finalHpDelta'] ?? 0;
        if (delta === 0) trace.immuneHitsOnSecondary += 1;
        else trace.landingHitsOnSecondary += 1;
      }
    }
  }
  // The primary kept taking damage inside the secondary's immune window.
  expect(trace.immuneHitsOnSecondary).toBeGreaterThan(0);
  expect(trace.landingHitsOnSecondary).toBe(0);
  expect(lpOf(state, BOSS_A)).toBeLessThan(primaryAfter);

  // 5. The same secondary hit lands again once the window elapses.
  let landed = false;
  for (let i = 0; i < 60 && !landed; i++) {
    const r = stepBattle({
      state: Object.freeze({
        ...state,
        pendingCombatApplications: Object.freeze([damageApp('unit_p', BOSS_B, 300, ++instance)]),
      }),
      input, random, rules: {}, content: {}, systems,
    });
    state = r.state;
    for (const event of r.events) {
      if (event.type === 'DamageApplied' && event.targetIds.includes(BOSS_B)) {
        const delta = event.payload['finalHpDelta'] ?? 0;
        if (delta > 0) landed = true;
      }
    }
  }
  expect(landed, 'the secondary hit must land after its window').toBe(true);
  trace.secondaryLpAfterImmune = lpOf(state, BOSS_B);
  expect(trace.secondaryLpAfterImmune).toBeLessThan(trace.secondaryLpBeforeImmune);
  trace.checksum = createSnapshot(state).checksum;
  return trace;
}

describe('P21 §10 boss object × multi-boss phase race', () => {
  it('keeps the primary damagable while the secondary is mid-transition and invulnerable', { timeout: 120_000 }, () => {
    const a = runRace();
    const b = runRace();
    // 4. Determinism: identical checksum and behavior traces.
    expect(b.checksum).toBe(a.checksum);
    expect(b.planCommitTick).toBe(a.planCommitTick);
    expect(b.immuneHitsOnSecondary).toBe(a.immuneHitsOnSecondary);
    expect(b.objectHitsOnPrimary).toBe(a.objectHitsOnPrimary);
    // 1. The plan was stable: commitTick = plan + window, no replans.
    expect(a.planCommitTick).not.toBeNull();
    // 2. Per-slot gate: secondary immune inside its own window only.
    expect(a.immuneHitsOnSecondary).toBeGreaterThan(0);
    expect(a.landingHitsOnSecondary).toBe(0);
    expect(a.primaryDeltaPerObjectHit.every((delta) => delta > 0)).toBe(true);
    // 3. The window is bounded: the same hit lands after it.
    expect(a.secondaryLpAfterImmune).toBeLessThan(a.secondaryLpBeforeImmune);
    expect(a.checksum.length).toBe(64);
  });
});
