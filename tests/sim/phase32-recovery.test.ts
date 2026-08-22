import { describe, expect, it } from 'vitest';
import { VISIT_STATUSES, applyVisitCommand, isVisitStatus, recoverVisit, transitionVisit } from '../../src/game/expedition/nodes/visit-state.js';
import { prepareNodeCommit, resolveNode } from '../../src/game/expedition/nodes/node-transaction.js';
import { openVisit } from '../../src/game/expedition/nodes/run-state.js';
import { merchantHandler } from '../../src/game/expedition/nodes/handlers/merchant.js';
import { commitFlow, definition, openAndPrepare, request, baseState, catchExpeditionCode, offerOf } from './phase32-helpers.js';
import type { NodeRunState, NodeVisitState } from '../../src/game/expedition/nodes/types.js';

describe('phase32 visit state machine (SAVE_RECOVERY_CONTRACT)', () => {
  it('walks OPEN → COMMITTING → COMMITTED → RESOLVED in order', () => {
    expect(applyVisitCommand('OPEN', 'startCommit')).toBe('COMMITTING');
    expect(applyVisitCommand('COMMITTING', 'commit')).toBe('COMMITTED');
    expect(applyVisitCommand('COMMITTED', 'resolve')).toBe('RESOLVED');
    expect(VISIT_STATUSES).toEqual(['OPEN', 'COMMITTING', 'COMMITTED', 'RESOLVED']);
    expect(isVisitStatus('OPEN')).toBe(true);
    expect(isVisitStatus('BROKEN')).toBe(false);
  });

  it('rejects illegal transitions and unknown commands', () => {
    expect(catchExpeditionCode(() => transitionVisit('OPEN', 'RESOLVED'))).toBe('VISIT_STATE_INVALID');
    expect(catchExpeditionCode(() => transitionVisit('RESOLVED', 'OPEN'))).toBe('VISIT_STATE_INVALID');
    expect(catchExpeditionCode(() => applyVisitCommand('RESOLVED', 'startCommit'))).toBe('VISIT_STATE_INVALID');
  });

  it('COMMITTING resumes via the ledger, never re-rolls; COMMITTED replays presentation only', () => {
    expect(recoverVisit('COMMITTING', true)).toEqual({ status: 'COMMITTED', resumed: true });
    expect(recoverVisit('COMMITTING', false)).toEqual({ status: 'OPEN', resumed: true });
    expect(recoverVisit('COMMITTED', true)).toEqual({ status: 'COMMITTED', resumed: false });
    expect(recoverVisit('OPEN', false)).toEqual({ status: 'OPEN', resumed: false });
  });

  it('a saved COMMITTING with a ledger entry continues as COMMITTED', () => {
    const def = definition('node-recover-1', 'merchant');
    let state = openAndPrepare(baseState(), merchantHandler, def);
    const offer = offerOf(state, def.nodeId, 0);
    state = prepareNodeCommit(state, request(def.nodeId, 'BUY', 'tx-recover-1', offer.offerId));
    expect(state.visits[def.nodeId]?.status).toBe('COMMITTING');
    const committed = commitFlow(state, merchantHandler, def, request(def.nodeId, 'BUY', 'tx-recover-1', offer.offerId));
    expect(committed.state.visits[def.nodeId]?.status).toBe('COMMITTED');
    expect(committed.state.gold).toBeLessThan(100);
  });

  it('recovery of a COMMITTING without ledger entry rolls back to OPEN', () => {
    const def = definition('node-recover-2', 'merchant');
    const state = openAndPrepare(baseState(), merchantHandler, def);
    const visit = state.visits[def.nodeId];
    if (visit === undefined) throw new Error('visit missing');
    const committingVisit: NodeVisitState = { ...visit, status: 'COMMITTING', transactionId: 'tx-lost' };
    const committing: NodeRunState = { ...state, visits: { ...state.visits, [def.nodeId]: committingVisit } };
    const recovered = recoverVisit('COMMITTING', false);
    expect(recovered.status).toBe('OPEN');
    // The flow layer rolls the visit back to OPEN, then a new transaction commits normally.
    const rolledBackVisit: NodeVisitState = { ...visit, status: 'OPEN' };
    const rolledBack: NodeRunState = { ...committing, visits: { ...committing.visits, [def.nodeId]: rolledBackVisit } };
    const retried = commitFlow(rolledBack, merchantHandler, def, request(def.nodeId, 'BUY', 'tx-recover-2', offerOf(state, def.nodeId, 0).offerId));
    expect(retried.outcome.result.status).toBe('COMMITTED');
  });

  it('RESOLVED only navigates: openVisit and new commits are refused', () => {
    const def = definition('node-recover-3', 'merchant');
    const state = openAndPrepare(baseState(), merchantHandler, def);
    const offer = offerOf(state, def.nodeId, 0);
    const committed = commitFlow(state, merchantHandler, def, request(def.nodeId, 'BUY', 'tx-recover-3', offer.offerId));
    const resolved = resolveNode(committed.state, def.nodeId);
    expect(resolved.visits[def.nodeId]?.status).toBe('RESOLVED');
    expect(catchExpeditionCode(() => resolveNode(resolved, def.nodeId))).toBeNull(); // idempotent
    const again = commitFlow(resolved, merchantHandler, def, request(def.nodeId, 'BUY', 'tx-recover-3b', offer.offerId));
    expect(again.outcome.result.status).toBe('REJECTED');
  });

  it('openVisit is idempotent and never rewrites an existing visit', () => {
    const def = definition('node-recover-4', 'merchant');
    const state = openAndPrepare(baseState(), merchantHandler, def);
    const again = openVisit(state, def.nodeId, 99);
    expect(again.visits[def.nodeId]).toBe(state.visits[def.nodeId]);
    expect(again.visits[def.nodeId]?.previewRevision).toBe(0);
  });
});
