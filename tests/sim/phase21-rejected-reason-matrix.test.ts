/**
 * Phase 21 §9 REJECTED-REASON FAMILY MATRIX. The durability contract is pinned
 * for the CEILING rejection (`OPTION_UNAVAILABLE` — phase21-rejected-attempt-
 * durability); this extends the same durable-record contract to EVERY ledger
 * rejection reason of the family that a real walk can trigger:
 *
 *   INSUFFICIENT_GOLD      — the recovery service at gold < 30 (anchor);
 *   ACTION_LIMIT           — a second victory ENGAGE after one already
 *                            committed (exactly-one ENGAGE);
 *   PREREQUISITE_MISSING   — a CLAIM_REWARD with no committed ENGAGE;
 *   NODE_ALREADY_RESOLVED  — any action on a RESOLVED visit.
 *
 * For EVERY reason (each on a REAL `RunManager`):
 *
 *   1. the RETURNED result AND the STORED ledger entry both carry
 *      `status: 'REJECTED'` with the EXACT reason;
 *   2. the rejection never mutates a scalar — instability, gold, kills and
 *      both loot pools are byte-identical before/after, and the clean-room
 *      fold still equals the scalar (the REJECTED record is fold-skipped);
 *   3. a `RunManager.restore()` cut keeps the record byte-identically (tx id,
 *      status, reason) — every rejection is durable across a reload;
 *   4. the rejection is never a soft-lock: a legal action on the SAME node
 *      still commits afterwards (a rejected ENGAGE never blocks the claim; a
 *      rejected claim never blocks the ENGAGE; a rejected service never
 *      blocks the retreat).
 */
import { describe, expect, it } from 'vitest';
import { RunManager } from '../../src/game/expedition/run-manager.js';
import { mainPath } from '../../src/game/expedition/expedition-runner.js';
import { enterTransactionId, actionTransactionId } from '../../src/features/expedition/transaction-ids.js';
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

/** The full scalar tuple the matrix asserts is byte-identical across a rejection. */
function scalars(mgr: RunManager): {
  readonly instability: number;
  readonly gold: number;
  readonly killsEarned: number;
  readonly securedLoot: readonly string[];
  readonly unsecuredLoot: readonly string[];
} {
  const snap = mgr.snapshot();
  return {
    instability: snap.state.instability,
    gold: snap.state.gold,
    killsEarned: snap.state.killsEarned,
    securedLoot: snap.state.securedLoot,
    unsecuredLoot: snap.state.unsecuredLoot,
  };
}

function expectScalarsEqual(a: ReturnType<typeof scalars>, b: ReturnType<typeof scalars>, label: string): void {
  expect(b.instability, `${label} instability`).toBe(a.instability);
  expect(b.gold, `${label} gold`).toBe(a.gold);
  expect(b.killsEarned, `${label} kills`).toBe(a.killsEarned);
  expect(b.securedLoot, `${label} secured`).toEqual(a.securedLoot);
  expect(b.unsecuredLoot, `${label} unsecured`).toEqual(a.unsecuredLoot);
}

function expectRejectedContract(
  mgr: RunManager,
  txId: string,
  reason: string,
  before: ReturnType<typeof scalars>,
  label: string,
): void {
  // 1. returned + stored: both REJECTED with the EXACT reason.
  expect(mgr.snapshot().state.ledger[txId]?.status, `${label} stored status`).toBe('REJECTED');
  expect(mgr.snapshot().state.ledger[txId]?.reason, `${label} stored reason`).toBe(reason);
  // 2. scalars byte-identical + fold skips the record.
  expectScalarsEqual(before, scalars(mgr), label);
  expect(mgr.snapshot().state.instability, `${label} fold`).toBe(foldInstability(mgr.map, mgr.snapshot().state.ledger));
  // 3. a restore cut keeps the record byte-identically.
  const restored = RunManager.restore();
  expect(restored, `${label} restore`).not.toBeNull();
  if (restored === null) throw new Error('restore failed');
  expect(restored.snapshot().state.ledger[txId]?.status, `${label} restored status`).toBe('REJECTED');
  expect(restored.snapshot().state.ledger[txId]?.reason, `${label} restored reason`).toBe(reason);
  expect(restored.snapshot().state.ledger[txId]?.transactionId, `${label} restored tx`).toBe(txId);
  expectScalarsEqual(before, scalars(restored), `${label} restored scalars`);
}

