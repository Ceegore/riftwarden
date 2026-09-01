/**
 * Phase 21 §9 BOSS-CEILING PURITY ACROSS MULTIPLE SEEDS. The single-seed pin
 * (phase21-boss-ceiling-purity, seed 903) proves one exact ladder; this sweeps
 * the SEED CLASS. Every seed probed (700..980) whose worst-case bleed walk
 * (full re-engage stacks, anchor/merchant SERVICE) gates the boss's FIRST
 * re-engage at the instability ceiling splits into two probe-verified classes:
 *
 *   PURE     (903, 962, 963) — the boss is the ONLY ceiling-gated node: every
 *            prior combat node commits its FULL 3-attempt stack with ZERO
 *            gating. The single-seed purity invariant must hold for the whole
 *            class, not one hand-picked path.
 *   CASCADE  (900, 915, 916, 917, 918, 942, 947, 959, 967, 973) — the ceiling
 *            binds EARLIER too (prior combat nodes also gate at the ceiling),
 *            and the boss's first re-engage is STILL gated at the end.
 *
 * SHARED invariant for BOTH classes (the boss-ceiling purity that must hold
 * for every walk where the boss's first re-engage is ceiling-gated):
 *
 *   1. the boss ENTER contributed EXACTLY 0;
 *   2. the boss committed ZERO defeats — its first re-engage is REJECTED
 *      `OPTION_UNAVAILABLE` (the ceiling, never the cap: zero defeats);
 *   3. EVERY ceiling gate in the walk is `OPTION_UNAVAILABLE` — the ceiling is
 *      the only reason a re-engage is ever refused (a cap/limit drift would
 *      surface here as a different reason);
 *   4. the fold is path-order-exact: folding ONLY the prior-node ledger equals
 *      the instability at the boss, and the full fold too (the boss
 *      contributes 0) — the ceiling state is the prior path's doing;
 *   5. instability never exceeds the shared bound at ANY step;
 *   6. the run is never soft-locked: the boss DECLINEs and the run finishes.
 */
import { describe, expect, it } from 'vitest';
import { RunManager } from '../../src/game/expedition/run-manager.js';
import { mainPath } from '../../src/game/expedition/expedition-runner.js';
import { enterTransactionId, actionTransactionId } from '../../src/features/expedition/transaction-ids.js';
import { MAX_REENGAGE_ATTEMPTS, INSTABILITY_CEILING } from '../../src/game/expedition/nodes/handlers/combat.js';
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

/** Clean-room oracle — independent of the handler modules (the full node-kind
 * delta map the ledger-fold differentials fold with). */
const ENTER_DELTA_BY_TYPE: Readonly<Record<string, number>> = Object.freeze({
  battle: 5, elite: 12, boss: 0, event: 3, merchant: 3, recruitment: 4,
  treasure: 5, workshop: 2, altar: 8, scout: 2, anchor: -10, story: 0,
});

function typeOf(map: ExpeditionMap, nodeId: string): string {
  const node = map.nodes.find((candidate) => candidate.id === nodeId);
  return node?.type ?? 'story';
}

