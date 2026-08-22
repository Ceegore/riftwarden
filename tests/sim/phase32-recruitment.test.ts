import { describe, expect, it } from 'vitest';
import { recruitmentHandler, RECRUITMENT_COPY_LIMIT } from '../../src/game/expedition/nodes/handlers/recruitment.js';
import type { NodeCommitOutcome } from '../../src/game/expedition/nodes/node-transaction.js';
import { baseState, commitFlow, definition, openAndPrepare, request } from './phase32-helpers.js';
import type { NodeRunState } from '../../src/game/expedition/nodes/types.js';

const def = definition('node-recruit-1', 'recruitment');

function offersOf(state: NodeRunState, nodeId = def.nodeId): readonly { readonly offerId: string; readonly troopTypeId?: string; readonly priceGold: number }[] {
  const snapshot = state.snapshots[nodeId];
  if (snapshot?.kind !== 'OFFERS') throw new Error('recruitment snapshot missing');
  return snapshot.offers;
}

describe('phase32 recruitment', () => {
  it('materializes 2–3 deterministic candidates, persisted at first open', () => {
    const a = openAndPrepare(baseState({ runId: 'run-rec-a' }), recruitmentHandler, def);
    const b = openAndPrepare(baseState({ runId: 'run-rec-a' }), recruitmentHandler, def);
    const offers = offersOf(a);
    expect(offers.length).toBeGreaterThanOrEqual(2);
    expect(offers.length).toBeLessThanOrEqual(3);
    expect(a.snapshots[def.nodeId]).toEqual(b.snapshots[def.nodeId]);
    expect(new Set(offers.map((o) => o.troopTypeId)).size).toBe(offers.length);
  });

  it('reload reproduces the same candidates and the same selection state', () => {
    const state = openAndPrepare(baseState(), recruitmentHandler, def);
    const choose = commitFlow(state, recruitmentHandler, def, request(def.nodeId, 'CHOOSE', 'tx-rec-choose', offersOf(state)[0]?.offerId ?? ''));
    expect(choose.outcome.result.status).toBe('COMMITTED');
    expect(choose.state.visits[def.nodeId]?.status).toBe('COMMITTED');
    const replay = commitFlow(choose.state, recruitmentHandler, def, request(def.nodeId, 'CHOOSE', 'tx-rec-choose', offersOf(choose.state)[0]?.offerId ?? ''));
    expect(replay.outcome.replayed).toBe(true);
    expect(replay.state.recruits).toEqual(choose.state.recruits);
  });

  it('choosing recruits the troop exactly once; choose/decline ends the node', () => {
    let state = openAndPrepare(baseState(), recruitmentHandler, def);
    const offer = offersOf(state)[0];
    if (offer?.troopTypeId === undefined) throw new Error('candidate missing');
    const choose = commitFlow(state, recruitmentHandler, def, request(def.nodeId, 'CHOOSE', 'tx-rec-once', offer.offerId));
    state = choose.state;
    expect(state.recruits).toContain(offer.troopTypeId);
    expect(state.recruits.filter((id) => id === offer.troopTypeId)).toHaveLength(1);
    const second = commitFlow(state, recruitmentHandler, def, request(def.nodeId, 'CHOOSE', 'tx-rec-once-2', offer.offerId));
    // A different transaction after the node committed is refused: choose/decline ends the node.
    expect(second.outcome.result.status).toBe('REJECTED');
    expect(second.outcome.result.reason).toBe('ACTION_LIMIT');
  });

  it('enforces the Phase 31 copy limit before preview and before commit', () => {
    const base = openAndPrepare(baseState(), recruitmentHandler, def);
    const offer = offersOf(base)[0];
    if (offer?.troopTypeId === undefined) throw new Error('candidate missing');
    const atLimit = openAndPrepare(baseState({ troopCopies: { [offer.troopTypeId]: RECRUITMENT_COPY_LIMIT } }), recruitmentHandler, def);
    const choose = commitFlow(atLimit, recruitmentHandler, def, request(def.nodeId, 'CHOOSE', 'tx-rec-limit', offer.offerId));
    expect(choose.outcome.result.status).toBe('REJECTED');
    expect(choose.outcome.result.reason).toBe('COPY_LIMIT');
    expect(choose.state.recruits).toHaveLength(0);
  });

  it('counts run recruits against the copy limit together with profile copies', () => {
    // Determine the troop type of node A's first offer deterministically.
    const nodeA = definition('node-recruit-a', 'recruitment');
    const firstOffer = offersOf(openAndPrepare(baseState({ troopCopies: {} }), recruitmentHandler, nodeA), nodeA.nodeId)[0];
    if (firstOffer?.troopTypeId === undefined) throw new Error('candidate missing');
    const troopTypeId = firstOffer.troopTypeId;
    // Profile has 2 copies: one run recruit fills the limit (2 + 1 = 3).
    const withTwo = openAndPrepare(baseState({ troopCopies: { [troopTypeId]: 2 } }), recruitmentHandler, nodeA);
    const choose = commitFlow(withTwo, recruitmentHandler, nodeA, request(nodeA.nodeId, 'CHOOSE', 'tx-rec-count-a', firstOffer.offerId));
    expect(choose.outcome.result.status).toBe('COMMITTED');
    expect(choose.state.recruits).toContain(troopTypeId);
    // Find the first node id whose offer pool also shows the same troop type.
    let blocked: NodeCommitOutcome | null = null;
    for (let index = 0; index < 64 && blocked === null; index += 1) {
      const candidate = definition(`node-recruit-b-${String(index)}`, 'recruitment');
      const prepared = openAndPrepare(choose.state, recruitmentHandler, candidate);
      const offer = offersOf(prepared, candidate.nodeId)[0];
      if (offer?.troopTypeId === troopTypeId) {
        blocked = commitFlow(prepared, recruitmentHandler, candidate, request(candidate.nodeId, 'CHOOSE', 'tx-rec-count-b', offer.offerId)).outcome;
      }
    }
    if (blocked === null) throw new Error('no node with the same troop type found');
    expect(blocked.result.status).toBe('REJECTED');
    expect(blocked.result.reason).toBe('COPY_LIMIT');
  });

  it('rejects when gold is insufficient for a paid candidate', () => {
    const state = openAndPrepare(baseState({ gold: 0 }), recruitmentHandler, def);
    const offer = offersOf(state)[1];
    if (offer === undefined) throw new Error('candidate missing');
    const choose = commitFlow(state, recruitmentHandler, def, request(def.nodeId, 'CHOOSE', 'tx-rec-poor', offer.offerId));
    if (offer.priceGold > 0) {
      expect(choose.outcome.result.status).toBe('REJECTED');
      expect(choose.outcome.result.reason).toBe('INSUFFICIENT_GOLD');
    } else {
      expect(choose.outcome.result.status).toBe('COMMITTED');
    }
  });

  it('refuses unknown candidates as structural misuse', () => {
    const state = openAndPrepare(baseState(), recruitmentHandler, def);
    expect(() => commitFlow(state, recruitmentHandler, def, request(def.nodeId, 'CHOOSE', 'tx-rec-unknown', 'r-unknown'))).toThrow();
  });
});
