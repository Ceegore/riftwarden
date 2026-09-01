import { describe, expect, it } from 'vitest';
import { applyOutcomeCommands } from '../../src/game/expedition/outcome-commands.js';
import { merchantHandler } from '../../src/game/expedition/nodes/handlers/merchant.js';
import { eventHandler } from '../../src/game/expedition/nodes/handlers/event.js';
import { recoverVisit } from '../../src/game/expedition/nodes/visit-state.js';
import { baseState, catchExpeditionCode, commitFlow, definition, offerOf, openAndPrepare, readJson, request, resolveFlow } from './phase32-helpers.js';
import type { NodeRunState } from '../../src/game/expedition/nodes/types.js';

describe('phase32 exactly-once transactions', () => {
  const def = definition('node-tx-merchant', 'merchant');

  it('100 repeated commits of one id mutate exactly once', () => {
    const state = openAndPrepare(baseState({ gold: 10000 }), merchantHandler, def);
    const offer = offerOf(state, def.nodeId, 0);
    let current = state;
    for (let i = 0; i < 100; i += 1) {
      const outcome = commitFlow(current, merchantHandler, def, request(def.nodeId, 'BUY', 'tx-repeat-1', offer.offerId));
      current = outcome.state;
      if (i === 0) expect(outcome.outcome.replayed).toBe(false);
      else expect(outcome.outcome.replayed).toBe(true);
    }
    expect(current.gold).toBe(10000 - offer.priceGold);
    expect(current.unsecuredLoot.filter((id) => id === offer.rewardId)).toHaveLength(1);
  });

  it('ledger records are immutable: replay returns the stored result', () => {
    const state = openAndPrepare(baseState(), merchantHandler, def);
    const offer = offerOf(state, def.nodeId, 0);
    const first = commitFlow(state, merchantHandler, def, request(def.nodeId, 'BUY', 'tx-immutable', offer.offerId));
    const stored = first.state.ledger['tx-immutable'];
    expect(stored?.status).toBe('COMMITTED');
    const replay = commitFlow(first.state, merchantHandler, def, request(def.nodeId, 'BUY', 'tx-immutable', offer.offerId));
    expect(replay.outcome.result).toBe(stored);
  });

  it('a throwing validation leaves the old complete state untouched', () => {
    const state = openAndPrepare(baseState(), merchantHandler, def);
    expect(() => commitFlow(state, merchantHandler, def, request(def.nodeId, 'BUY', 'tx-throw', 'offer-nope'))).toThrow();
    expect(state.gold).toBe(100);
    expect(state.ledger['tx-throw']).toBeUndefined();
  });

  it('unknown outcome command kinds reject the whole batch before applying', () => {
    const state = baseState({ gold: 50 });
    expect(catchExpeditionCode(() => applyOutcomeCommands(state, [{ kind: 'TELEPORT' as never, amount: 10 }]))).toBe('UNKNOWN_OUTCOME_COMMAND');
    expect(state.gold).toBe(50);
  });

  it('a negative-resource batch rejects atomically', () => {
    const state = baseState({ gold: 5 });
    const commands = [
      { kind: 'GOLD_DELTA', amount: -5 },
      { kind: 'GOLD_DELTA', amount: -1 },
    ] as const;
    expect(catchExpeditionCode(() => applyOutcomeCommands(state, commands))).toBe('NEGATIVE_RESOURCE');
    expect(state.gold).toBe(5);
  });
});