function foldInstability(map: ExpeditionMap, ledger: Readonly<Record<string, TransactionRecord>>, excludeNode?: string): number {
  let instability = 0;
  const defeatCountByNode = new Map<string, number>();
  for (const entry of Object.values(ledger)) {
    if (entry.status !== 'COMMITTED') continue;
    if (excludeNode !== undefined && entry.nodeId === excludeNode) continue;
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

interface SeedMetrics {
  readonly seed: number;
  /** instability across the boss ENTER (pre vs post). */
  readonly bossEnterDelta: number;
  /** committed attempts per combat node (in walk order), the boss last. */
  readonly attemptsPerCombatNode: readonly number[];
  /** true when every NON-boss combat node committed the FULL stack. */
  readonly priorStacksFull: boolean;
  /** the boss's first re-engage was REJECTED with OPTION_UNAVAILABLE. */
  readonly bossGatedFirst: boolean;
  /** committed defeats on the boss. */
  readonly bossDefeats: number;
  /** instability right after the boss ENTER. */
  readonly instabilityAtBoss: number;
  /** fold of the FULL ledger at the boss. */
  readonly foldAtBoss: number;
  /** fold of the ledger EXCLUDING the boss. */
  readonly foldWithoutBoss: number;
  /** max instability observed at any step. */
  readonly maxInstability: number;
  /** every ceiling gate reason observed (must all be OPTION_UNAVAILABLE). */
  readonly gateReasons: readonly string[];
  /** true when the run finished cleanly. */
  readonly finished: boolean;
}

function walkBleed(seed: number): SeedMetrics {
  store.clear();
  const mgr = RunManager.create(seed, 500);
  const path = mainPath(mgr.map);
  const runId = mgr.snapshot().state.runId;
  const attemptsPerCombatNode: number[] = [];
  const gateReasons: string[] = [];
  let maxInstability = 0;
  let bossNodeId: string | undefined;
  let bossEnterDelta = 0;
  let bossGatedFirst = false;
  let bossDefeats = 0;
  let instabilityAtBoss = 0;
  let finished: boolean;

  for (let guard = 0; guard < path.length; guard += 1) {
    const snap = mgr.snapshot();
    const nodeId = snap.currentNodeId;
    const type = snap.currentNodeType;
    const beforeEnter = mgr.snapshot().state.instability;
    mgr.enter(enterTransactionId(runId, nodeId));
    if (type === 'boss') {
      bossNodeId = nodeId;
      bossEnterDelta = mgr.snapshot().state.instability - beforeEnter;
      instabilityAtBoss = mgr.snapshot().state.instability;
    }
    maxInstability = Math.max(maxInstability, mgr.snapshot().state.instability);
    if (isCombat(type)) {
      let attempts = 0;
      for (let attempt = 1; attempt <= MAX_REENGAGE_ATTEMPTS; attempt += 1) {
        const record = mgr.act({ transactionId: actionTransactionId(runId, nodeId, 'ENGAGE_DEFEAT', `p-${String(guard)}-${String(attempt)}`), nodeId, action: 'ENGAGE_DEFEAT' });
        if (record.status !== 'COMMITTED') {
          gateReasons.push(record.reason ?? 'UNKNOWN');
          if (type === 'boss' && attempt === 1) bossGatedFirst = record.reason === 'OPTION_UNAVAILABLE';
          break;
        }
        attempts += 1;
        if (type === 'boss') bossDefeats = attempts;
      }
      attemptsPerCombatNode.push(attempts);
      maxInstability = Math.max(maxInstability, mgr.snapshot().state.instability);
      mgr.act({ transactionId: actionTransactionId(runId, nodeId, 'DECLINE', `pd-${String(guard)}`), nodeId, action: 'DECLINE' });
    } else if (type === 'anchor' || type === 'merchant') {
      const record = mgr.act({ transactionId: actionTransactionId(runId, nodeId, 'SERVICE', `ps-${String(guard)}`), nodeId, action: 'SERVICE' });
      if (record.status !== 'COMMITTED') {
        mgr.act({ transactionId: actionTransactionId(runId, nodeId, 'DECLINE', `px-${String(guard)}`), nodeId, action: 'DECLINE' });
      }
    } else {
      mgr.act({ transactionId: actionTransactionId(runId, nodeId, 'DECLINE', `py-${String(guard)}`), nodeId, action: 'DECLINE' });
    }
    maxInstability = Math.max(maxInstability, mgr.snapshot().state.instability);
    mgr.resolve();
    const next = path[guard + 1];
    if (next === undefined) break;
    mgr.advance(next);
  }

  const ledger = mgr.snapshot().state.ledger;
  const priorStacksFull = attemptsPerCombatNode
    .slice(0, attemptsPerCombatNode.length - 1)
    .every((n) => n === MAX_REENGAGE_ATTEMPTS);
  if (bossNodeId === undefined) throw new Error(`seed ${String(seed)} reached no boss`);
  const foldAtBoss = foldInstability(mgr.map, ledger);
  const foldWithoutBoss = foldInstability(mgr.map, ledger, bossNodeId);
  try {
    mgr.finish();
    finished = mgr.snapshot().runStatus === 'finished';
  } catch {
    finished = false;
  }
  return {
    seed,
    bossEnterDelta,
    attemptsPerCombatNode,
    priorStacksFull,
    bossGatedFirst,
    bossDefeats,
    instabilityAtBoss,
    foldAtBoss,
    foldWithoutBoss,
    maxInstability,
    gateReasons,
    finished,
  };
}

// Probed over 700..980 with the SERVICE walk: every seed whose worst-case bleed
// gates the boss's FIRST re-engage at the ceiling. PURE = the boss is the only
// gated node; CASCADE = a prior combat node also gates (both probe-verified).
const PURE_SEEDS: readonly number[] = Object.freeze([903, 962, 963]);
const CASCADE_SEEDS: readonly number[] = Object.freeze([900, 915, 916, 917, 918, 942, 947, 959, 967, 973]);
const ALL_GATED: readonly number[] = Object.freeze([...PURE_SEEDS, ...CASCADE_SEEDS]);

describe('P21 §9 boss-ceiling purity across multiple seeds', () => {
  it('PURE seeds: every prior combat node commits its FULL stack, the boss is the ONLY ceiling-gated node, and the fold is path-order-exact', { timeout: 60_000 }, () => {
    expect(PURE_SEEDS.length).toBeGreaterThanOrEqual(3);
    for (const seed of PURE_SEEDS) {
      const m = walkBleed(seed);
      // The boss ENTER contributed exactly 0.
      expect(m.bossEnterDelta, `seed ${String(seed)} boss ENTER delta`).toBe(0);
      // Every prior combat node committed its FULL stack with zero gating.
      expect(m.priorStacksFull, `seed ${String(seed)} prior stacks full`).toBe(true);
      expect(m.attemptsPerCombatNode[m.attemptsPerCombatNode.length - 1]).toBe(0);
      // The boss committed zero defeats and its FIRST re-engage is
      // ceiling-gated (OPTION_UNAVAILABLE, never the cap).
      expect(m.bossGatedFirst, `seed ${String(seed)} boss gated first`).toBe(true);
      expect(m.bossDefeats).toBe(0);
      // The fold is path-order-exact: the boss contributes 0, so folding only
      // the prior ledger equals the instability at the boss (and the full fold).
      expect(m.instabilityAtBoss, `seed ${String(seed)} instability at boss`).toBe(m.foldWithoutBoss);
      expect(m.foldAtBoss).toBe(m.foldWithoutBoss);
      expect(m.instabilityAtBoss + 5).toBeGreaterThan(INSTABILITY_CEILING);
      // Instability never passed the bound at any step; the run finishes.
      expect(m.maxInstability).toBeLessThanOrEqual(INSTABILITY_CEILING);
      expect(m.finished).toBe(true);
    }
  });

  it('SHARED invariant for the whole gated class (pure + cascade): boss ENTER 0, boss 0 defeats, every gate is OPTION_UNAVAILABLE, fold exact, never past the bound', { timeout: 60_000 }, () => {
    expect(ALL_GATED.length).toBeGreaterThanOrEqual(13);
    for (const seed of ALL_GATED) {
      const m = walkBleed(seed);
      // The boss ENTER contributed exactly 0 on EVERY gated walk.
      expect(m.bossEnterDelta, `seed ${String(seed)} boss ENTER delta`).toBe(0);
      // The boss committed zero defeats and its first re-engage is gated.
      expect(m.bossGatedFirst, `seed ${String(seed)} boss gated first`).toBe(true);
      expect(m.bossDefeats).toBe(0);
      // Every ceiling gate in the walk is OPTION_UNAVAILABLE — the ceiling is
      // the ONLY reason a re-engage is ever refused (a cap/limit drift would
      // surface as a different reason, e.g. ACTION_LIMIT).
      expect(m.gateReasons.length).toBeGreaterThanOrEqual(1);
      for (const reason of m.gateReasons) {
        expect(reason, `seed ${String(seed)} gate reason`).toBe('OPTION_UNAVAILABLE');
      }
      // Fold exact: the scalar at the boss equals the prior-ledger fold (the
      // boss contributes 0), which equals the full fold.
      expect(m.instabilityAtBoss, `seed ${String(seed)} instability at boss`).toBe(m.foldWithoutBoss);
      expect(m.foldAtBoss).toBe(m.foldWithoutBoss);
      expect(m.instabilityAtBoss + 5).toBeGreaterThan(INSTABILITY_CEILING);
      expect(m.instabilityAtBoss).toBeLessThanOrEqual(INSTABILITY_CEILING);
      // Never past the bound at any step; never a soft-lock.
      expect(m.maxInstability, `seed ${String(seed)} max instability`).toBeLessThanOrEqual(INSTABILITY_CEILING);
      expect(m.finished, `seed ${String(seed)} finished`).toBe(true);
    }
  });

  it('the fold oracle reproduces the persisted scalar at EVERY step for every gated seed', { timeout: 60_000 }, () => {
    for (const seed of ALL_GATED) {
      store.clear();
      const mgr = RunManager.create(seed, 500);
      const path = mainPath(mgr.map);
      const runId = mgr.snapshot().state.runId;
      for (let guard = 0; guard < path.length; guard += 1) {
        const snap = mgr.snapshot();
        const nodeId = snap.currentNodeId;
        const type = snap.currentNodeType;
        mgr.enter(enterTransactionId(runId, nodeId));
        expect(mgr.snapshot().state.instability, `seed ${String(seed)} enter ${type}`)
          .toBe(foldInstability(mgr.map, mgr.snapshot().state.ledger));
        if (isCombat(type)) {
          for (let attempt = 1; attempt <= MAX_REENGAGE_ATTEMPTS; attempt += 1) {
            const record = mgr.act({ transactionId: actionTransactionId(runId, nodeId, 'ENGAGE_DEFEAT', `q-${String(guard)}-${String(attempt)}`), nodeId, action: 'ENGAGE_DEFEAT' });
            if (record.status !== 'COMMITTED') break;
            expect(mgr.snapshot().state.instability, `seed ${String(seed)} defeat ${type}`)
              .toBe(foldInstability(mgr.map, mgr.snapshot().state.ledger));
          }
          mgr.act({ transactionId: actionTransactionId(runId, nodeId, 'DECLINE', `qd-${String(guard)}`), nodeId, action: 'DECLINE' });
        } else if (type === 'anchor' || type === 'merchant') {
          const record = mgr.act({ transactionId: actionTransactionId(runId, nodeId, 'SERVICE', `qs-${String(guard)}`), nodeId, action: 'SERVICE' });
          if (record.status !== 'COMMITTED') {
            mgr.act({ transactionId: actionTransactionId(runId, nodeId, 'DECLINE', `qx-${String(guard)}`), nodeId, action: 'DECLINE' });
          }
          expect(mgr.snapshot().state.instability, `seed ${String(seed)} service ${type}`)
            .toBe(foldInstability(mgr.map, mgr.snapshot().state.ledger));
        } else {
          mgr.act({ transactionId: actionTransactionId(runId, nodeId, 'DECLINE', `qy-${String(guard)}`), nodeId, action: 'DECLINE' });
        }
        mgr.resolve();
        const next = path[guard + 1];
        if (next === undefined) break;
        mgr.advance(next);
      }
    }
  });
});
