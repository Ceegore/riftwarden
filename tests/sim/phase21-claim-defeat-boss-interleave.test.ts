/**
 * Phase 21 §9 CLAIM × DEFEAT-STACK × BOSS-NODE INTERLEAVE. The interleave in
 * phase21-reengage-claim-interleave uses a BATTLE node for the claim and a
 * battle for the defeat stack; this pins the SAME interleave on the BOSS
 * (0-ENTER, three-way reward) and an ELITE, on seed 903's main path
 * (battle → event → battle → anchor → elite → boss):
 *
 *   NODE A (battle): won + claimed FIRST (the loot that must survive
 *     everything that follows) — the baseline grant.
 *   NODE B (elite): the LOST node — the escalating defeat stack (5, 10, 15)
 *     with a RESTORE CUT mid-loop (after attempt 1): the restored manager
 *     continues at attempt 2 (escalation ledger-persisted), the claim on the
 *     lost elite is REJECTED BY DESIGN (PREREQUISITE_MISSING — a defeat stack
 *     can never become a claim), the stack stays byte-identical through the
 *     restore, then DECLINE clears.
 *   NODE C (boss): the WON BOSS — ENTER costs exactly 0 (the §9 purity pin
 *     inside the interleave), victory ENGAGE (kill_boss) materializes the
 *     THREE-WAY reward, a RESTORE CUT at the ENGAGE→CLAIM boundary keeps the
 *     boss's reward byte-identical, the claim on the RESTORED boss grants the
 *     loot exactly once, a replay grants nothing.
 *
 * The interleave assertion: node A's claimed loot stays EXACTLY ONCE in the
 * pools after the elite's stack + the boss's whole flow (a defeat stack and a
 * boss victory never disturb a granted claim), the boss's reward is
 * byte-identical through its own restore, and the final save is a codec fixed
 * point.
 */
import { describe, expect, it } from 'vitest';
import { RunManager } from '../../src/game/expedition/run-manager.js';
import { mainPath, restoreExpedition } from '../../src/game/expedition/expedition-runner.js';
import { encodeExpeditionSave, restoreExpeditionSave } from '../../src/game/expedition/expedition-save.js';
import { enterTransactionId, actionTransactionId } from '../../src/features/expedition/transaction-ids.js';
import { bountyForKinds, INSTABILITY_CEILING } from '../../src/game/expedition/nodes/handlers/combat.js';
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

function rewardOf(mgr: RunManager, nodeId: string): RewardSnapshot {
  const snap = mgr.snapshot().state.snapshots[nodeId];
  if (snap === undefined || snap.kind !== 'REWARD') throw new Error('no REWARD snapshot');
  return snap;
}

/** The screen's re-engage click on a node: commits the escalating ENGAGE_DEFEAT. */
function clickReengage(mgr: RunManager, nodeId: string, attempt: number): void {
  const runId = mgr.snapshot().state.runId;
  mgr.act({ transactionId: actionTransactionId(runId, nodeId, 'ENGAGE_DEFEAT', `re-${String(attempt)}`), nodeId, action: 'ENGAGE_DEFEAT' });
}

