/**
 * Phase 21 §9 MASTERY-KILLS LEDGER DIFFERENTIAL. The kills differential proved
 * `killsEarned` is a clean-room fold of the ledger; this differential pins the
 * SECOND kill-adjacent scalar — `masteryKillsApplied`, the per-hero mastery
 * bridge that `RunManager.act` runs on every committed combat ENGAGE:
 *
 *   1. INVARIANT — `state.masteryKillsApplied ≤ state.killsEarned` at every
 *      step (the bridge can only ever catch UP to the earned total);
 *   2. ADVANCE RULE — it changes ONLY immediately after a COMMITTED victory
 *      ENGAGE, and then lands EXACTLY on `killsEarned` (the bridge applies the
 *      full missing delta); defeats, replays, retreats and non-combat actions
 *      never move it;
 *   3. DURABLE MARKERS — the mastery store's `processedCombatKillsForRun`
 *      (the sum over the run's `runId:txId` markers) equals
 *      `masteryKillsApplied` at every step;
 *   4. SAVE BOUNDARY — both scalars survive encode → restore, and replaying
 *      the same ENGAGE on the restored run never double-applies (the marker
 *      already exists → missing = 0).
 */
import { describe, expect, it } from 'vitest';
import { RunManager } from '../../src/game/expedition/run-manager.js';
import { mainPath } from '../../src/game/expedition/expedition-runner.js';
import { enterTransactionId, actionTransactionId } from '../../src/features/expedition/transaction-ids.js';
import { createInitialProfile, ensureStarterHero, saveProfile } from '../../src/game/profile/profile-store.js';
import { loadMasteryState, processedCombatKillsForRun } from '../../src/game/mastery/mastery-store.js';
import { clearMasteryState } from '../../src/game/mastery/mastery-store.js';
import { restoreExpeditionSave } from '../../src/game/expedition/expedition-save.js';

// RunManager.act persists through the expedition store AND the mastery bridge
// reads/writes the profile/formation/mastery stores — all through localStorage.
const store = new Map<string, string>();
(globalThis as { localStorage: unknown }).localStorage = {
  getItem(key: string) { return store.get(String(key)) ?? null; },
  setItem(key: string, value: string) { store.set(String(key), String(value)); },
  removeItem(key: string) { store.delete(String(key)); },
  clear() { store.clear(); },
  get length() { return store.size; },
  key(index: number) { return [...store.keys()][index] ?? null; },
};

/** A manager whose profile has one unlocked hero, so the mastery bridge has a target. */
function managerWithHero(seed: number): RunManager {
  store.clear();
  clearMasteryState();
  saveProfile(ensureStarterHero(createInitialProfile()));
  return RunManager.create(seed, 200);
}

/** A full main-path walk through the REAL manager asserting the mastery invariants at every step. */
function walkWithMasteryOracle(seed: number): { readonly victories: number; readonly defeats: number } {
  const mgr = managerWithHero(seed);
  const path = mainPath(mgr.map);
  const runId = mgr.snapshot().state.runId;
  let victories = 0;
  let defeats = 0;
  const assertInvariant = (label: string): void => {
    const snap = mgr.snapshot();
    const applied = snap.state.masteryKillsApplied;
    const earned = snap.state.killsEarned;
    expect(applied, `${label} masteryKillsApplied ≤ killsEarned`).toBeLessThanOrEqual(earned);
    expect(applied, `${label} masteryKillsApplied is a non-negative safe integer`).toBeGreaterThanOrEqual(0);
    // The durable markers in the mastery store exactly match the scalar.
    expect(processedCombatKillsForRun(loadMasteryState(), runId), `${label} store markers === masteryKillsApplied`).toBe(applied);
  };
  for (let guard = 0; guard < path.length; guard += 1) {
    const snap = mgr.snapshot();
    const nodeId = snap.currentNodeId;
    const type = snap.currentNodeType;
    const appliedBefore = snap.state.masteryKillsApplied;
    mgr.enter(enterTransactionId(runId, nodeId));
    assertInvariant(`after ENTER ${nodeId}`);
    if (type === 'battle' || type === 'elite' || type === 'boss') {
      const victory = guard % 3 !== 0;
      const record = mgr.act({
        transactionId: actionTransactionId(runId, nodeId, victory ? 'ENGAGE' : 'ENGAGE_DEFEAT', 'none'),
        nodeId,
        action: victory ? 'ENGAGE' : 'ENGAGE_DEFEAT',
        ...(victory ? { completedKinds: ['kill_regulars'] } : {}),
      });
      expect(record.status).toBe('COMMITTED');
      assertInvariant(`after ${victory ? 'ENGAGE' : 'ENGAGE_DEFEAT'} ${nodeId}`);
      if (victory) {
        victories += 1;
        // ADVANCE RULE: a committed victory ENGAGE lands masteryKillsApplied
        // exactly on the new killsEarned total (the bridge applies the delta).
        const after = mgr.snapshot();
        expect(after.state.masteryKillsApplied).toBe(after.state.killsEarned);
        expect(after.state.masteryKillsApplied).toBeGreaterThanOrEqual(appliedBefore);
        // REPLAY of the same transaction: grants nothing, bridge moves nothing.
        mgr.act({
          transactionId: actionTransactionId(runId, nodeId, 'ENGAGE', 'none'),
          nodeId,
          action: 'ENGAGE',
          completedKinds: ['kill_regulars'],
        });
        const replayed = mgr.snapshot();
        expect(replayed.state.masteryKillsApplied).toBe(after.state.masteryKillsApplied);
      } else {
        defeats += 1;
        // A DEFEAT moves no kills and the bridge must not advance.
        expect(mgr.snapshot().state.masteryKillsApplied).toBe(appliedBefore);
      }
    } else {
      mgr.act({ transactionId: actionTransactionId(runId, nodeId, 'DECLINE', 'none'), nodeId, action: 'DECLINE' });
      // Non-combat actions never touch the mastery scalar.
      expect(mgr.snapshot().state.masteryKillsApplied).toBe(appliedBefore);
    }
    mgr.resolve();
    assertInvariant(`after resolve ${nodeId}`);
    const next = path[guard + 1];
    if (next === undefined) break;
    mgr.advance(next);
  }
  return { victories, defeats };
}

