/**
 * Phase 21 §9 ROUND-TRIP TRAJECTORY ACROSS THE WHOLE GATED CLASS. The
 * single-seed round-trip (phase21-ceiling-roundtrip-manager) pins ONE cascade
 * ladder (seed 900); this extends the stack→REJECT→lever→stack→REJECT
 * trajectory with mid-trajectory `RunManager.restore()` cuts + PER-SEED exact
 * ladders over ALL 13 gated seeds (PURE 903/962/963 + CASCADE 900/915/916/
 * 917/918/942/947/959/967/973), probe-verified and pinned here:
 *
 *   1. the exact post-node instability LADDER per seed (the trajectory the
 *      worst-case SERVICE walk must produce — pinned per seed below);
 *   2. the exact ceiling-REJECTION sequence per seed (type + attempt, in walk
 *      order — every one `OPTION_UNAVAILABLE`, the ceiling never the cap);
 *   3. the clean-room fold equals the scalar at EVERY step (REJECTED records
 *      are durable ledger entries the fold skips);
 *   4. a restore cut after EVERY ceiling rejection + after the lever keeps
 *      every rejected record byte-identically, and the escalation continues
 *      from the PERSISTED per-node committed-defeat count (never leaks across
 *      nodes, a rejected attempt never advances the tax);
 *   5. one more rejected attempt on the restored boss pays +0;
 *   6. gold folds 500 − 30×services = 470, instability never exceeds the
 *      shared bound, and the run finishes on every seed.
 */
import { describe, expect, it } from 'vitest';
import { RunManager } from '../../src/game/expedition/run-manager.js';
import { mainPath } from '../../src/game/expedition/expedition-runner.js';
import { enterTransactionId, actionTransactionId } from '../../src/features/expedition/transaction-ids.js';
import { INSTABILITY_CEILING, MAX_REENGAGE_ATTEMPTS } from '../../src/game/expedition/nodes/handlers/combat.js';
import type { TransactionRecord } from '../../src/game/expedition/nodes/types.js';
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

const isCombat = (t: string): boolean => t === 'battle' || t === 'elite' || t === 'boss';

const PURE_SEEDS: readonly number[] = Object.freeze([903, 962, 963]);
const CASCADE_SEEDS: readonly number[] = Object.freeze([900, 915, 916, 917, 918, 942, 947, 959, 967, 973]);
const ALL_GATED: readonly number[] = Object.freeze([...PURE_SEEDS, ...CASCADE_SEEDS]);

// Per-seed pinned expectations (probe-verified over 700..980 with the SERVICE
// walk): the post-node instability ladder + the ceiling-rejection sequence
// {type, attempt} in walk order (every one OPTION_UNAVAILABLE).
const LADDER_BY_SEED: Readonly<Record<number, readonly number[]>> = Object.freeze({
  903: Object.freeze([35, 38, 73, 55, 97, 97]),
  962: Object.freeze([35, 38, 73, 55, 97, 97]),
  963: Object.freeze([35, 37, 72, 54, 96, 96]),
  900: Object.freeze([35, 77, 97, 79, 96, 96]),
  915: Object.freeze([35, 77, 97, 79, 99, 99]),
  916: Object.freeze([35, 70, 90, 72, 99, 99]),
  917: Object.freeze([35, 70, 90, 72, 99, 99]),
  918: Object.freeze([35, 77, 97, 79, 99, 99]),
  942: Object.freeze([35, 77, 97, 79, 99, 99]),
  947: Object.freeze([35, 70, 90, 72, 99, 99]),
  959: Object.freeze([35, 77, 97, 79, 96, 96]),
  967: Object.freeze([35, 77, 97, 79, 99, 99]),
  973: Object.freeze([35, 77, 97, 79, 99, 99]),
});

