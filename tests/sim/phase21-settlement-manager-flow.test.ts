/**
 * Phase 21 §9 SETTLEMENT THROUGH THE REAL MANAGER. The parity differential
 * drove `applyExpeditionTracking` in isolation; this test wires the settlement
 * path through the REAL `RunManager`/`ExpeditionRunner` flow — the exact seam
 * `ExpeditionEndScreen` runs at run end (`buildSettlementRequests` +
 * `applyExpeditionTracking` over the manager state). It pins the SAME fold the
 * differential proved, but from live manager state:
 *
 *   1. REAL PER-ENGAGE BRIDGE — every victory ENGAGE the manager commits calls
 *      `recordCombatMasteryKills` and lands `masteryKillsApplied ===
 *      killsEarned` immediately, so a run fought WITH a hero tracked is
 *      fully-bridged at settlement: the remainder is 0, the settlement writes
 *      NO `runId:settlement` marker, and the hero's profile kills equal the
 *      run's killsEarned (never more).
 *   2. LATE-HERO REMAINDER — when combat is committed BEFORE any hero exists
 *      (empty profile ⇒ `trackingHeroIds()` is empty ⇒ the per-ENGAGE bridge
 *      no-ops and `masteryKillsApplied` stays 0), the settlement path applies
 *      the kills: unlocking a hero before run end makes the settlement
 *      remainder `=== killsEarned`, folded with EXACTLY ONE `runId:settlement`
 *      marker — the remainder path exercised through the real manager, not
 *      just the pure function.
 *   3. EXACTLY-ONCE + DURABILITY — re-settling the same finished run adds
 *      nothing and writes no second marker; the marker + profile kills survive
 *      a save → restore → re-settle (the durable marker already covers the
 *      total ⇒ remainder 0 ⇒ no double-count even after a reload).
 */
import { describe, expect, it } from 'vitest';
import { RunManager } from '../../src/game/expedition/run-manager.js';
import { mainPath } from '../../src/game/expedition/expedition-runner.js';
import { enterTransactionId, actionTransactionId } from '../../src/features/expedition/transaction-ids.js';
import { createInitialProfile, ensureStarterHero, saveProfile } from '../../src/game/profile/profile-store.js';
import { loadMasteryState, clearMasteryState, saveMasteryState, processedCombatKillsForRun } from '../../src/game/mastery/mastery-store.js';
import { loadFormationState, saveFormationState, clearFormationState } from '../../src/game/formations/formation-store.js';
import { loadAllPersistentState, applyExpeditionTracking, clearAllPersistentState } from '../../src/game/expedition/settlement-bridge.js';
import { buildSettlementRequests } from '../../src/game/expedition/expedition-settlement.js';
import { restoreStoredExpedition } from '../../src/game/expedition/expedition-store.js';

const store = new Map<string, string>();
(globalThis as { localStorage: unknown }).localStorage = {
  getItem(key: string) { return store.get(key) ?? null; },
  setItem(key: string, value: string) { store.set(key, value); },
  removeItem(key: string) { store.delete(key); },
  clear() { store.clear(); },
  get length() { return store.size; },
  key(index: number) { return [...store.keys()][index] ?? null; },
};

/** Full reset of every store the settlement flow touches. */
function resetAll(): void {
  store.clear();
  clearMasteryState();
  clearFormationState();
  clearAllPersistentState();
}

/** Manager with ONE unlocked + formation-placed hero so the per-ENGAGE bridge has a target. */
function managerWithHero(seed: number): { mgr: RunManager; heroId: string } {
  resetAll();
  const profile = ensureStarterHero(createInitialProfile());
  saveProfile(profile);
  const heroId = Object.values(profile.heroes).find((h) => h.unlocked)?.id;
  if (heroId === undefined) throw new Error('no starter hero');
  // Place the hero in the active formation so `trackingHeroIds()` finds it.
  const formation = loadFormationState();
  saveFormationState({ ...formation, placement: { ...formation.placement, middle_center: heroId } });
  return { mgr: RunManager.create(seed, 300), heroId };
}

/** Manager whose profile is EMPTY (no hero) — the per-ENGAGE bridge no-ops. */
function managerWithoutHero(seed: number): RunManager {
  resetAll();
  return RunManager.create(seed, 300);
}

