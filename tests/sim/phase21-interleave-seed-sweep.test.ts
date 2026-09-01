/**
 * Phase 21 §9 BOSS CLAIM × DEFEAT-STACK INTERLEAVE ACROSS A SEED SWEEP. The
 * single-seed interleave (phase21-claim-defeat-boss-interleave, seed 903)
 * pins one walk; this sweeps the ENTIRE probed elite-before-boss class (all
 * 27 seeds in {860..980} whose main path puts an elite before the boss) and
 * drives the SAME interleave on every walk:
 *
 *   NODE A (first battle) — won + claimed FIRST (the baseline grant);
 *   ELITE(s) — the escalating 5→10→15 defeat stack with a RESTORE CUT after
 *     attempt 1 (the restored manager continues at attempt 2 — the escalation
 *     is ledger-persisted, and every seed in the class commits the FULL stack
 *     on the interleave walk, probe-verified);
 *   BOSS — ENTER costs exactly 0, victory ENGAGE (kill_boss) materializes the
 *     THREE-WAY reward, a RESTORE CUT at the ENGAGE→CLAIM boundary keeps it
 *     byte-identical, the claim grants the loot exactly once.
 *
 * On every seed of the class: the fold oracle equals the instability scalar at
 * every step, instability never passes the bound, the claimed loot is exactly
 * once in the final pools (a defeat stack + two restore cuts never disturb
 * granted claims), and the final save is a codec fixed point.
 */
import { describe, expect, it } from 'vitest';
import { RunManager } from '../../src/game/expedition/run-manager.js';
import { mainPath, restoreExpedition } from '../../src/game/expedition/expedition-runner.js';
import { encodeExpeditionSave, restoreExpeditionSave } from '../../src/game/expedition/expedition-save.js';
import { enterTransactionId, actionTransactionId } from '../../src/features/expedition/transaction-ids.js';
import { bountyForKinds, INSTABILITY_CEILING } from '../../src/game/expedition/nodes/handlers/combat.js';
import type { RewardSnapshot, TransactionRecord } from '../../src/game/expedition/nodes/types.js';
import type { ExpeditionMap } from '../../src/game/expedition/types.js';

const store = new Map<string, string>();
(globalThis as { localStorage: unknown }).localStorage = {
  getItem(key: string) { return store.get(String(key)) ?? null; },
  setItem(key: string, value: string) { store.set(String(key), String(value)); },
  removeItem(key: string) { store.delete(String(key)); },
  clear() { store.clear(); },
  get length() { return store.size; },
  key(index: number) { return [...store.keys()][index] ?? null; },
};

// EVERY seed probed over 860..980 whose main path has an elite BEFORE the boss
// (the interleave class — probe-verified: each commits the elite's full stack
// on the interleave walk, and the boss reward is the THREE-WAY 3-id reward).
const ELITE_BEFORE_BOSS_SEEDS: readonly number[] = Object.freeze([
  860, 863, 867, 876, 877, 884, 885, 900, 903, 904, 907, 911, 915, 916,
  917, 918, 927, 930, 938, 942, 947, 959, 961, 962, 963, 967, 973,
]);

const ENTER_DELTA_BY_TYPE: Readonly<Record<string, number>> = Object.freeze({
  battle: 5, elite: 12, boss: 0, event: 3, merchant: 3, recruitment: 4,
  treasure: 5, workshop: 2, altar: 8, scout: 2, anchor: -10, story: 0,
});

function typeOf(map: ExpeditionMap, nodeId: string): string {
  const node = map.nodes.find((candidate) => candidate.id === nodeId);
  return node?.type ?? 'story';
}

function foldInstability(map: ExpeditionMap, ledger: Readonly<Record<string, TransactionRecord>>): number {
  let instability = 0;
  const defeatCountByNode = new Map<string, number>();
  for (const entry of Object.values(ledger)) {
    if (entry.status !== 'COMMITTED') continue;
    const type = typeOf(map, entry.nodeId);
    let delta = 0;
    if (entry.action === 'ENTER') {
      delta = ENTER_DELTA_BY_TYPE[type] ?? 0;
    } else if (entry.action === 'ENGAGE_DEFEAT') {
      const attempt = (defeatCountByNode.get(entry.nodeId) ?? 0) + 1;
      defeatCountByNode.set(entry.nodeId, attempt);
      delta = 5 * attempt;
    } else if (entry.action === 'SERVICE') {
      delta = type === 'merchant' ? -10 : type === 'anchor' ? -8 : 0;
    }
    instability = Math.max(0, instability + delta);
  }
  return instability;
}

function rewardOf(mgr: RunManager, nodeId: string): RewardSnapshot {
  const snap = mgr.snapshot().state.snapshots[nodeId];
  if (snap?.kind !== 'REWARD') throw new Error('no REWARD snapshot');
  return snap;
}

