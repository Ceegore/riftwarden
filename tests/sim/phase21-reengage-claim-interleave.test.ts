/**
 * Phase 21 §9 RE-ENGAGE × RELOAD × CLAIM_REWARD INTERLEAVE. The rewatch stack
 * keeps the REWARD snapshot byte-identical, and claims survive a codec cut —
 * this test INTERLEAVES both on ONE RUN, with restore cuts at BOTH boundaries:
 *
 *   NODE A (won):  ENTER → ENGAGE (victory, reward materialized) → SAVE +
 *   RESTORE mid-flow → CLAIM on the RESTORED node grants the persisted reward
 *   exactly once (the claim was never gated by the reload) → a second claim is
 *   REJECTED → resolve.
 *
 *   NODE B (lost): ENTER → ENGAGE_DEFEAT ×1 → SAVE + RESTORE mid-loop → the
 *   next re-engage on the RESTORED node is attempt 2 (the escalation is
 *   ledger-persisted) → a CLAIM on the lost node is REJECTED BY DESIGN
 *   (PREREQUISITE_MISSING — a defeat stack can never be turned into a claim,
 *   the honest reading of "never gated": the re-engages do not and cannot
 *   produce a claim) → DECLINE clears → resolve.
 *
 * The interleave assertion: node A's claimed loot stays EXACTLY ONCE in the
 * loot pools after node B's defeat stack AND the mid-loop restore — the
 * re-engages never disturb a granted claim — and node B's reward snapshot is
 * byte-identical through the whole stack + restore. The final save is a codec
 * fixed point.
 */
import { describe, expect, it } from 'vitest';
import { RunManager } from '../../src/game/expedition/run-manager.js';
import { mainPath, restoreExpedition } from '../../src/game/expedition/expedition-runner.js';
import { encodeExpeditionSave, restoreExpeditionSave } from '../../src/game/expedition/expedition-save.js';
import { enterTransactionId, actionTransactionId } from '../../src/features/expedition/transaction-ids.js';
import type { RewardSnapshot } from '../../src/game/expedition/nodes/types.js';

const store = new Map<string, string>();
(globalThis as { localStorage: unknown }).localStorage = {
  getItem(key: string) { return store.get(String(key)) ?? null; },
  setItem(key: string, value: string) { store.set(String(key), String(value)); },
  removeItem(key: string) { store.delete(String(key)); },
  clear() { store.clear(); },
  get length() { return store.size; },
  key(index: number) { return [...store.keys()][index] ?? null; },
};

const isCombat = (t: string): boolean => t === 'battle' || t === 'elite' || t === 'boss';

function rewardOf(mgr: RunManager, nodeId: string): RewardSnapshot {
  const snap = mgr.snapshot().state.snapshots[nodeId];
  if (snap === undefined || snap.kind !== 'REWARD') throw new Error('no REWARD snapshot');
  return snap;
}