/** Walks `mgr` along the main path committing VICTORY ENGAGEs (kills earned). */
function walkVictories(mgr: RunManager): void {
  const path = mainPath(mgr.map);
  const runId = mgr.snapshot().state.runId;
  for (let guard = 0; guard < path.length; guard += 1) {
    const snap = mgr.snapshot();
    const nodeId = snap.currentNodeId;
    const type = snap.currentNodeType;
    mgr.enter(enterTransactionId(runId, nodeId));
    if (type === 'battle' || type === 'elite' || type === 'boss') {
      mgr.act({
        transactionId: actionTransactionId(runId, nodeId, 'ENGAGE', 'none'),
        nodeId,
        action: 'ENGAGE',
        completedKinds: ['kill_regulars'],
      });
    } else {
      mgr.act({ transactionId: actionTransactionId(runId, nodeId, 'DECLINE', 'none'), nodeId, action: 'DECLINE' });
    }
    mgr.resolve();
    const next = path[guard + 1];
    if (next === undefined) break;
    mgr.advance(next);
  }
}

/** The exact run-end settlement the END screen performs over the manager state. */
function settleManager(mgr: RunManager, missionId: string): ReturnType<typeof applyExpeditionTracking> {
  const snap = mgr.snapshot();
  const all = loadAllPersistentState();
  return applyExpeditionTracking(
    snap.state, 'victory', missionId, snap.state.goldEarned, Object.keys(snap.state.visits).length, all,
  );
}

