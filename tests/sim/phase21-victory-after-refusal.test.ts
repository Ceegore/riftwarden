/**
 * Phase 21 §9 VICTORY AFTER A REFUSED RE-ENGAGE. Every purity walk so far
 * DECLINES + finishes after the boss's ceiling-refused re-engage; this pins
 * that the refusal only blocks the REWATCH — the victory ENGAGE on the same
 * node stays legal and pays the disclosed bounty EXACTLY:
 *
 *   1. on the ceiling-gated boss the FIRST re-engage is REJECTED
 *      (`OPTION_UNAVAILABLE`, a durable record) and the boss has ZERO
 *      committed defeats — a REFUSED rewatch is never a verdict;
 *   2. the victory ENGAGE on the SAME node (fresh tx, right after the refusal)
 *      is therefore legal — the win path is never poisoned by the ceiling;
 *      it pays exactly the disclosed bounty (`bountyPreviewForEncounterObjective
 *      ('defeat_boss') === bountyForKinds(['kill_boss']) === 15`, and the gold
 *      delta is exactly that);
 *   3. a mid-boundary `RunManager.restore()` cut (between the refusal and the
 *      victory) keeps the refusal durable AND the victory still legal on the
 *      restored manager — the claimed loot grants exactly once;
 *   4. the CONTRAST (pinned at the handler level): a COMMITTED defeat DOES
 *      block the victory (ENGAGE → `ACTION_LIMIT` — a defeat can never be
 *      turned into a win), while a REJECTED refusal never does;
 *   5. the fold stays exact at every step (REJECTED records skipped), the
 *      ladder is the pinned purity ladder, instability ≤ 100, and the run
 *      finishes — the WON boss closes the walk cleanly.
 *
 * Driven on the PURE class (903, 962, 963 — boss the only gated node) AND one
 * cascade seed (900 — earlier nodes gated too, the boss still gated at the end).
 */
import { describe, expect, it } from 'vitest';
import { RunManager } from '../../src/game/expedition/run-manager.js';
import { mainPath } from '../../src/game/expedition/expedition-runner.js';
import { enterTransactionId, actionTransactionId } from '../../src/features/expedition/transaction-ids.js';
import {
  INSTABILITY_CEILING,
  MAX_REENGAGE_ATTEMPTS,
  bountyForKinds,
  bountyPreviewForEncounterObjective,
  battleHandler,
} from '../../src/game/expedition/nodes/handlers/combat.js';
import { dispatchCommit } from '../../src/game/expedition/nodes/node-run-reducer.js';
import { createNodeRunState, openVisit } from '../../src/game/expedition/nodes/run-state.js';
import type { NodeDefinition, TransactionRecord } from '../../src/game/expedition/nodes/types.js';
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

function countCommittedDefeats(ledger: Readonly<Record<string, TransactionRecord>>, nodeId: string): number {
  return Object.values(ledger).filter((e) => e.nodeId === nodeId && e.status === 'COMMITTED' && e.action === 'ENGAGE_DEFEAT').length;
}

const isCombat = (t: string): boolean => t === 'battle' || t === 'elite' || t === 'boss';

// PURE: boss the ONLY gated node. CASCADE 900: earlier nodes gated too.
const VICTORY_SEEDS: readonly number[] = Object.freeze([903, 962, 963, 900]);
// The pinned post-node instability ladders (the SERVICE walk, probe-verified).
const LADDER_BY_SEED: Readonly<Record<number, readonly number[]>> = Object.freeze({
  903: Object.freeze([35, 38, 73, 55, 97, 97]),
  962: Object.freeze([35, 38, 73, 55, 97, 97]),
  963: Object.freeze([35, 37, 72, 54, 96, 96]),
  900: Object.freeze([35, 77, 97, 79, 96, 96]),
});