describe('P21 §9 rejected-reason family matrix (real manager, real ledger)', () => {
  it('INSUFFICIENT_GOLD: the recovery service at gold < 30 is a durable fold-skipped record that never moves a scalar and never soft-locks the anchor', { timeout: 60_000 }, () => {
    store.clear();
    const mgr = RunManager.create(903, 20); // the anchor service (30) is unaffordable
    const path = mainPath(mgr.map);
    const runId = mgr.snapshot().state.runId;
    // Walk to the anchor (index 3): decline the two battles + the event.
    for (let guard = 0; guard < 3; guard += 1) {
      const snap = mgr.snapshot();
      mgr.enter(enterTransactionId(runId, snap.currentNodeId));
      mgr.act({ transactionId: actionTransactionId(runId, snap.currentNodeId, 'DECLINE', `m-${String(guard)}`), nodeId: snap.currentNodeId, action: 'DECLINE' });
      mgr.resolve();
      mgr.advance(path[guard + 1] ?? snap.currentNodeId);
    }
    const anchorId = mgr.snapshot().currentNodeId;
    expect(mgr.snapshot().currentNodeType).toBe('anchor');
    mgr.enter(enterTransactionId(runId, anchorId));
    const txId = actionTransactionId(runId, anchorId, 'SERVICE', 'm-s');
    const before = scalars(mgr);
    const record = mgr.act({ transactionId: txId, nodeId: anchorId, action: 'SERVICE' });
    expect(record.status).toBe('REJECTED');
    expect(record.reason).toBe('INSUFFICIENT_GOLD');
    expectRejectedContract(mgr, txId, 'INSUFFICIENT_GOLD', before, 'anchor service');
    // 4. not a soft-lock: the DECLINE still commits on the same node.
    const decline = mgr.act({ transactionId: actionTransactionId(runId, anchorId, 'DECLINE', 'm-d'), nodeId: anchorId, action: 'DECLINE' });
    expect(decline.status).toBe('COMMITTED');
  });

  it('ACTION_LIMIT: a second victory ENGAGE after one committed is a durable fold-skipped record that never moves a scalar and never blocks the claim', { timeout: 60_000 }, () => {
    store.clear();
    const mgr = RunManager.create(903, 500);
    const runId = mgr.snapshot().state.runId;
    const battleId = mgr.snapshot().currentNodeId;
    mgr.enter(enterTransactionId(runId, battleId));
    // The first victory ENGAGE COMMITS (exactly-one ENGAGE per node).
    const first = mgr.act({ transactionId: actionTransactionId(runId, battleId, 'ENGAGE', 'a'), nodeId: battleId, action: 'ENGAGE', completedKinds: ['kill_regulars'] });
    expect(first.status).toBe('COMMITTED');
    // The SECOND ENGAGE (fresh tx) is REJECTED ACTION_LIMIT.
    const txId = actionTransactionId(runId, battleId, 'ENGAGE', 'a2');
    const before = scalars(mgr);
    const record = mgr.act({ transactionId: txId, nodeId: battleId, action: 'ENGAGE', completedKinds: ['kill_regulars'] });
    expect(record.status).toBe('REJECTED');
    expect(record.reason).toBe('ACTION_LIMIT');
    expectRejectedContract(mgr, txId, 'ACTION_LIMIT', before, 'second ENGAGE');
    // 4. not a soft-lock: the CLAIM (legal after the first ENGAGE) still
    // commits on the same node.
    const reward = mgr.snapshot().state.snapshots[battleId];
    if (reward === undefined || reward.kind !== 'REWARD') throw new Error('no reward snapshot');
    const option = reward.rewardIds[0];
    if (option === undefined) throw new Error('no reward id');
    const claim = mgr.act({ transactionId: actionTransactionId(runId, battleId, 'CLAIM_REWARD', option), nodeId: battleId, action: 'CLAIM_REWARD', optionId: option });
    expect(claim.status).toBe('COMMITTED');
    // The run is still walkable: finish cleanly.
    mgr.resolve();
    mgr.finish();
    expect(mgr.snapshot().runStatus).toBe('finished');
  });

  it('PREREQUISITE_MISSING: a claim with no committed ENGAGE is a durable fold-skipped record that never moves a scalar and never blocks the ENGAGE', { timeout: 60_000 }, () => {
    store.clear();
    const mgr = RunManager.create(903, 500);
    const runId = mgr.snapshot().state.runId;
    const battleId = mgr.snapshot().currentNodeId;
    mgr.enter(enterTransactionId(runId, battleId));
    // The reward snapshot is materialized at enter — a claim with NO ENGAGE
    // is refused by design (a defeat/undecided node can never be claimed).
    const reward = mgr.snapshot().state.snapshots[battleId];
    if (reward === undefined || reward.kind !== 'REWARD') throw new Error('no reward snapshot');
    const option = reward.rewardIds[0];
    if (option === undefined) throw new Error('no reward id');
    const txId = actionTransactionId(runId, battleId, 'CLAIM_REWARD', option);
    const before = scalars(mgr);
    const record = mgr.act({ transactionId: txId, nodeId: battleId, action: 'CLAIM_REWARD', optionId: option });
    expect(record.status).toBe('REJECTED');
    expect(record.reason).toBe('PREREQUISITE_MISSING');
    expectRejectedContract(mgr, txId, 'PREREQUISITE_MISSING', before, 'claim without ENGAGE');
    // 4. not a soft-lock: the victory ENGAGE still commits on the same node
    // (the refused claim left no verdict).
    const engage = mgr.act({ transactionId: actionTransactionId(runId, battleId, 'ENGAGE', 'e'), nodeId: battleId, action: 'ENGAGE', completedKinds: ['kill_regulars'] });
    expect(engage.status).toBe('COMMITTED');
  });

  it('NODE_ALREADY_RESOLVED: an action on a RESOLVED visit is a durable fold-skipped record that never moves a scalar and never breaks navigation', { timeout: 60_000 }, () => {
    store.clear();
    const mgr = RunManager.create(903, 500);
    const path = mainPath(mgr.map);
    const runId = mgr.snapshot().state.runId;
    // Walk to the event (index 1), decline + resolve it.
    mgr.enter(enterTransactionId(runId, mgr.snapshot().currentNodeId));
    mgr.act({ transactionId: actionTransactionId(runId, mgr.snapshot().currentNodeId, 'DECLINE', 'n-0'), nodeId: mgr.snapshot().currentNodeId, action: 'DECLINE' });
    mgr.resolve();
    mgr.advance(path[1] ?? mgr.snapshot().currentNodeId);
    const eventId = mgr.snapshot().currentNodeId;
    expect(mgr.snapshot().currentNodeType).toBe('event');
    mgr.enter(enterTransactionId(runId, eventId));
    mgr.act({ transactionId: actionTransactionId(runId, eventId, 'DECLINE', 'n-1'), nodeId: eventId, action: 'DECLINE' });
    mgr.resolve();
    // The visit is RESOLVED — a fresh action on the same (current) node is
    // refused NODE_ALREADY_RESOLVED, not thrown and not applied.
    const txId = actionTransactionId(runId, eventId, 'DECLINE', 'n-1b');
    const before = scalars(mgr);
    const record = mgr.act({ transactionId: txId, nodeId: eventId, action: 'DECLINE' });
    expect(record.status).toBe('REJECTED');
    expect(record.reason).toBe('NODE_ALREADY_RESOLVED');
    expectRejectedContract(mgr, txId, 'NODE_ALREADY_RESOLVED', before, 'action on resolved visit');
    // 4. not a soft-lock: navigation still works — advance to the next node
    // and the walk completes.
    mgr.advance(path[2] ?? eventId);
    expect(mgr.snapshot().currentNodeId).toBe(path[2]);
    expect(mgr.snapshot().state.ledger[txId]?.status).toBe('REJECTED');
  });
});
