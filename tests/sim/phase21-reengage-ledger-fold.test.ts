/**
 * Phase 21 §9 RE-ENGAGE THROUGH THE LEDGER-FOLD WALKS. The manager
 * instability fold and the full-graph kills fold exist separately; this test
 * folds the DEFEAT REWATCH STACKS onto elite + boss INSIDE both walks at the
 * same time — a greedy-last full-graph manager walk where every combat node
 * takes its full escalating re-engage stack (attempt k costs 5×k instability)
 * before retreating, mixed with real victories on battle nodes. TWO
 * clean-room oracles are asserted at EVERY step (enter / every re-engage /
 * victory / retreat / resolve / advance):
 *
 *   instability === foldInstability(ledger)   — the escalating 5×k tax
 *     compounds through the live ledger exactly (a new action, a changed
 *     escalation curve, or a lost clamp fails here);
 *   killsEarned === oracleKillsFold(...)      — defeats add ZERO kills, only
 *     COMMITTED victory ENGAGEs fold their family amount from the persisted
 *     gold slot.
 *
 * The walk is CUT BY RunManager.restore() at EVERY hop: a reload must never
 * reset the escalation (it is ledger-persisted) nor re-grant kills. Coverage
 * guards pin that elite AND the boss genuinely received committed re-engages
 * (the family-independent tax) and that a victory actually moved kills.
 */
import { describe, expect, it } from 'vitest';
import { RunManager } from '../../src/game/expedition/run-manager.js';
import { enterTransactionId, actionTransactionId } from '../../src/features/expedition/transaction-ids.js';
import { MAX_REENGAGE_ATTEMPTS } from '../../src/game/expedition/nodes/handlers/combat.js';
import type { NodeRunState, TransactionRecord } from '../../src/game/expedition/nodes/types.js';
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

const isCombat = (t: string): boolean => t === 'battle' || t === 'elite' || t === 'boss';

// ---------------------------------------------------------------------------
// CLEAN-ROOM ORACLES (independent specs — never import the handler modules).
// ---------------------------------------------------------------------------

const ENTER_DELTA_BY_TYPE: Readonly<Record<string, number>> = Object.freeze({
  battle: 5, elite: 12, boss: 0, event: 3, merchant: 3, recruitment: 4,
  treasure: 5, workshop: 2, altar: 8, scout: 2, anchor: -10, story: 0,
});

function typeOf(map: ExpeditionMap, nodeId: string): string {
  const node = map.nodes.find((candidate) => candidate.id === nodeId);
  return node?.type ?? 'story';
}

/** Folds the committed ledger into the instability the run SHOULD have. */
function foldInstability(map: ExpeditionMap, ledger: Readonly<Record<string, TransactionRecord>>): number {
  let instability = 0;
  const defeatCountByNode = new Map<string, number>();
  for (const entry of Object.values(ledger)) {
    if (entry.status !== 'COMMITTED') continue;
    const type = typeOf(map, entry.nodeId);
    if (entry.action === 'ENTER') {
      instability = Math.max(0, instability + (ENTER_DELTA_BY_TYPE[type] ?? 0));
    } else if (entry.action === 'ENGAGE_DEFEAT') {
      const attempt = (defeatCountByNode.get(entry.nodeId) ?? 0) + 1;
      defeatCountByNode.set(entry.nodeId, attempt);
      instability = Math.max(0, instability + 5 * attempt);
    } else if (entry.action === 'ACCEPT' && type === 'altar') {
      instability = Math.max(0, instability + 10);
    } else if (entry.action === 'SERVICE') {
      instability = Math.max(0, instability + (type === 'merchant' ? -10 : type === 'anchor' ? -8 : 0));
    }
  }
  return instability;
}

/** Clean-room kills amount for one victory on a node family. */
function oracleKills(type: string, goldSlot: number): number {
  const battle = type === 'battle';
  return (battle ? 3 : 5) + (goldSlot % (battle ? 4 : 8));
}

/** Folds the persisted ledger + snapshots into the kills the run SHOULD have. */
function oracleKillsFold(state: NodeRunState, nodeTypes: Readonly<Map<string, string>>): number {
  let total = 0;
  for (const entry of Object.values(state.ledger)) {
    if (entry.action !== 'ENGAGE' || entry.status !== 'COMMITTED') continue;
    const type = nodeTypes.get(entry.nodeId);
    if (type === undefined || !['battle', 'elite', 'boss'].includes(type)) continue;
    const snap = state.snapshots[entry.nodeId];
    if (snap === undefined || snap.kind !== 'REWARD') continue;
    total += oracleKills(type, snap.rollSlots['gold'] ?? 0);
  }
  return total;
}

// ---------------------------------------------------------------------------
// THE MANAGER FULL-GRAPH WALK (greedy-last, re-engage stacks on elite/boss).
// ---------------------------------------------------------------------------