describe('P21 §9 mastery-kills ledger differential', () => {
  it('masteryKillsApplied ≤ killsEarned at every step; advances only on committed victory ENGAGEs', () => {
    for (const seed of [801, 802, 803]) {
      const stats = walkWithMasteryOracle(seed);
      expect(stats.victories).toBeGreaterThanOrEqual(1);
      expect(stats.defeats).toBeGreaterThanOrEqual(1);
    }
  });

  it('the mastery bridge and the scalars survive a save/restore without double-applying', () => {
    const seed = 804;
    const mgr = managerWithHero(seed);
    const runId = mgr.snapshot().state.runId;
    // The run starts on a battle node (role 'start' → battle) — commit one
    // victory ENGAGE there.
    const snap = mgr.snapshot();
    if (snap.currentNodeType !== 'battle') throw new Error('start node is not battle');
    const nodeId = snap.currentNodeId;
    mgr.enter(enterTransactionId(runId, nodeId));
    const engageTx = actionTransactionId(runId, nodeId, 'ENGAGE', 'none');
    const record = mgr.act({ transactionId: engageTx, nodeId, action: 'ENGAGE', completedKinds: ['kill_regulars'] });
    expect(record.status).toBe('COMMITTED');
    const after = mgr.snapshot();
    expect(after.state.masteryKillsApplied).toBe(after.state.killsEarned);
    expect(after.state.masteryKillsApplied).toBeGreaterThan(0);
    const markerTotal = processedCombatKillsForRun(loadMasteryState(), runId);
    expect(markerTotal).toBe(after.state.masteryKillsApplied);

    // SAVE → RESTORE: both scalars survive byte-identically. The manager's
    // persisted save is what `saveExpedition` wrote to the store; restore it
    // through the codec with the manager's own map (mapHash-guarded).
    const stored = store.get('rw.expedition.v1') ?? '';
    if (stored.length === 0) throw new Error('no stored expedition save');
    const restored = restoreExpeditionSave(stored, mgr.map);
    expect(restored.state.masteryKillsApplied).toBe(after.state.masteryKillsApplied);
    expect(restored.state.killsEarned).toBe(after.state.killsEarned);
    // The durable marker for the transaction survived (it lives in the mastery
    // store, untouched by the expedition save/restore).
    expect(loadMasteryState().processedCombatTransactions?.[`${runId}:${engageTx}`]).toBe(after.state.masteryKillsApplied);
    // REPLAYING the same ENGAGE on the RESTORED run: the bridge sees the marker
    // already present → missing = 0 → neither scalar moves (the runner's act
    // returns the replayed runner; the committed record is on its ledger).
    const replayed = restored.act({ transactionId: engageTx, nodeId, action: 'ENGAGE', completedKinds: ['kill_regulars'] });
    expect(replayed.state.ledger[engageTx]?.status).toBe('COMMITTED');
    expect(replayed.state.masteryKillsApplied).toBe(after.state.masteryKillsApplied);
    expect(replayed.state.killsEarned).toBe(after.state.killsEarned);
  });
});