const REJECTIONS_BY_SEED: Readonly<Record<number, readonly { readonly type: string; readonly attempt: number }[]>> = Object.freeze({
  903: Object.freeze([{ type: 'boss', attempt: 1 }]),
  962: Object.freeze([{ type: 'boss', attempt: 1 }]),
  963: Object.freeze([{ type: 'boss', attempt: 1 }]),
  900: Object.freeze([
    { type: 'battle', attempt: 3 }, { type: 'elite', attempt: 2 }, { type: 'boss', attempt: 1 },
  ]),
  915: Object.freeze([
    { type: 'battle', attempt: 3 }, { type: 'battle', attempt: 3 }, { type: 'boss', attempt: 1 },
  ]),
  916: Object.freeze([
    { type: 'battle', attempt: 3 }, { type: 'elite', attempt: 3 }, { type: 'boss', attempt: 1 },
  ]),
  917: Object.freeze([
    { type: 'battle', attempt: 3 }, { type: 'elite', attempt: 3 }, { type: 'boss', attempt: 1 },
  ]),
  918: Object.freeze([
    { type: 'battle', attempt: 3 }, { type: 'battle', attempt: 3 }, { type: 'boss', attempt: 1 },
  ]),
  942: Object.freeze([
    { type: 'battle', attempt: 3 }, { type: 'battle', attempt: 3 }, { type: 'boss', attempt: 1 },
  ]),
  947: Object.freeze([
    { type: 'battle', attempt: 3 }, { type: 'elite', attempt: 3 }, { type: 'boss', attempt: 1 },
  ]),
  959: Object.freeze([
    { type: 'battle', attempt: 3 }, { type: 'elite', attempt: 2 }, { type: 'boss', attempt: 1 },
  ]),
  967: Object.freeze([
    { type: 'battle', attempt: 3 }, { type: 'battle', attempt: 3 }, { type: 'boss', attempt: 1 },
  ]),
  973: Object.freeze([
    { type: 'battle', attempt: 3 }, { type: 'battle', attempt: 3 }, { type: 'boss', attempt: 1 },
  ]),
});