describe('P21 §9 claim × defeat-stack × boss-node interleave', () => {
  it('a won BOSS claim + a lost ELITE defeat stack on ONE RUN: restore cuts at both boundaries, the boss reward byte-identical, the loot exactly once', { timeout: 60_000 }, () => {
    // Seed 903 main path: battle, event, battle, anchor, elite, boss.
    store.clear();
    let mgr = RunManager.create(903, 500);
    const path = mainPath(mgr.map);
    const runId = mgr.snapshot().state.runId;
    const claimedIds: string[] = [];
    const walkedTypes: string[] = [];
    let eliteRestoreHappened = false;
    let bossRestoreHappened = false;
    let eliteBountyRejected = false;

    for (let guard = 0; guard < path.length; guard += 1) {
      const snap = mgr.snapshot();
      const nodeId = snap.currentNodeId;
      const type = snap.currentNodeType;
      walkedTypes.push(type);
      const beforeEnter = mgr.snapshot().state.instability;
      mgr.enter(enterTransactionId(runId, nodeId));
      // The boss ENTER costs exactly 0 (the §9 purity pin inside the interleave).
      if (type === 'boss') {
        expect(mgr.snapshot().state.instability).toBe(beforeEnter);
      }

      if (type === 'battle' && guard === 0) {
        // NODE A — the won battle, claimed FIRST (the baseline that must
        // survive the elite's stack and the boss's whole flow).
        mgr.act({ transactionId: actionTransactionId(runId, nodeId, 'ENGAGE', 'a'), nodeId, action: 'ENGAGE', completedKinds: ['kill_regulars'] });
        const rewardA = rewardOf(mgr, nodeId);
        const optionA = rewardA.rewardIds[0];
        if (optionA === undefined) throw new Error('no reward id');
        const claim = mgr.act({ transactionId: actionTransactionId(runId, nodeId, 'CLAIM_REWARD', optionA), nodeId, action: 'CLAIM_REWARD', optionId: optionA });
        expect(claim.status).toBe('COMMITTED');
        claimedIds.push(optionA);
      } else if (type === 'battle') {
        // The second battle: a plain retreat (a fresh combat node may decline).
        mgr.act({ transactionId: actionTransactionId(runId, nodeId, 'DECLINE', `bd-${String(guard)}`), nodeId, action: 'DECLINE' });
      } else if (type === 'elite') {
        // NODE B — the LOST elite: the escalating stack with a mid-loop restore.
        const stackBefore = mgr.snapshot().state.instability;
        clickReengage(mgr, nodeId, 1);
        expect(mgr.snapshot().state.instability).toBe(stackBefore + 5);
        // RESTORE CUT mid-loop (after attempt 1 — the autosave lands between
        // rewatches): the escalation is ledger-persisted.
        const restored = RunManager.restore();
        expect(restored).not.toBeNull();
        if (restored === null) throw new Error('restore failed');
        mgr = restored;
        expect(mgr.snapshot().state.instability).toBe(stackBefore + 5);
        // The next re-engage on the RESTORED elite is attempt 2: pays 10, not 5.
        const instAfter1 = mgr.snapshot().state.instability;
        clickReengage(mgr, nodeId, 2);
        expect(mgr.snapshot().state.instability).toBe(instAfter1 + 10);
        clickReengage(mgr, nodeId, 3);
        expect(mgr.snapshot().state.instability).toBe(instAfter1 + 10 + 15);
        expect(mgr.snapshot().state.instability).toBeLessThanOrEqual(INSTABILITY_CEILING);
        // The claim on the LOST elite is REJECTED BY DESIGN — a defeat stack
        // can never be turned into a claim.
        const eliteReward = rewardOf(mgr, nodeId);
        const eliteOption = eliteReward.rewardIds[0];
        if (eliteOption === undefined) throw new Error('no elite reward id');
        const claimAttempt = mgr.act({ transactionId: actionTransactionId(runId, nodeId, 'CLAIM_REWARD', 'e-claim'), nodeId, action: 'CLAIM_REWARD', optionId: eliteOption });
        expect(claimAttempt.status).toBe('REJECTED');
        expect(claimAttempt.reason).toBe('PREREQUISITE_MISSING');
        eliteBountyRejected = true;
        // The elite retreats (never a soft-lock).
        mgr.act({ transactionId: actionTransactionId(runId, nodeId, 'DECLINE', 'e-d'), nodeId, action: 'DECLINE' });
        eliteRestoreHappened = true;
      } else if (type === 'boss') {
        // NODE C — the WON BOSS: ENTER costs 0 (already pinned above), and its
        // reward is the THREE-WAY choice.
        const bossRewardAtEnter = rewardOf(mgr, nodeId);
        // The boss's THREE-WAY reward.
        expect(bossRewardAtEnter.rewardIds).toHaveLength(3);
        // Victory ENGAGE (kill_boss) — pays the contract bounty.
        const engage = mgr.act({ transactionId: actionTransactionId(runId, nodeId, 'ENGAGE', 'boss'), nodeId, action: 'ENGAGE', completedKinds: ['kill_boss'] });
        expect(engage.status).toBe('COMMITTED');
        expect(engage.completedKinds).toEqual(['kill_boss']);
        expect(mgr.snapshot().state.gold).toBeGreaterThanOrEqual(90);
        const bounty = bountyForKinds(['kill_boss']);
        expect(bounty).toBe(15);
        const bossRewardAtEngage = rewardOf(mgr, nodeId);
        // RESTORE CUT at the ENGAGE→CLAIM boundary.
        const restored = RunManager.restore();
        expect(restored).not.toBeNull();
        if (restored === null) throw new Error('restore failed');
        mgr = restored;
        // The boss's reward is byte-identical through the restore.
        expect(rewardOf(mgr, nodeId)).toEqual(bossRewardAtEngage);
        // The claim on the RESTORED boss grants the loot exactly once.
        const optionC = bossRewardAtEngage.rewardIds[0];
        if (optionC === undefined) throw new Error('no boss reward id');
        const claim = mgr.act({ transactionId: actionTransactionId(runId, nodeId, 'CLAIM_REWARD', optionC), nodeId, action: 'CLAIM_REWARD', optionId: optionC });
        expect(claim.status).toBe('COMMITTED');
        claimedIds.push(optionC);
        // A replay of the same claim grants nothing (exactly-once across the
        // restore boundary).
        const poolAfter = [...mgr.snapshot().state.securedLoot, ...mgr.snapshot().state.unsecuredLoot];
        const replay = mgr.act({ transactionId: actionTransactionId(runId, nodeId, 'CLAIM_REWARD', optionC), nodeId, action: 'CLAIM_REWARD', optionId: optionC });
        expect(replay.status).toBe('COMMITTED');
        const poolAfterReplay = [...mgr.snapshot().state.securedLoot, ...mgr.snapshot().state.unsecuredLoot];
        expect(poolAfterReplay).toEqual(poolAfter);
        // The boss's reward STILL byte-identical after the claim (a claim
        // never mutates the reward snapshot).
        expect(rewardOf(mgr, nodeId)).toEqual(bossRewardAtEngage);
        bossRestoreHappened = true;
      } else {
        // event / anchor: plain decline.
        mgr.act({ transactionId: actionTransactionId(runId, nodeId, 'DECLINE', `x${String(guard)}`), nodeId, action: 'DECLINE' });
      }
      mgr.resolve();
      const next = path[guard + 1];
      if (next === undefined) break;
      mgr.advance(next);
    }

    // The walk really was the elite→boss path.
    expect(walkedTypes).toEqual(['battle', 'event', 'battle', 'anchor', 'elite', 'boss']);
    expect(eliteRestoreHappened).toBe(true);
    expect(bossRestoreHappened).toBe(true);
    expect(eliteBountyRejected).toBe(true);

    // THE INTERLEAVE: node A's claimed loot AND the boss's claimed loot are
    // each exactly once in the final pools — the elite's defeat stack + both
    // restore cuts never disturbed a granted claim, and the boss's victory
    // bounty was paid once.
    expect(claimedIds).toHaveLength(2);
    expect(new Set(claimedIds).size).toBe(2);
    const finalPool = [...mgr.snapshot().state.securedLoot, ...mgr.snapshot().state.unsecuredLoot];
    for (const id of claimedIds) {
      expect(finalPool.filter((k) => k === id).length, id).toBe(1);
    }
    // The final interleaved save is a codec fixed point.
    const snap = mgr.snapshot();
    const runner = restoreExpedition(snap.state, mgr.map, snap.currentNodeId);
    const serialized = encodeExpeditionSave(runner);
    const restoredFinal = restoreExpeditionSave(serialized, mgr.map);
    expect(encodeExpeditionSave(restoredFinal)).toBe(serialized);
  });
});
