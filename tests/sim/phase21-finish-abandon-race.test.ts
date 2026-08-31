/**
 * Phase 21 §9 DOUBLE-FINISH / ABANDON-UNDER-ACTIVE-WALK RACE. The guard
 * breadth proves a finished run rejects every mutation; this pins the RACE:
 * `finish()` and `abandon()` issued while a re-engage stack is MID-COMMIT on
 * a combat node (the manager autosaves between rewatches). The finished /
 * abandoned boundary must never resurrect a half-committed rewatch nor leave
 * a stale save:
 *
 *   1. finish() mid-stack SEALS the run: the half-committed rewatch stays a
 *      durable ledger record (escalation persisted), the next re-engage AND
 *      the retreat BOTH throw RUN_ALREADY_FINISHED, the finished autosave is
 *      a codec fixed point, restore() reloads it still sealed, and a second
 *      finish() is a no-op (no revision bump, no error);
 *   2. abandon() mid-stack CLEARS the run: no active instance, no save, the
 *      half-committed rewatch is gone, restore() returns null, and a fresh
 *      run boots with an EMPTY ledger — nothing resurrects;
 *   3. the RACE ORDER: finish() then abandon() still clears everything (a
 *      finished + half-committed state cannot outlive abandon), and
 *      abandon() then a fresh finish() on the next run is clean.
 */
import { describe, expect, it } from 'vitest';
import { RunManager } from '../../src/game/expedition/run-manager.js';
import { encodeExpeditionSave, restoreExpeditionSave } from '../../src/game/expedition/expedition-save.js';
import { restoreExpedition } from '../../src/game/expedition/expedition-runner.js';
import { ExpeditionError } from '../../src/game/expedition/expedition-error.js';
import { enterTransactionId, actionTransactionId } from '../../src/features/expedition/transaction-ids.js';

const store = new Map<string, string>();
(globalThis as { localStorage: unknown }).localStorage = {
  getItem(key: string) { return store.get(String(key)) ?? null; },
  setItem(key: string, value: string) { store.set(String(key), String(value)); },
  removeItem(key: string) { store.delete(String(key)); },
  clear() { store.clear(); },
  get length() { return store.size; },
  key(index: number) { return [...store.keys()][index] ?? null; },
};

function expectFinishedGuard(fn: () => unknown): void {
  let thrown: unknown;
  try {
    fn();
  } catch (error) {
    thrown = error;
  }
  expect(thrown).toBeInstanceOf(ExpeditionError);
  expect((thrown as ExpeditionError).code).toBe('RUN_ALREADY_FINISHED');
}

/** A fresh manager on seed 707 (start node = battle) with ONE committed re-engage (mid-stack). */
function midStackManager(): RunManager {
  store.clear();
  const mgr = RunManager.create(707, 300);
  const runId = mgr.snapshot().state.runId;
  const nodeId = mgr.snapshot().currentNodeId;
  mgr.enter(enterTransactionId(runId, nodeId));
  const record = mgr.act({ transactionId: actionTransactionId(runId, nodeId, 'ENGAGE_DEFEAT', 'mid-1'), nodeId, action: 'ENGAGE_DEFEAT' });
  expect(record.status).toBe('COMMITTED');
  return mgr;
}