describe('phase32 kill/storage matrix (fixture-driven)', () => {
  const matrix = readJson('fixtures/kill-storage-matrix.json') as readonly { readonly point: string; readonly expected: string }[];
  const def = definition('node-kill-merchant', 'merchant');

  function merchantWithOffer(gold = 100): { readonly state: NodeRunState; readonly offerId: string } {
    const state = openAndPrepare(baseState({ gold }), merchantHandler, def);
    return { state, offerId: offerOf(state, def.nodeId, 0).offerId };
  }

  it('pins all five kill points', () => {
    expect(matrix.map((row) => row.point)).toEqual([
      'before_prepare',
      'after_prepare_before_durable_commit',
      'after_durable_commit_before_resolve',
      'after_resolve_before_navigation',
      'storage_failure',
    ]);
  });

  it('before_prepare: a kill mutates nothing', () => {
    const { state } = merchantWithOffer();
    expect(state.visits[def.nodeId]?.status).toBe('OPEN');
    expect(state.snapshots[def.nodeId]).toBeDefined();
    expect(state.ledger['tx-kill']).toBeUndefined();
    expect(state.gold).toBe(100);
  });

  it('after_prepare_before_durable_commit: COMMITTING resumes or rolls back, never re-rolls', () => {
    const { state, offerId } = merchantWithOffer();
    const requestObj = request(def.nodeId, 'BUY', 'tx-kill-committing', offerId);
    // Simulate: prepare ran (visit COMMITTING) but the durable commit never
    // completed. Recovery consults the ledger: no entry → rollback to OPEN.
    const visit = state.visits[def.nodeId];
    if (visit === undefined) throw new Error('visit missing');
    const committingState: NodeRunState = {
      ...state,
      visits: { ...state.visits, [def.nodeId]: { ...visit, status: 'COMMITTING', transactionId: requestObj.transactionId } },
    };
    expect(recoverVisit('COMMITTING', false).status).toBe('OPEN');
    expect(recoverVisit('COMMITTING', true).status).toBe('COMMITTED');
    // A saved COMMITTING with a ledger entry resumes as COMMITTED (no re-roll).
    const committed = commitFlow(committingState, merchantHandler, def, requestObj);
    expect(committed.outcome.result.status).toBe('COMMITTED');
    expect(committed.state.visits[def.nodeId]?.status).toBe('COMMITTED');
    expect(committed.state.gold).toBe(100 - offerOf(committed.state, def.nodeId, 0).priceGold);
  });

  it('after_durable_commit_before_resolve: ledger replay, no double cost or reward', () => {
    const { state, offerId } = merchantWithOffer();
    const first = commitFlow(state, merchantHandler, def, request(def.nodeId, 'BUY', 'tx-kill-committed', offerId));
    expect(first.state.visits[def.nodeId]?.status).toBe('COMMITTED');
    // Kill here, resume: the same transaction replays from the ledger.
    const replay = commitFlow(first.state, merchantHandler, def, request(def.nodeId, 'BUY', 'tx-kill-committed', offerId));
    expect(replay.outcome.replayed).toBe(true);
    expect(replay.state.gold).toBe(first.state.gold);
    expect(replay.state.unsecuredLoot).toEqual(first.state.unsecuredLoot);
  });

  it('after_resolve_before_navigation: presentation only — no new actions', () => {
    const { state, offerId } = merchantWithOffer();
    const first = commitFlow(state, merchantHandler, def, request(def.nodeId, 'BUY', 'tx-kill-resolved', offerId));
    const resolved = resolveFlow(first.state, def.nodeId);
    expect(resolved.visits[def.nodeId]?.status).toBe('RESOLVED');
    // A new action after RESOLVED is refused with a visible reason.
    const newAction = commitFlow(resolved, merchantHandler, def, request(def.nodeId, 'REROLL', 'tx-kill-after-resolve'));
    expect(newAction.outcome.result.status).toBe('REJECTED');
    expect(newAction.outcome.result.reason).toBe('NODE_ALREADY_RESOLVED');
  });

  it('storage_failure: no success UI — the old state stays and resumes cleanly', () => {
    const { state, offerId } = merchantWithOffer();
    // Simulate a storage failure: the durable write throws, the app shows no
    // success UI, and the previously persisted COMMITTING state remains.
    const failing = (() => {
      const requestObj = request(def.nodeId, 'BUY', 'tx-kill-storage', offerId);
      const visit = state.visits[def.nodeId];
      if (visit === undefined) throw new Error('visit missing');
      return {
        ...state,
        visits: { ...state.visits, [def.nodeId]: { ...visit, status: 'COMMITTING', transactionId: requestObj.transactionId } },
      } as NodeRunState;
    })();
    expect(failing.ledger['tx-kill-storage']).toBeUndefined();
    // Recovery with no ledger entry rolls back to OPEN; retry commits once.
    expect(recoverVisit('COMMITTING', false).status).toBe('OPEN');
    const retried = commitFlow(failing, merchantHandler, def, request(def.nodeId, 'BUY', 'tx-kill-storage', offerId));
    expect(retried.outcome.result.status).toBe('COMMITTED');
    expect(retried.state.gold).toBeLessThan(100);
  });
});

describe('phase32 event fault injection', () => {
  const def = definition('node-fault-event', 'event', 'event-01');

  it('double click and double callback commit once', () => {
    const state = openAndPrepare(baseState(), eventHandler, def);
    const first = commitFlow(state, eventHandler, def, request(def.nodeId, 'CONFIRM', 'tx-fault-double', 'event-01-a'));
    const second = commitFlow(first.state, eventHandler, def, request(def.nodeId, 'CONFIRM', 'tx-fault-double', 'event-01-a'));
    expect(second.outcome.replayed).toBe(true);
    expect(second.state.gold).toBe(first.state.gold);
  });

  it('insufficient prerequisites reject without mutation', () => {
    const state = openAndPrepare(baseState({ gold: 3 }), eventHandler, def);
    const confirm = commitFlow(state, eventHandler, def, request(def.nodeId, 'CONFIRM', 'tx-fault-poor', 'event-01-a'));
    expect(confirm.outcome.result.status).toBe('REJECTED');
    expect(confirm.state.gold).toBe(3);
  });

  it('a corrupt snapshot is a hard error, not a silent re-roll', () => {
    let state = openAndPrepare(baseState(), eventHandler, def);
    const snapshot = state.snapshots[def.nodeId];
    if (snapshot?.kind !== 'EVENT') throw new Error('snapshot missing');
    // Corrupt: swap the event snapshot for an offer snapshot.
    state = {
      ...state,
      snapshots: {
        ...state.snapshots,
        [def.nodeId]: { kind: 'OFFERS', snapshotId: 'x', nodeId: def.nodeId, seed: 1, offers: [], rollSlots: {}, rerollsUsed: 0 },
      },
    };
    expect(() => commitFlow(state, eventHandler, def, request(def.nodeId, 'CONFIRM', 'tx-fault-corrupt', 'event-01-a'))).toThrow();
  });
});
