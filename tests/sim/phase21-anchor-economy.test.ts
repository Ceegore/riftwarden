/**
 * Phase 21 §9 instability-ceiling × anchor/rest economy. A combat node blocked
 * at the instability ceiling (instability + next escalating re-engage tax > 100)
 * must be recoverable by the expedition's rest economy: an anchor SERVICE
 * reduces instability by ANCHOR_SERVICE_INSTABILITY_REDUCTION (at a gold cost),
 * which re-opens the re-engage affordance on the next combat node. The test
 * drives the REAL anchor + combat handlers on the SAME NodeRunState so the
 * ceiling gate and the service command path are proven to compose.
 */
import { describe, expect, it } from 'vitest';
import { battleHandler } from '../../src/game/expedition/nodes/handlers/combat.js';
import {
  ANCHOR_SERVICE_COST_GOLD,
  ANCHOR_SERVICE_INSTABILITY_REDUCTION,
  anchorStoryHandlers,
} from '../../src/game/expedition/nodes/handlers/anchor.js';
import { createNodeRunState, openVisit } from '../../src/game/expedition/nodes/run-state.js';
import type { NodeDefinition, NodeRunState } from '../../src/game/expedition/nodes/types.js';

const anchorHandler = anchorStoryHandlers[0];
if (anchorHandler === undefined) throw new Error('anchor handler missing');

const ANCHOR_DEF: NodeDefinition = Object.freeze({ nodeId: 'n_anchor', type: 'anchor', contentRevision: '32.0', payloadKey: '' });
const COMBAT_DEF: NodeDefinition = Object.freeze({ nodeId: 'n_combat', type: 'battle', contentRevision: '32.0', payloadKey: 'e' });

/** A persisted run state with an OPEN anchor visit AND an OPEN combat visit at a given instability. */
function baseState(instability: number, gold = 500): NodeRunState {
  let state = openVisit(createNodeRunState({ runId: 'r1', modeId: 'm', contentRevision: '32.0', seed: 1, mapHash: 'h', gold }), 'n_anchor', 0);
  state = openVisit(state, 'n_combat', 0);
  return { ...state, instability };
}

const reengage = (state: NodeRunState): string | null =>
  battleHandler.validate(COMBAT_DEF, Object.freeze({ transactionId: 'tx-re', nodeId: 'n_combat', action: 'ENGAGE_DEFEAT' }), state);
const service = (state: NodeRunState): string | null =>
  anchorHandler.validate(ANCHOR_DEF, Object.freeze({ transactionId: 'tx-service', nodeId: 'n_anchor', action: 'SERVICE' }), state);

describe('P21 §9 instability ceiling × anchor/rest economy', () => {
  it('a ceiling-blocked re-engage becomes available again after an anchor service', () => {
    // instability 96: the next re-engage tax (+5) would hit 101 > 100 → blocked.
    const blocked = baseState(96);
    expect(reengage(blocked)).toBe('OPTION_UNAVAILABLE');
    // The anchor SERVICE is legal and costs gold + reduces instability by 8.
    expect(service(blocked)).toBeNull();
    const after = anchorHandler.commit(
      ANCHOR_DEF,
      Object.freeze({ transactionId: 'tx-service', nodeId: 'n_anchor', action: 'SERVICE' }),
      blocked,
    ).state;
    expect(after.instability).toBe(88);
    expect(after.gold).toBe(500 - ANCHOR_SERVICE_COST_GOLD);
    // Headroom restored: 88 + 5 = 93 ≤ 100 → re-engage is accepted again.
    expect(reengage(after)).toBeNull();
  });

  it('an anchor service reduces instability through the exact contract deltas', () => {
    const before = baseState(50);
    const after = anchorHandler.commit(
      ANCHOR_DEF,
      Object.freeze({ transactionId: 'tx-s', nodeId: 'n_anchor', action: 'SERVICE' }),
      before,
    ).state;
    expect(after.instability).toBe(50 - ANCHOR_SERVICE_INSTABILITY_REDUCTION);
    expect(after.gold).toBe(500 - ANCHOR_SERVICE_COST_GOLD);
  });

  it('an anchor service refuses when the run cannot use the reduction (floor rule)', () => {
    // instability 5 < 8: reducing would push below zero, so it is refused
    // (OPTION_UNAVAILABLE) instead of crashing with NEGATIVE_RESOURCE.
    expect(service(baseState(5))).toBe('OPTION_UNAVAILABLE');
  });

  it('an anchor service refuses when the run cannot afford it', () => {
    expect(service(baseState(50, ANCHOR_SERVICE_COST_GOLD - 1))).toBe('INSUFFICIENT_GOLD');
  });
});