describe('P21 §9 double-finish / abandon-under-active-walk race', () => {
  it('finish() mid re-engage stack SEALS the half-committed rewatch durably: next re-engage and retreat both throw, the autosave is a fixed point, restore stays sealed, second finish() is a no-op', () => {
    const mgr = midStackManager();
    const nodeId = mgr.snapshot().currentNodeId;
    const runId = mgr.snapshot().state.runId;
    const instAtFinish = mgr.snapshot().state.instability;
    // The half-committed rewatch moved the scalar (battle ENTER +5, defeat 1
    // +5 → 10) and is a durable ledger record.
    expect(instAtFinish).toBe(10);
    expect(Object.values(mgr.snapshot().state.ledger).filter((r) => r.action === 'ENGAGE_DEFEAT' && r.status === 'COMMITTED').length).toBe(1);

    // finish() mid-stack: the run is sealed.
    mgr.finish();
    expect(mgr.snapshot().runStatus).toBe('finished');
    // The finished state's revision is the sealed one a restore must reload.
    const revision = mgr.snapshot().state.revision;
    // The next re-engage is REJECTED BY THE GUARD (RUN_ALREADY_FINISHED), not
    // by the cap or ceiling — the escalation is frozen exactly where it was.
    expectFinishedGuard(() => mgr.act({ transactionId: actionTransactionId(runId, nodeId, 'ENGAGE_DEFEAT', 'mid-2'), nodeId, action: 'ENGAGE_DEFEAT' }));
    // The retreat is equally impossible — the sealed run cannot even clear
    // the lost node (nothing can mutate a finished run).
    expectFinishedGuard(() => mgr.act({ transactionId: actionTransactionId(runId, nodeId, 'DECLINE', 'mid-d'), nodeId, action: 'DECLINE' }));
    expectFinishedGuard(() => { mgr.resolve(); });
    // The half-committed rewatch is UNTOUCHED in the finished state.
    expect(Object.values(mgr.snapshot().state.ledger).filter((r) => r.action === 'ENGAGE_DEFEAT' && r.status === 'COMMITTED').length).toBe(1);

    // The finished autosave is a codec fixed point.
    const runner = restoreExpedition(mgr.snapshot().state, mgr.map, mgr.snapshot().currentNodeId);
    const serialized = encodeExpeditionSave(runner);
    const restored = restoreExpeditionSave(serialized, mgr.map);
    expect(encodeExpeditionSave(restored)).toBe(serialized);
    // The restored finished run still carries the ONE committed rewatch (the
    // escalation was persisted — a hypothetical un-seal would pay 10 next).
    expect(Object.values(restored.state.ledger).filter((r) => r.action === 'ENGAGE_DEFEAT' && r.status === 'COMMITTED').length).toBe(1);

    // RunManager.restore() reloads the sealed run — still sealed, still
    // guarded, same revision.
    const reloaded = RunManager.restore();
    expect(reloaded).not.toBeNull();
    if (reloaded === null) throw new Error('restore failed');
    expect(reloaded.snapshot().runStatus).toBe('finished');
    expect(reloaded.snapshot().state.revision).toBe(revision);
    expectFinishedGuard(() => reloaded.act({ transactionId: actionTransactionId(runId, nodeId, 'ENGAGE_DEFEAT', 'mid-3'), nodeId, action: 'ENGAGE_DEFEAT' }));

    // A second finish() is a no-op: no error, no revision bump.
    reloaded.finish();
    expect(reloaded.snapshot().state.revision).toBe(revision);
    expect(reloaded.snapshot().runStatus).toBe('finished');
  });

  it('abandon() mid re-engage stack CLEARS the half-committed rewatch: no active instance, no save, restore() returns null, and a fresh run boots with an EMPTY ledger', () => {
    const mgr = midStackManager();
    expect(RunManager.active).toBe(mgr);
    expect(RunManager.hasSave()).toBe(true);
    RunManager.abandon();
    expect(RunManager.active).toBeNull();
    expect(RunManager.hasSave()).toBe(false);
    expect(store.size).toBe(0);
    // restore() after abandon: nothing to restore — the half-committed
    // rewatch cannot resurrect.
    expect(RunManager.restore()).toBeNull();
    // A fresh run boots clean: empty ledger, no rewatch records.
    const fresh = RunManager.create(707, 300);
    expect(fresh.snapshot().state.ledger).toEqual({});
    expect(fresh.snapshot().state.instability).toBe(0);
    expect(fresh.snapshot().state.runStatus).toBe('active');
  });

  it('the RACE ORDER: finish() then abandon() clears even a finished half-committed state, and abandon() then finish() on the next run is clean', () => {
    // RACE A: finish() mid-stack, THEN abandon() — abandon wins: everything
    // (the sealed run + the half-committed rewatch) is wiped, no stale save.
    const mgr = midStackManager();
    mgr.finish();
    expect(mgr.snapshot().runStatus).toBe('finished');
    RunManager.abandon();
    expect(RunManager.active).toBeNull();
    expect(RunManager.hasSave()).toBe(false);
    expect(store.size).toBe(0);
    expect(RunManager.restore()).toBeNull();
    // RACE B: abandon() mid-stack, then a fresh run that finish()es — the
    // abandoned rewatch never leaks into the next run's ledger.
    void midStackManager();
    RunManager.abandon();
    const third = RunManager.create(707, 300);
    third.finish();
    expect(third.snapshot().runStatus).toBe('finished');
    expect(Object.values(third.snapshot().state.ledger)).toHaveLength(0);
    // The finished second run's autosave is a fixed point too.
    const runner = restoreExpedition(third.snapshot().state, third.map, third.snapshot().currentNodeId);
    const serialized = encodeExpeditionSave(runner);
    expect(encodeExpeditionSave(restoreExpeditionSave(serialized, third.map))).toBe(serialized);
  });
});