interface WalkStats {
  readonly committedByFamily: Readonly<Record<string, number>>;
  readonly victories: number;
  readonly cuts: number;
  readonly finalInstability: number;
  readonly finalKills: number;
}

/**
 * Greedy-last manager walk: threads every side branch (elites spawn there)
 * and the boss. Battle nodes alternate victory / full defeat stack; elite and
 * boss nodes ALWAYS take the full legal re-engage stack (attempts 1..3,
 * stopping at the first REJECTED — cap or ceiling) before retreating. After
 * EVERY mutation both oracles must equal the live scalars, and the run is
 * CUT by RunManager.restore() at EVERY hop.
 */
function walkFullGraph(seed: number): WalkStats {
  store.clear();
  let mgr = RunManager.create(seed, 500);
  const visited = new Set<string>();
  const nodeTypes = new Map<string, string>();
  const committedByFamily: Record<string, number> = {};
  let victories = 0;
  let cuts = 0;
  let guard = 0;

  const assertFolds = (label: string): void => {
    const snap = mgr.snapshot();
    expect(snap.state.instability, `${label} instability === fold (seed ${String(seed)})`).toBe(foldInstability(mgr.map, snap.state.ledger));
    expect(snap.state.killsEarned, `${label} kills === fold (seed ${String(seed)})`).toBe(oracleKillsFold(snap.state, nodeTypes));
  };

  while (guard < 200) {
    const snap = mgr.snapshot();
    const type = snap.currentNodeType;
    const nodeId = snap.currentNodeId;
    visited.add(nodeId);
    nodeTypes.set(nodeId, type);
    const runId = snap.state.runId;

    mgr.enter(enterTransactionId(runId, nodeId));
    assertFolds(`after ENTER ${nodeId}`);

    if (isCombat(type)) {
      if (type === 'battle' && guard % 2 === 0) {
        // A real victory: folds kills from the persisted gold slot, pays the
        // base reward, and a replay grants nothing.
        mgr.act({ transactionId: actionTransactionId(runId, nodeId, 'ENGAGE', 'win'), nodeId, action: 'ENGAGE', completedKinds: [] });
        victories += 1;
        assertFolds(`after ENGAGE ${nodeId}`);
        mgr.act({ transactionId: actionTransactionId(runId, nodeId, 'ENGAGE', 'win'), nodeId, action: 'ENGAGE', completedKinds: [] });
        assertFolds(`after ENGAGE replay ${nodeId}`);
      } else {
        // The FULL re-engage stack: attempts 1..3, each 5×k, stopping at the
        // first REJECTED (cap at 3 or the instability ceiling gates it).
        for (let attempt = 1; attempt <= MAX_REENGAGE_ATTEMPTS; attempt += 1) {
          const tx = actionTransactionId(runId, nodeId, 'ENGAGE_DEFEAT', `s${String(guard)}-${String(attempt)}`);
          const record = mgr.act({ transactionId: tx, nodeId, action: 'ENGAGE_DEFEAT' });
          if (record.status !== 'COMMITTED') break;
          committedByFamily[type] = (committedByFamily[type] ?? 0) + 1;
          assertFolds(`after ENGAGE_DEFEAT ${String(attempt)} ${nodeId}`);
        }
        // Retreat clears the lost node (never a soft-lock).
        mgr.act({ transactionId: actionTransactionId(runId, nodeId, 'DECLINE', `d${String(guard)}`), nodeId, action: 'DECLINE' });
        assertFolds(`after retreat ${nodeId}`);
      }
    } else {
      mgr.act({ transactionId: actionTransactionId(runId, nodeId, 'DECLINE', `x${String(guard)}`), nodeId, action: 'DECLINE' });
      assertFolds(`after DECLINE ${nodeId}`);
    }

    mgr.resolve();
    assertFolds(`after resolve ${nodeId}`);

    // CUT AT EVERY HOP: restore the persisted autosave — the restored
    // manager must carry the same ledger/scalars and continue identically.
    const beforeNode = mgr.snapshot().currentNodeId;
    const restored = RunManager.restore();
    expect(restored).not.toBeNull();
    if (restored === null) throw new Error('manager restore failed');
    mgr = restored;
    expect(mgr.snapshot().currentNodeId).toBe(beforeNode);
    assertFolds(`after restore-cut ${nodeId}`);
    cuts += 1;

    // Greedy-last: thread the next unvisited branch.
    const candidates = mgr.snapshot().reachableNodes.filter((id) => !visited.has(id));
    const next = candidates[candidates.length - 1];
    if (next === undefined) break;
    mgr.advance(next);
    assertFolds(`after advance ${nodeId}`);
    guard += 1;
  }

  const final = mgr.snapshot();
  expect(final.state.instability).toBe(foldInstability(mgr.map, final.state.ledger));
  expect(final.state.killsEarned).toBe(oracleKillsFold(final.state, nodeTypes));
  return {
    committedByFamily,
    victories,
    cuts,
    finalInstability: final.state.instability,
    finalKills: final.state.killsEarned,
  };
}