describe('P21 §9 round-trip trajectory across the WHOLE gated class', () => {
  it('every gated seed walks the exact pinned ladder + rejection sequence, fold-exact at every step, restore cuts after EVERY rejection and after the lever, durable rejections, run finishes', { timeout: 60_000 }, () => {
    expect(ALL_GATED.length).toBe(13);
    for (const seed of ALL_GATED) {
      store.clear();
      let mgr = RunManager.create(seed, 500);
      const path = mainPath(mgr.map);
      const runId = mgr.snapshot().state.runId;
      const expectedLadder = LADDER_BY_SEED[seed];
      const expectedRejections = REJECTIONS_BY_SEED[seed];
      if (expectedLadder === undefined || expectedRejections === undefined) throw new Error(`no expectations for seed ${String(seed)}`);
      const observedRejections: { type: string; attempt: number }[] = [];
      const rejectedTxs: string[] = [];
      let cuts = 0;
      let gold = 500;
      let services = 0;
      let bossId = '';

      const assertFold = (label: string): void => {
        const snap = mgr.snapshot();
        expect(snap.state.instability, `seed ${String(seed)} fold ${label}`)
          .toBe(foldInstability(mgr.map, snap.state.ledger));
        expect(snap.state.gold, `seed ${String(seed)} gold ${label}`).toBe(gold);
      };

      for (let guard = 0; guard < path.length; guard += 1) {
        const snap = mgr.snapshot();
        const nodeId = snap.currentNodeId;
        const type = snap.currentNodeType;
        mgr.enter(enterTransactionId(runId, nodeId));
        assertFold(`enter ${type}@${String(guard)}`);

        if (isCombat(type)) {
          for (let attempt = 1; attempt <= MAX_REENGAGE_ATTEMPTS; attempt += 1) {
            const txId = actionTransactionId(runId, nodeId, 'ENGAGE_DEFEAT', `r-${String(guard)}-${String(attempt)}`);
            const record = mgr.act({ transactionId: txId, nodeId, action: 'ENGAGE_DEFEAT' });
            if (record.status !== 'COMMITTED') {
              // The ceiling rejection: durable record, exact reason.
              expect(record.reason, `seed ${String(seed)} reason ${type}@${String(attempt)}`).toBe('OPTION_UNAVAILABLE');
              observedRejections.push({ type, attempt });
              rejectedTxs.push(txId);
              expect(mgr.snapshot().state.ledger[txId]?.status).toBe('REJECTED');
              expect(mgr.snapshot().state.ledger[txId]?.reason).toBe('OPTION_UNAVAILABLE');
              assertFold(`rejected ${type}@${String(attempt)}`);
              // RESTORE CUT after every ceiling rejection: the rejection is
              // durable and the walk continues from the persisted ledger.
              const restored = RunManager.restore();
              expect(restored).not.toBeNull();
              if (restored === null) throw new Error('restore failed');
              mgr = restored;
              expect(mgr.snapshot().state.ledger[txId]?.status).toBe('REJECTED');
              expect(mgr.snapshot().state.ledger[txId]?.reason).toBe('OPTION_UNAVAILABLE');
              assertFold(`restored after ${type}@${String(attempt)}`);
              cuts += 1;
              if (type === 'boss') {
                bossId = nodeId;
                // One more rejected attempt on the RESTORED boss (fresh tx):
                // +0 — the refusal never advances the tax and the committed
                // defeat count stays 0.
                const instAtBoss = mgr.snapshot().state.instability;
                const again = mgr.act({ transactionId: actionTransactionId(runId, nodeId, 'ENGAGE_DEFEAT', 'r-again'), nodeId, action: 'ENGAGE_DEFEAT' });
                expect(again.status).toBe('REJECTED');
                expect(again.reason).toBe('OPTION_UNAVAILABLE');
                expect(mgr.snapshot().state.instability).toBe(instAtBoss);
                expect(foldInstability(mgr.map, mgr.snapshot().state.ledger)).toBe(instAtBoss);
                expect(countCommittedDefeats(mgr, nodeId)).toBe(0);
              }
              break;
            }
            assertFold(`defeat ${String(attempt)} ${type}@${String(guard)}`);
          }
          mgr.act({ transactionId: actionTransactionId(runId, nodeId, 'DECLINE', `rd-${String(guard)}`), nodeId, action: 'DECLINE' });
          assertFold(`decline ${type}@${String(guard)}`);
        } else if (type === 'anchor' || type === 'merchant') {
          const txId = actionTransactionId(runId, nodeId, 'SERVICE', `rs-${String(guard)}`);
          const record = mgr.act({ transactionId: txId, nodeId, action: 'SERVICE' });
          expect(record.status, `seed ${String(seed)} service ${type}@${String(guard)}`).toBe('COMMITTED');
          gold -= 30;
          services += 1;
          assertFold(`service ${type}@${String(guard)}`);
          // RESTORE CUT right after the lever: the reduction is durable.
          const restored = RunManager.restore();
          expect(restored).not.toBeNull();
          if (restored === null) throw new Error('restore failed');
          mgr = restored;
          assertFold(`restored after lever ${type}@${String(guard)}`);
          cuts += 1;
        } else {
          mgr.act({ transactionId: actionTransactionId(runId, nodeId, 'DECLINE', `ry-${String(guard)}`), nodeId, action: 'DECLINE' });
          assertFold(`decline ${type}@${String(guard)}`);
        }
        mgr.resolve();
        assertFold(`resolve ${type}@${String(guard)}`);
        // The PINNED ladder holds at the resolve boundary.
        expect(mgr.snapshot().state.instability, `seed ${String(seed)} ladder ${type}@${String(guard)}`)
          .toBe(expectedLadder[guard]);
        const next = path[guard + 1];
        if (next === undefined) break;
        mgr.advance(next);
      }

      // The exact rejection sequence was observed (ceiling, never the cap).
      expect(observedRejections, `seed ${String(seed)} rejections`).toEqual([...expectedRejections]);
      // The escalation NEVER leaked across nodes: the boss has zero committed
      // defeats (checked again at the end), and the whole walk committed
      // exactly the observed attempts' worth of defeats per node (the fold
      // oracle derives the same counts, checked at every step).
      expect(countCommittedDefeats(mgr, bossId)).toBe(0);
      // Every rejection tx from the walk is STILL durable in the final ledger.
      for (const txId of rejectedTxs) {
        expect(mgr.snapshot().state.ledger[txId]?.status, `seed ${String(seed)} ${txId}`).toBe('REJECTED');
        expect(mgr.snapshot().state.ledger[txId]?.reason, `seed ${String(seed)} ${txId}`).toBe('OPTION_UNAVAILABLE');
      }
      // Clean close: retreat, resolve, finish. Gold fold exact, bound respected.
      expect(services).toBe(1);
      expect(gold).toBe(470);
      mgr.act({ transactionId: actionTransactionId(runId, bossId, 'DECLINE', 'rd-last'), nodeId: bossId, action: 'DECLINE' });
      mgr.resolve();
      mgr.finish();
      expect(mgr.snapshot().runStatus, `seed ${String(seed)} finished`).toBe('finished');
      expect(mgr.snapshot().state.gold).toBe(470);
      expect(mgr.snapshot().state.instability).toBeLessThanOrEqual(INSTABILITY_CEILING);
      expect(cuts, `seed ${String(seed)} cuts`).toBe(expectedRejections.length + 1);
    }
  });
});

function countCommittedDefeats(mgr: RunManager, nodeId: string): number {
  return Object.values(mgr.snapshot().state.ledger).filter(
    (e) => e.nodeId === nodeId && e.status === 'COMMITTED' && e.action === 'ENGAGE_DEFEAT',
  ).length;
}