describe('P21 §9 boss claim × defeat-stack interleave across the elite-before-boss seed sweep', () => {
  it('the whole interleave holds on EVERY probed elite→boss walk: full elite stack across a restore, boss reward byte-identical, loot exactly once, codec fixed point', { timeout: 60_000 }, () => {
    expect(ELITE_BEFORE_BOSS_SEEDS.length).toBeGreaterThanOrEqual(25);
    let eliteRestores = 0;
    let bossRestores = 0;
    for (const seed of ELITE_BEFORE_BOSS_SEEDS) {
      store.clear();
      let mgr = RunManager.create(seed, 500);
      const path = mainPath(mgr.map);
      const runId = mgr.snapshot().state.runId;
      const claimedIds: string[] = [];
      let combatIndex = 0;
      let eliteSeen = false;
      let bossSeen = false;
      let maxInstability = 0;
      const assertFold = (label: string): void => {
        const snap = mgr.snapshot();
        maxInstability = Math.max(maxInstability, snap.state.instability);
        expect(snap.state.instability, `seed ${String(seed)} fold ${label}`).toBe(foldInstability(mgr.map, snap.state.ledger));
        expect(snap.state.instability, `seed ${String(seed)} bound ${label}`).toBeLessThanOrEqual(INSTABILITY_CEILING);
      };

      for (let guard = 0; guard < path.length; guard += 1) {
        const snap = mgr.snapshot();
        const nodeId = snap.currentNodeId;
        const type = snap.currentNodeType;
        const beforeEnter = mgr.snapshot().state.instability;
        mgr.enter(enterTransactionId(runId, nodeId));
        if (type === 'boss') {
          // The §9 purity pin inside the interleave: boss ENTER costs 0.
          expect(mgr.snapshot().state.instability).toBe(beforeEnter);
        }
        assertFold(`enter ${type}@${String(guard)}`);

        if (type === 'battle' && combatIndex === 0) {
          // NODE A — won + claimed FIRST (the baseline that must survive the
          // elite's whole stack and the boss's whole flow on this seed).
          combatIndex += 1;
          mgr.act({ transactionId: actionTransactionId(runId, nodeId, 'ENGAGE', 'a'), nodeId, action: 'ENGAGE', completedKinds: ['kill_regulars'] });
          const optionA = rewardOf(mgr, nodeId).rewardIds[0];
          if (optionA === undefined) throw new Error('no reward id');
          const claim = mgr.act({ transactionId: actionTransactionId(runId, nodeId, 'CLAIM_REWARD', optionA), nodeId, action: 'CLAIM_REWARD', optionId: optionA });
          expect(claim.status, `seed ${String(seed)} claim A`).toBe('COMMITTED');
          claimedIds.push(optionA);
        } else if (type === 'elite') {
          // THE LOST ELITE — the escalating stack with a mid-loop restore
          // after attempt 1 (probe-verified: the FULL stack on this walk).
          eliteSeen = true;
          const instBefore = mgr.snapshot().state.instability;
          const r1 = mgr.act({ transactionId: actionTransactionId(runId, nodeId, 'ENGAGE_DEFEAT', 'e-1'), nodeId, action: 'ENGAGE_DEFEAT' });
          expect(r1.status, `seed ${String(seed)} elite attempt 1`).toBe('COMMITTED');
          expect(mgr.snapshot().state.instability).toBe(instBefore + 5);
          assertFold('elite defeat 1');
          // RESTORE CUT mid-loop: the escalation is ledger-persisted.
          const restored = RunManager.restore();
          expect(restored).not.toBeNull();
          if (restored === null) throw new Error('restore failed');
          mgr = restored;
          expect(mgr.snapshot().state.instability, `seed ${String(seed)} restored elite`).toBe(instBefore + 5);
          expect(foldInstability(mgr.map, mgr.snapshot().state.ledger)).toBe(instBefore + 5);
          eliteRestores += 1;
          // The next re-engage on the RESTORED elite is attempt 2: pays 10,
          // then attempt 3 pays 15 — the FULL stack every time.
          for (const [attempt, tax] of [[2, 10], [3, 15]] as const) {
            const inst = mgr.snapshot().state.instability;
            const rec = mgr.act({ transactionId: actionTransactionId(runId, nodeId, 'ENGAGE_DEFEAT', `e-${String(attempt)}`), nodeId, action: 'ENGAGE_DEFEAT' });
            expect(rec.status, `seed ${String(seed)} elite attempt ${String(attempt)}`).toBe('COMMITTED');
            expect(mgr.snapshot().state.instability).toBe(inst + tax);
            assertFold(`elite defeat ${String(attempt)}`);
          }
          // The claim on the LOST elite is REJECTED BY DESIGN — even with the
          // elite's REAL reward option (a defeat stack can never become a
          // claim): PREREQUISITE_MISSING on every seed of the class.
          const eliteOption = rewardOf(mgr, nodeId).rewardIds[0];
          const claimAttempt = mgr.act({ transactionId: actionTransactionId(runId, nodeId, 'CLAIM_REWARD', 'e-claim'), nodeId, action: 'CLAIM_REWARD', optionId: eliteOption ?? '' });
          expect(claimAttempt.status, `seed ${String(seed)} elite claim`).toBe('REJECTED');
          expect(claimAttempt.reason, `seed ${String(seed)} elite claim reason`).toBe('PREREQUISITE_MISSING');
          mgr.act({ transactionId: actionTransactionId(runId, nodeId, 'DECLINE', 'e-d'), nodeId, action: 'DECLINE' });
          assertFold('elite decline');
        } else if (type === 'boss') {
          // THE WON BOSS — victory ENGAGE materializes the THREE-WAY reward.
          bossSeen = true;
          const reward = rewardOf(mgr, nodeId);
          expect(reward.rewardIds.length, `seed ${String(seed)} boss reward`).toBe(3);
          const engage = mgr.act({ transactionId: actionTransactionId(runId, nodeId, 'ENGAGE', 'boss'), nodeId, action: 'ENGAGE', completedKinds: ['kill_boss'] });
          expect(engage.status, `seed ${String(seed)} boss ENGAGE`).toBe('COMMITTED');
          // RESTORE CUT at the ENGAGE→CLAIM boundary: byte-identical reward.
          const rewardAtEngage = rewardOf(mgr, nodeId);
          const restored = RunManager.restore();
          expect(restored).not.toBeNull();
          if (restored === null) throw new Error('restore failed');
          mgr = restored;
          expect(rewardOf(mgr, nodeId), `seed ${String(seed)} boss reward byte-identical`).toEqual(rewardAtEngage);
          bossRestores += 1;
          // The claim on the RESTORED boss grants exactly once (replay = no-op).
          const optionC = rewardAtEngage.rewardIds[0];
          if (optionC === undefined) throw new Error('no boss reward id');
          const claim = mgr.act({ transactionId: actionTransactionId(runId, nodeId, 'CLAIM_REWARD', optionC), nodeId, action: 'CLAIM_REWARD', optionId: optionC });
          expect(claim.status, `seed ${String(seed)} boss claim`).toBe('COMMITTED');
          claimedIds.push(optionC);
          const pool = [...mgr.snapshot().state.securedLoot, ...mgr.snapshot().state.unsecuredLoot];
          const replay = mgr.act({ transactionId: actionTransactionId(runId, nodeId, 'CLAIM_REWARD', optionC), nodeId, action: 'CLAIM_REWARD', optionId: optionC });
          expect(replay.status).toBe('COMMITTED');
          expect([...mgr.snapshot().state.securedLoot, ...mgr.snapshot().state.unsecuredLoot]).toEqual(pool);
        } else if (type === 'battle') {
          combatIndex += 1;
          mgr.act({ transactionId: actionTransactionId(runId, nodeId, 'DECLINE', `bd-${String(guard)}`), nodeId, action: 'DECLINE' });
        } else {
          mgr.act({ transactionId: actionTransactionId(runId, nodeId, 'DECLINE', `x${String(guard)}`), nodeId, action: 'DECLINE' });
        }
        assertFold(`post-action ${type}@${String(guard)}`);
        mgr.resolve();
        const next = path[guard + 1];
        if (next === undefined) break;
        mgr.advance(next);
      }

      // Every seed really walked the elite → boss interleave.
      expect(eliteSeen, `seed ${String(seed)} elite`).toBe(true);
      expect(bossSeen, `seed ${String(seed)} boss`).toBe(true);
      // The interleave: each claimed id exactly once in the final pools; the
      // boss bounty was paid; the bound was never passed.
      expect(claimedIds.length, `seed ${String(seed)} claimed`).toBe(2);
      expect(new Set(claimedIds).size).toBe(2);
      const finalPool = [...mgr.snapshot().state.securedLoot, ...mgr.snapshot().state.unsecuredLoot];
      for (const id of claimedIds) {
        expect(finalPool.filter((k) => k === id).length, `seed ${String(seed)} ${id}`).toBe(1);
      }
      expect(mgr.snapshot().state.gold, `seed ${String(seed)} gold`).toBeGreaterThanOrEqual(
        500 + bountyForKinds(['kill_regulars']) + bountyForKinds(['kill_boss']),
      );
      expect(maxInstability).toBeLessThanOrEqual(INSTABILITY_CEILING);
      // The final interleaved save is a codec fixed point.
      const snap = mgr.snapshot();
      const runner = restoreExpedition(snap.state, mgr.map, snap.currentNodeId);
      const serialized = encodeExpeditionSave(runner);
      const restoredFinal = restoreExpeditionSave(serialized, mgr.map);
      expect(encodeExpeditionSave(restoredFinal)).toBe(serialized);
    }
    // The class really exercised both interleave boundaries on every seed.
    expect(eliteRestores).toBeGreaterThanOrEqual(ELITE_BEFORE_BOSS_SEEDS.length * 1);
    expect(bossRestores).toBe(ELITE_BEFORE_BOSS_SEEDS.length);
  });
});