describe('P21 §9 victory after a refused re-engage on the gated boss', () => {
  it('PURE class (903/962/963) + cascade 900: the ceiling-refused rewatch never blocks the victory ENGAGE — the boss WON pays exactly the disclosed bounty, claim exactly once, fold exact, run finishes', { timeout: 60_000 }, () => {
    for (const seed of VICTORY_SEEDS) {
      store.clear();
      let mgr = RunManager.create(seed, 500);
      const path = mainPath(mgr.map);
      const runId = mgr.snapshot().state.runId;
      const expectedLadder = LADDER_BY_SEED[seed];
      if (expectedLadder === undefined) throw new Error(`no ladder for seed ${String(seed)}`);
      let bossId = '';
      let refusalTx = '';
      let victoryWorked = false;
      let claimWorked = false;
      let gold = 500;

      for (let guard = 0; guard < path.length; guard += 1) {
        const snap = mgr.snapshot();
        const nodeId = snap.currentNodeId;
        const type = snap.currentNodeType;
        mgr.enter(enterTransactionId(runId, nodeId));
        if (isCombat(type)) {
          let refused = false;
          for (let attempt = 1; attempt <= MAX_REENGAGE_ATTEMPTS; attempt += 1) {
            const txId = actionTransactionId(runId, nodeId, 'ENGAGE_DEFEAT', `v-${String(guard)}-${String(attempt)}`);
            const record = mgr.act({ transactionId: txId, nodeId, action: 'ENGAGE_DEFEAT' });
            if (record.status !== 'COMMITTED') {
              expect(record.reason, `seed ${String(seed)} ${type}@${String(attempt)}`).toBe('OPTION_UNAVAILABLE');
              expect(mgr.snapshot().state.ledger[txId]?.status).toBe('REJECTED');
              expect(mgr.snapshot().state.ledger[txId]?.reason).toBe('OPTION_UNAVAILABLE');
              refused = true;
              if (type === 'boss') {
                bossId = nodeId;
                refusalTx = txId;
              }
              break;
            }
          }
          if (type === 'boss') {
            // The boss has ZERO committed defeats — a REFUSED rewatch is never
            // a verdict (the refusal only blocks the REWATCH).
            expect(countCommittedDefeats(mgr.snapshot().state.ledger, nodeId)).toBe(0);
            // MID-BOUNDARY RESTORE CUT between the refusal and the victory: the
            // refusal is durable, and the victory must still be legal on the
            // restored manager.
            const restored = RunManager.restore();
            expect(restored).not.toBeNull();
            if (restored === null) throw new Error('restore failed');
            mgr = restored;
            expect(mgr.snapshot().state.ledger[refusalTx]?.status).toBe('REJECTED');
            expect(mgr.snapshot().state.ledger[refusalTx]?.reason).toBe('OPTION_UNAVAILABLE');
            // THE VICTORY after the refusal: disclosed bounty === granted bounty.
            const disclosed = bountyPreviewForEncounterObjective('defeat_boss');
            const contracted = bountyForKinds(['kill_boss']);
            expect(disclosed).toBe(15);
            expect(contracted).toBe(disclosed);
            const goldBefore = mgr.snapshot().state.gold;
            const engage = mgr.act({ transactionId: actionTransactionId(runId, nodeId, 'ENGAGE', 'vic'), nodeId, action: 'ENGAGE', completedKinds: ['kill_boss'] });
            expect(engage.status).toBe('COMMITTED');
            expect(mgr.snapshot().state.gold).toBe(goldBefore + contracted);
            expect(mgr.snapshot().state.gold).toBeGreaterThanOrEqual(485);
            victoryWorked = true;
            // The claim on the WON boss grants exactly once.
            const reward = mgr.snapshot().state.snapshots[nodeId];
            if (reward === undefined || reward.kind !== 'REWARD') throw new Error('no boss reward snapshot');
            const option = reward.rewardIds[0];
            if (option === undefined) throw new Error('no boss reward id');
            const claim = mgr.act({ transactionId: actionTransactionId(runId, nodeId, 'CLAIM_REWARD', option), nodeId, action: 'CLAIM_REWARD', optionId: option });
            expect(claim.status).toBe('COMMITTED');
            const poolAfter = [...mgr.snapshot().state.securedLoot, ...mgr.snapshot().state.unsecuredLoot];
            const replay = mgr.act({ transactionId: actionTransactionId(runId, nodeId, 'CLAIM_REWARD', option), nodeId, action: 'CLAIM_REWARD', optionId: option });
            expect(replay.status).toBe('COMMITTED'); // exactly-once replay
            const poolAfterReplay = [...mgr.snapshot().state.securedLoot, ...mgr.snapshot().state.unsecuredLoot];
            expect(poolAfterReplay).toEqual(poolAfter);
            expect(poolAfter.filter((k) => k === option).length).toBe(1);
            claimWorked = true;
          } else if (!refused) {
            mgr.act({ transactionId: actionTransactionId(runId, nodeId, 'DECLINE', `vd-${String(guard)}`), nodeId, action: 'DECLINE' });
          } else {
            mgr.act({ transactionId: actionTransactionId(runId, nodeId, 'DECLINE', `vd-${String(guard)}`), nodeId, action: 'DECLINE' });
          }
        } else if (type === 'anchor' || type === 'merchant') {
          const record = mgr.act({ transactionId: actionTransactionId(runId, nodeId, 'SERVICE', `vs-${String(guard)}`), nodeId, action: 'SERVICE' });
          if (record.status === 'COMMITTED') gold -= 30;
          else mgr.act({ transactionId: actionTransactionId(runId, nodeId, 'DECLINE', `vx-${String(guard)}`), nodeId, action: 'DECLINE' });
        } else {
          mgr.act({ transactionId: actionTransactionId(runId, nodeId, 'DECLINE', `vy-${String(guard)}`), nodeId, action: 'DECLINE' });
        }
        // Fold exact at every step.
        const mid = mgr.snapshot();
        expect(mid.state.instability, `seed ${String(seed)} fold at ${type}@${String(guard)}`)
          .toBe(foldInstability(mgr.map, mid.state.ledger));
        mgr.resolve();
        // The pinned ladder holds at the resolve boundary.
        expect(mgr.snapshot().state.instability, `seed ${String(seed)} ladder at ${type}@${String(guard)}`)
          .toBe(expectedLadder[guard]);
        const next = path[guard + 1];
        if (next === undefined) break;
        mgr.advance(next);
      }

      // The WON boss: victory + claim worked, refusal durable, zero defeats,
      // gold fold exact (500 − 30×services + 15 bounty), run finished.
      expect(bossId.length).toBeGreaterThan(0);
      expect(victoryWorked).toBe(true);
      expect(claimWorked).toBe(true);
      expect(mgr.snapshot().state.ledger[refusalTx]?.status).toBe('REJECTED');
      expect(mgr.snapshot().state.ledger[refusalTx]?.reason).toBe('OPTION_UNAVAILABLE');
      expect(countCommittedDefeats(mgr.snapshot().state.ledger, bossId)).toBe(0);
      expect(mgr.snapshot().state.gold).toBe(gold + 15);
      expect(mgr.snapshot().state.gold).toBe(485);
      expect(mgr.snapshot().state.instability).toBeLessThanOrEqual(INSTABILITY_CEILING);
      expect(mgr.snapshot().state.instability).toBe(foldInstability(mgr.map, mgr.snapshot().state.ledger));
      mgr.finish();
      expect(mgr.snapshot().runStatus).toBe('finished');
    }
  });

  it('the CONTRAST: a COMMITTED defeat blocks the victory ENGAGE (ACTION_LIMIT — a defeat can never become a win), a REJECTED refusal never does', () => {
    // Real battle handler through the real transaction service on a crafted
    // node state — the victory gate is `hasCommittedAction(ENGAGE_DEFEAT)`.
    const BATTLE = Object.freeze({ nodeId: 'n_battle', type: 'battle', contentRevision: '32.0', payloadKey: 'e' }) as NodeDefinition;
    const ENGAGE = Object.freeze({ transactionId: 'tx-e', nodeId: BATTLE.nodeId, action: 'ENGAGE' });
    let state = createNodeRunState({ runId: 'r', modeId: 'm', contentRevision: '32.0', seed: 1, mapHash: 'h', gold: 500 });
    state = openVisit(state, BATTLE.nodeId, 0);
    // REFUSED variant: only a REJECTED rewatch record in the ledger — the
    // victory ENGAGE is legal.
    const withRefusal = {
      ...state,
      ledger: {
        ...state.ledger,
        'tx-rej': {
          transactionId: 'tx-rej', nodeId: BATTLE.nodeId, action: 'ENGAGE_DEFEAT',
          status: 'REJECTED', reason: 'OPTION_UNAVAILABLE', outcomeIds: [],
        } as TransactionRecord,
      },
    };
    const refusalOutcome = dispatchCommit(withRefusal, ENGAGE, BATTLE, battleHandler);
    expect(refusalOutcome.result.status).toBe('COMMITTED');
    // COMMITTED variant: a real defeat verdict in the ledger — the victory
    // ENGAGE is REJECTED ACTION_LIMIT (the deterministic sim already ruled it).
    const withDefeat = {
      ...state,
      ledger: {
        ...state.ledger,
        'tx-def': {
          transactionId: 'tx-def', nodeId: BATTLE.nodeId, action: 'ENGAGE_DEFEAT',
          status: 'COMMITTED', outcomeIds: [],
        } as TransactionRecord,
      },
      visits: {
        ...state.visits,
        [BATTLE.nodeId]: {
          nodeId: BATTLE.nodeId, status: 'COMMITTED' as const,
          previewRevision: 0, transactionId: 'tx-def',
        },
      },
    };
    const defeatOutcome = dispatchCommit(withDefeat, ENGAGE, BATTLE, battleHandler);
    expect(defeatOutcome.result.status).toBe('REJECTED');
    expect(defeatOutcome.result.reason).toBe('ACTION_LIMIT');
    // The REJECTED defeat-record never moved a scalar: gold + instability intact.
    expect(defeatOutcome.state.gold).toBe(withDefeat.gold);
    expect(defeatOutcome.state.instability).toBe(withDefeat.instability);
  });
});