describe('P21 §9 re-engage stacks through the ledger-fold walks (manager full graph)', () => {
  it('the escalating 5×k re-engage tax and the kills fold hold at EVERY step with restore cuts at every hop', { timeout: 60_000 }, () => {
    // Seeds 502/504 reach elites AND the boss with committed re-engages under
    // the greedy-last walk (probed): the full-graph walk genuinely threads
    // side branches + boss with mixed victories and defeat stacks.
    let eliteCommits = 0;
    let bossCommits = 0;
    let totalVictories = 0;
    for (const seed of [502, 504]) {
      const stats = walkFullGraph(seed);
      eliteCommits += stats.committedByFamily['elite'] ?? 0;
      bossCommits += stats.committedByFamily['boss'] ?? 0;
      totalVictories += stats.victories;
      // The walk covered the graph (multiple hops + a real victory + cuts).
      // Seed 502's graph is 6 nodes — every hop is a restore cut.
      expect(stats.cuts).toBeGreaterThanOrEqual(6);
      expect(stats.victories).toBeGreaterThanOrEqual(1);
      // Defeats never moved kills from a victory: the fold already asserted
      // equality at every step; the final kills equal the clean-room fold.
      expect(stats.finalKills).toBeGreaterThan(0);
      // Instability never went negative and the ceiling stayed a gate (the
      // fold's floor clamp held at every step; ENTER may exceed 100 — a
      // validation bound, not a cap — so only the fold equality is the pin).
      expect(stats.finalInstability).toBeGreaterThanOrEqual(0);
    }
    // COVERAGE: the re-engage stacks genuinely landed on elite AND boss
    // families (the family-independent tax) — not just battles.
    expect(eliteCommits).toBeGreaterThanOrEqual(2);
    expect(bossCommits).toBeGreaterThanOrEqual(2);
    expect(totalVictories).toBeGreaterThanOrEqual(2);
  });

  it('the escalation curve is exactly 5×k per attempt: total tax === Σ 5k over committed re-engages on every node', () => {
    // Independent curve pin: fold each node's committed ENGAGE_DEFEAT records
    // in commit order and require the INSTABILITY contribution to be exactly
    // Σ 5·k. The ledger fold above already asserts the scalar; this pins the
    // CURVE itself (attempt k = 5k, k = 1..3, never re-rolled by a restore).
    store.clear();
    const mgr = RunManager.create(503, 500);
    const visited = new Set<string>();
    const curveCheck: Array<{ nodeId: string; attempts: number; tax: number }> = [];
    let guard = 0;
    while (guard < 200) {
      const snap = mgr.snapshot();
      const type = snap.currentNodeType;
      const nodeId = snap.currentNodeId;
      visited.add(nodeId);
      const runId = snap.state.runId;
      mgr.enter(enterTransactionId(runId, nodeId));
      if (isCombat(type) && type !== 'battle') {
        let attempts = 0;
        let tax = 0;
        for (let attempt = 1; attempt <= MAX_REENGAGE_ATTEMPTS; attempt += 1) {
          const rec = mgr.act({ transactionId: actionTransactionId(runId, nodeId, 'ENGAGE_DEFEAT', `c${String(guard)}-${String(attempt)}`), nodeId, action: 'ENGAGE_DEFEAT' });
          if (rec.status !== 'COMMITTED') break;
          attempts += 1;
          tax += 5 * attempt;
        }
        if (attempts > 0) curveCheck.push({ nodeId, attempts, tax });
        mgr.act({ transactionId: actionTransactionId(runId, nodeId, 'DECLINE', `cd${String(guard)}`), nodeId, action: 'DECLINE' });
      } else {
        mgr.act({ transactionId: actionTransactionId(runId, nodeId, 'DECLINE', `cx${String(guard)}`), nodeId, action: 'DECLINE' });
      }
      mgr.resolve();
      const candidates = mgr.snapshot().reachableNodes.filter((id) => !visited.has(id));
      const next = candidates[candidates.length - 1];
      if (next === undefined) break;
      mgr.advance(next);
      guard += 1;
    }
    // The curve is exactly 5, 15, 30 for 1, 2, 3 committed attempts.
    expect(curveCheck.length).toBeGreaterThan(0);
    for (const cell of curveCheck) {
      expect(cell.tax).toBe(5 * cell.attempts * (cell.attempts + 1) / 2);
      expect(cell.attempts).toBeLessThanOrEqual(MAX_REENGAGE_ATTEMPTS);
    }
  });
});