describe('P21 §9 re-engage × reload × claim interleave', () => {
  it('a won node\'s claim survives a mid-flow restore AND a lost node\'s defeat stack + mid-loop restore on the SAME RUN (exactly once, codec fixed point)', { timeout: 60_000 }, () => {
    // Seed 702 main path: battle, battle, battle, anchor, scout, boss — node A
    // (start battle) is won + claimed; node B (second battle) takes the defeat
    // stack; the rest of the walk continues normally.
    store.clear();
    let mgr = RunManager.create(702, 500);
    const path = mainPath(mgr.map);
    const runId = mgr.snapshot().state.runId;
    const claimedIds: string[] = [];
    let combatIndex = 0;
    let cutAtClaim = false;
    let cutMidStack = false;

    for (let guard = 0; guard < path.length; guard += 1) {
      const snap = mgr.snapshot();
      const nodeId = snap.currentNodeId;
      const type = snap.currentNodeType;
      mgr.enter(enterTransactionId(runId, nodeId));

      if (isCombat(type)) {
        combatIndex += 1;
        if (combatIndex === 1) {
          // NODE A — the WON node: victory ENGAGE, then SAVE + RESTORE
          // mid-flow (before the claim), then claim on the RESTORED node.
          mgr.act({ transactionId: actionTransactionId(runId, nodeId, 'ENGAGE', 'a'), nodeId, action: 'ENGAGE', completedKinds: ['kill_regulars'] });
          const rewardA = rewardOf(mgr, nodeId);
          const optionA = rewardA.rewardIds[0];
          if (optionA === undefined) throw new Error('no reward id');
          // RELOAD at the ENGAGE→CLAIM boundary (the same boundary the
          // mid-fight-save pins, but HERE inside the interleave run).
          const restored = RunManager.restore();
          expect(restored).not.toBeNull();
          if (restored === null) throw new Error('restore failed');
          expect(rewardOf(restored, nodeId)).toEqual(rewardA);
          // The claim on the restored node grants exactly once.
          const claim = restored.act({ transactionId: actionTransactionId(runId, nodeId, 'CLAIM_REWARD', optionA), nodeId, action: 'CLAIM_REWARD', optionId: optionA });
          expect(claim.status).toBe('COMMITTED');
          claimedIds.push(optionA);
          // Replaying the SAME claim id across the restore boundary returns the
          // stored COMMITTED record with zero mutation — exactly-once holds
          // even though the claim was granted on the restored node.
          const poolAfterClaim = [...restored.snapshot().state.securedLoot, ...restored.snapshot().state.unsecuredLoot];
          const replay = restored.act({ transactionId: actionTransactionId(runId, nodeId, 'CLAIM_REWARD', optionA), nodeId, action: 'CLAIM_REWARD', optionId: optionA });
          expect(replay.status).toBe('COMMITTED');
          const poolAfterReplay = [...restored.snapshot().state.securedLoot, ...restored.snapshot().state.unsecuredLoot];
          expect(poolAfterReplay).toEqual(poolAfterClaim);
          mgr = restored;
          cutAtClaim = true;
        } else if (combatIndex === 2) {
          // NODE B — the LOST node: defeat stack with a mid-loop restore.
          const snapshotB0 = rewardOf(mgr, nodeId);
          const re1 = mgr.act({ transactionId: actionTransactionId(runId, nodeId, 'ENGAGE_DEFEAT', 'b-1'), nodeId, action: 'ENGAGE_DEFEAT' });
          expect(re1.status).toBe('COMMITTED');
          // SAVE + RESTORE mid-loop (after attempt 1 — the autosave lands
          // between rewatches).
          const restored = RunManager.restore();
          expect(restored).not.toBeNull();
          if (restored === null) throw new Error('restore failed');
          mgr = restored;
          // The reward snapshot is byte-identical through the defeat + restore.
          expect(rewardOf(mgr, nodeId)).toEqual(snapshotB0);
          // The next re-engage on the RESTORED node is attempt 2: the
          // escalation is ledger-persisted (5 already committed → 10 now).
          const instBefore = mgr.snapshot().state.instability;
          const re2 = mgr.act({ transactionId: actionTransactionId(runId, nodeId, 'ENGAGE_DEFEAT', 'b-2'), nodeId, action: 'ENGAGE_DEFEAT' });
          expect(re2.status).toBe('COMMITTED');
          expect(mgr.snapshot().state.instability).toBe(instBefore + 10);
          // The claim is REJECTED BY DESIGN on a defeated node — a defeat
          // stack can never be turned into a claim (PREREQUISITE_MISSING).
          const bOption = snapshotB0.rewardIds[0];
          if (bOption === undefined) throw new Error('no reward id');
          const claimAttempt = mgr.act({ transactionId: actionTransactionId(runId, nodeId, 'CLAIM_REWARD', 'b-claim'), nodeId, action: 'CLAIM_REWARD', optionId: bOption });
          expect(claimAttempt.status).toBe('REJECTED');
          expect(claimAttempt.reason).toBe('PREREQUISITE_MISSING');
          // And the ENGAGE that would precede a claim is ACTION_LIMIT (a
          // defeat cannot flip into a win) — the node is sealed lost.
          const engageAttempt = mgr.act({ transactionId: actionTransactionId(runId, nodeId, 'ENGAGE', 'b-win'), nodeId, action: 'ENGAGE', completedKinds: [] });
          expect(engageAttempt.status).toBe('REJECTED');
          expect(engageAttempt.reason).toBe('ACTION_LIMIT');
          // The reward snapshot STILL byte-identical after the rejected
          // claim/engage attempts (nothing mutated it).
          expect(rewardOf(mgr, nodeId)).toEqual(snapshotB0);
          // Retreat clears the lost node (never a soft-lock).
          mgr.act({ transactionId: actionTransactionId(runId, nodeId, 'DECLINE', 'b-d'), nodeId, action: 'DECLINE' });
          cutMidStack = true;
        } else {
          // The remaining combat nodes (battle 3, boss) win + claim normally.
          mgr.act({ transactionId: actionTransactionId(runId, nodeId, 'ENGAGE', `w${String(combatIndex)}`), nodeId, action: 'ENGAGE', completedKinds: ['kill_regulars'] });
          const reward = rewardOf(mgr, nodeId);
          const optionId = reward.rewardIds[0];
          if (optionId !== undefined) {
            const claim = mgr.act({ transactionId: actionTransactionId(runId, nodeId, 'CLAIM_REWARD', optionId), nodeId, action: 'CLAIM_REWARD', optionId });
            if (claim.status === 'COMMITTED') claimedIds.push(optionId);
          } else {
            throw new Error('no reward id');
          }
        }
      } else {
        mgr.act({ transactionId: actionTransactionId(runId, nodeId, 'DECLINE', `x${String(guard)}`), nodeId, action: 'DECLINE' });
      }
      mgr.resolve();
      const next = path[guard + 1];
      if (next === undefined) break;
      mgr.advance(next);
    }

    // Both interleave boundaries really happened.
    expect(cutAtClaim).toBe(true);
    expect(cutMidStack).toBe(true);

    // THE INTERLEAVE: every claimed id (A + the later wins) is exactly once
    // in the loot pools — node B's defeat stack + mid-loop restore never
    // disturbed a granted claim.
    expect(claimedIds.length).toBeGreaterThanOrEqual(3);
    expect(new Set(claimedIds).size).toBe(claimedIds.length);
    const finalPool = [...mgr.snapshot().state.securedLoot, ...mgr.snapshot().state.unsecuredLoot];
    for (const id of claimedIds) {
      expect(finalPool.filter((k) => k === id).length, id).toBe(1);
    }

    // The final save (whole interleaved run) is a codec fixed point: encode
    // the runner the manager wraps → decode → restore → re-encode is identical.
    const snap = mgr.snapshot();
    const runner = restoreExpedition(snap.state, mgr.map, snap.currentNodeId);
    const serialized = encodeExpeditionSave(runner);
    const restoredFinal = restoreExpeditionSave(serialized, mgr.map);
    expect(encodeExpeditionSave(restoredFinal)).toBe(serialized);
  });
});