describe('P21 §9 settlement through the real manager', () => {
  it('a hero-tracked run is fully bridged at settlement: remainder 0, NO settlement marker, profile exactly killsEarned', { timeout: 60_000 }, () => {
    const { mgr, heroId } = managerWithHero(6001);
    walkVictories(mgr);
    const pre = mgr.snapshot();
    expect(pre.state.killsEarned).toBeGreaterThan(0);
    // The per-ENGAGE bridge catches up live, so the run is fully bridged.
    expect(pre.state.masteryKillsApplied).toBe(pre.state.killsEarned);
    expect(loadMasteryState().heroes[heroId]?.kills).toBe(pre.state.killsEarned);

    // Run-end settlement: remainder = killsEarned − max(applied, markers) = 0.
    const settled = settleManager(mgr, 'mission_act1');
    expect(settled.mastery.heroes[heroId]?.kills).toBe(pre.state.killsEarned); // nothing added
    expect(settled.mastery.processedCombatTransactions?.[`${pre.state.runId}:settlement`]).toBeUndefined();

    // Settle AGAIN over the same finished state — still nothing (idempotent).
    saveMasteryState(settled.mastery);
    const resettled = settleManager(mgr, 'mission_act1');
    expect(resettled.mastery.heroes[heroId]?.kills).toBe(pre.state.killsEarned);
    expect(resettled.mastery.processedCombatTransactions?.[`${pre.state.runId}:settlement`]).toBeUndefined();
  });

  it('combat committed BEFORE any hero exists leaves a remainder the settlement alone applies, exactly once and durably', { timeout: 60_000 }, () => {
    const mgr = managerWithoutHero(6002);
    walkVictories(mgr);
    const pre = mgr.snapshot();
    expect(pre.state.killsEarned).toBeGreaterThan(0);
    // Empty profile ⇒ per-ENGAGE bridge no-ops ⇒ the scalar never caught up.
    expect(pre.state.masteryKillsApplied).toBe(0);

    // NOW unlock + place a hero (the player chooses their squad at run end)…
    const profile = ensureStarterHero(createInitialProfile());
    saveProfile(profile);
    const heroId = Object.values(profile.heroes).find((h) => h.unlocked)?.id;
    if (heroId === undefined) throw new Error('no starter hero');
    const formation = loadFormationState();
    saveFormationState({ ...formation, placement: { ...formation.placement, middle_center: heroId } });

    // …and settle. The remainder path applies ALL earned kills with ONE marker.
    const settled = settleManager(mgr, 'mission_act1');
    expect(settled.mastery.heroes[heroId]?.kills).toBe(pre.state.killsEarned);
    expect(settled.mastery.processedCombatTransactions?.[`${pre.state.runId}:settlement`]).toBe(pre.state.killsEarned);

    // DURABILITY: persist the settlement's mastery, restore the RUN from the
    // store (the manager autosaves every mutation), then settle the restored
    // run — the durable settlement marker already covers the total ⇒ nothing
    // double-applies and no second marker appears.
    saveMasteryState(settled.mastery);
    const restored = restoreStoredExpedition(mgr.map);
    if (restored === null) throw new Error('store restore failed');
    const reSettled = applyExpeditionTracking(
      restored.state, 'victory', 'mission_act1', restored.state.goldEarned, Object.keys(restored.state.visits).length, loadAllPersistentState(),
    );
    expect(reSettled.mastery.heroes[heroId]?.kills).toBe(pre.state.killsEarned);
    expect(reSettled.mastery.processedCombatTransactions?.[`${pre.state.runId}:settlement`]).toBe(pre.state.killsEarned);
    // The stored profile state reflects the same total.
    expect(loadMasteryState().heroes[heroId]?.kills).toBe(pre.state.killsEarned);
  });

  it('buildSettlementRequests over the real manager state is replayable (content-derived, identical ids)', { timeout: 60_000 }, () => {
    const { mgr } = managerWithHero(6003);
    walkVictories(mgr);
    const snap = mgr.snapshot();
    const a = buildSettlementRequests(snap.state, 'victory');
    const b = buildSettlementRequests(snap.state, 'victory');
    expect(a.outcome).toBe('victory');
    expect(a.requests.map((r) => r.transactionId)).toEqual(b.requests.map((r) => r.transactionId));
    expect(a.settlement.keptGold).toBeGreaterThanOrEqual(0);
  });

  it('a run driven to an actual terminal .finish() settles with the mastery scalars + markers + settlement marker all agreeing with killsEarned', { timeout: 60_000 }, () => {
    // The manager's `.finish()` marks the run finished; the END screen then
    // runs the EXACT settlement over the finished state. This test pins the
    // full close: `masteryKillsApplied` (the per-ENGAGE bridge) + the durable
    // `processedCombatKillsForRun` markers + the `runId:settlement` marker all
    // agree with `killsEarned` at close — no gap, no double-count.
    const { mgr, heroId } = managerWithHero(6004);
    walkVictories(mgr);
    const pre = mgr.snapshot();
    expect(pre.state.killsEarned).toBeGreaterThan(0);
    // The per-ENGAGE bridge already caught up live (hero tracked from the start).
    expect(pre.state.masteryKillsApplied).toBe(pre.state.killsEarned);

    // TERMINAL: finish the run through the manager (runStatus → finished).
    mgr.finish();
    expect(mgr.snapshot().runStatus).toBe('finished');
    // A finished run rejects further mutations.
    expect(() => { mgr.enter('post-finish-enter'); }).toThrow('RUN_ALREADY_FINISHED');

    // SETTLE the finished state with the END screen's exact path.
    const settled = settleManager(mgr, 'mission_act1');
    // At close: applied + remaining == earned. Here remaining is 0 (fully
    // bridged), so the hero kills equal the run's killsEarned and the fold of
    // the durable markers (per-ENGAGE, no settlement marker) equals it too.
    expect(settled.mastery.heroes[heroId]?.kills).toBe(pre.state.killsEarned);
    expect(settled.mastery.processedCombatTransactions?.[`${pre.state.runId}:settlement`]).toBeUndefined();
    expect(processedCombatKillsForRun(settled.mastery, pre.state.runId)).toBe(pre.state.killsEarned);
    // The THREE views of the ledger agree at close:
    //   scalar masteryKillsApplied == earned, markers fold == earned.
    const markerTotal = processedCombatKillsForRun(settled.mastery, pre.state.runId);
    expect(markerTotal).toBe(pre.state.killsEarned);
    expect(settled.mastery.heroes[heroId]?.kills).toBe(markerTotal);

    // The LATE-HERO close: combat before any hero ⇒ scalar stayed 0 ⇒ the
    // settlement remainder is exactly killsEarned and folds with ONE marker.
    const late = managerWithoutHero(6005);
    walkVictories(late);
    const latePre = late.snapshot();
    expect(latePre.state.killsEarned).toBeGreaterThan(0);
    expect(latePre.state.masteryKillsApplied).toBe(0);
    const profile = ensureStarterHero(createInitialProfile());
    saveProfile(profile);
    const lateHeroId = Object.values(profile.heroes).find((h) => h.unlocked)?.id;
    if (lateHeroId === undefined) throw new Error('no starter hero');
    const formation = loadFormationState();
    saveFormationState({ ...formation, placement: { ...formation.placement, middle_center: lateHeroId } });
    late.finish();
    expect(late.snapshot().runStatus).toBe('finished');
    const lateSettled = settleManager(late, 'mission_act1');
    expect(lateSettled.mastery.heroes[lateHeroId]?.kills).toBe(latePre.state.killsEarned);
    expect(lateSettled.mastery.processedCombatTransactions?.[`${latePre.state.runId}:settlement`]).toBe(latePre.state.killsEarned);
    expect(processedCombatKillsForRun(lateSettled.mastery, latePre.state.runId)).toBe(latePre.state.killsEarned);

    // RESETTLE the finished run: the durable settlement marker already covers
    // the total ⇒ remainder 0 ⇒ nothing double-applies, no second marker.
    saveMasteryState(lateSettled.mastery);
    const resettled = settleManager(late, 'mission_act1');
    expect(resettled.mastery.heroes[lateHeroId]?.kills).toBe(latePre.state.killsEarned);
    expect(resettled.mastery.processedCombatTransactions?.[`${latePre.state.runId}:settlement`]).toBe(latePre.state.killsEarned);
  });
});
