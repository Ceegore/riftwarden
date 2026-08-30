/**
 * Phase 21 §9 instability FLOOR / CEILING SWEEP. Drives the REAL handlers
 * (combat / anchor / merchant / altar) across EVERY integer instability value
 * 0..100 and pins the exact boundaries:
 *
 *   FLOOR: instability is bounded below at 0 — negative deltas (the anchor /
 *   merchant rest services) are refused when the run cannot use the reduction
 *   (OPTION_UNAVAILABLE), never applied into negative territory.
 *
 *   CEILING: INSTABILITY_CEILING (100) is a VALIDATION bound, not a hard cap —
 *   every optional action that would push past it is refused up front (the
 *   altar's +10 downside, the escalating re-engage tax), while mandatory
 *   progression (battle ENTER) is never gated by it.
 *
 * The sweep is exhaustive over the whole legal range, so a boundary regression
 * at any single value is caught — not just the one-off cases unit tests pick.
 */
import { describe, expect, it } from 'vitest';
import { INSTABILITY_CEILING, DEFEAT_INSTABILITY_DELTA, battleHandler } from '../../src/game/expedition/nodes/handlers/combat.js';
import {
  ANCHOR_SERVICE_INSTABILITY_REDUCTION,
  anchorStoryHandlers,
} from '../../src/game/expedition/nodes/handlers/anchor.js';
import {
  MERCHANT_SERVICE_INSTABILITY_REDUCTION,
  merchantHandler,
} from '../../src/game/expedition/nodes/handlers/merchant.js';
import { ALTAR_DOWNSIDE_INSTABILITY, altarHandler } from '../../src/game/expedition/nodes/handlers/altar.js';
import { definitionOf } from '../../src/game/expedition/node-registry.js';
import { createNodeRunState, openVisit } from '../../src/game/expedition/nodes/run-state.js';
import type { NodeDefinition, NodeRunState } from '../../src/game/expedition/nodes/types.js';

const anchorHandler = anchorStoryHandlers[0];
if (anchorHandler === undefined) throw new Error('anchor handler missing');

const DEF = (id: string, type: 'battle' | 'anchor' | 'merchant' | 'altar', payloadKey = ''): NodeDefinition =>
  Object.freeze({ nodeId: id, type, contentRevision: '32.0', payloadKey });

const BATTLE = DEF('n_battle', 'battle', 'e');
const ANCHOR = DEF('n_anchor', 'anchor');
const MERCHANT = DEF('n_merchant', 'merchant');
const ALTAR = DEF('n_altar', 'altar', 'relic_ash_crown');

const ENTER = Object.freeze({ transactionId: 'tx-enter', nodeId: BATTLE.nodeId, action: 'ENTER' });
const REENGAGE = Object.freeze({ transactionId: 'tx-re', nodeId: BATTLE.nodeId, action: 'ENGAGE_DEFEAT' });
const SERVICE_ANCHOR = Object.freeze({ transactionId: 'tx-sa', nodeId: ANCHOR.nodeId, action: 'SERVICE' });
const SERVICE_MERCHANT = Object.freeze({ transactionId: 'tx-sm', nodeId: MERCHANT.nodeId, action: 'SERVICE' });
const ACCEPT_ALTAR = Object.freeze({ transactionId: 'tx-aa', nodeId: ALTAR.nodeId, action: 'ACCEPT' });

/** An open visit on every swept node at exactly `instability` (gold ample). */
function stateAt(instability: number): NodeRunState {
  let state = createNodeRunState({ runId: 'r', modeId: 'm', contentRevision: '32.0', seed: 1, mapHash: 'h', gold: 500 });
  state = openVisit(state, BATTLE.nodeId, 0);
  state = openVisit(state, ANCHOR.nodeId, 0);
  state = openVisit(state, MERCHANT.nodeId, 0);
  state = openVisit(state, ALTAR.nodeId, 0);
  return { ...state, instability };
}

describe('P21 §9 instability floor/ceiling sweep (0..100)', () => {
  it('battle ENTER is legal at every instability and applies the registry delta unclamped (validation bound, not a cap)', () => {
    const enterDelta = definitionOf('battle').defaultInstabilityDelta;
    expect(enterDelta).toBeGreaterThan(0);
    for (let i = 0; i <= 100; i += 1) {
      const before = stateAt(i);
      // Mandatory progression is never gated by the ceiling.
      expect(battleHandler.validate(BATTLE, ENTER, before)).toBeNull();
      const after = battleHandler.commit(BATTLE, ENTER, before).state;
      expect(after.instability).toBe(i + enterDelta);
      // The positive delta never clamps downward, even at the ceiling.
      expect(after.instability).toBeGreaterThanOrEqual(i);
    }
  });

  it('a fresh re-engage is legal iff i + 5 <= INSTABILITY_CEILING (blocked exactly at 96+)', () => {
    for (let i = 0; i <= 100; i += 1) {
      const verdict = battleHandler.validate(BATTLE, REENGAGE, stateAt(i));
      const expected = i + DEFEAT_INSTABILITY_DELTA <= INSTABILITY_CEILING ? null : 'OPTION_UNAVAILABLE';
      expect(verdict).toBe(expected);
    }
  });

  it('anchor SERVICE is legal iff i >= 8 and lands exactly at i - 8 (floor: never negative)', () => {
    for (let i = 0; i <= 100; i += 1) {
      const before = stateAt(i);
      const verdict = anchorHandler.validate(ANCHOR, SERVICE_ANCHOR, before);
      expect(verdict).toBe(i >= ANCHOR_SERVICE_INSTABILITY_REDUCTION ? null : 'OPTION_UNAVAILABLE');
      if (verdict === null) {
        const after = anchorHandler.commit(ANCHOR, SERVICE_ANCHOR, before).state;
        expect(after.instability).toBe(i - ANCHOR_SERVICE_INSTABILITY_REDUCTION);
        expect(after.instability).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('merchant SERVICE (reduction 10) is legal iff i >= 10 and lands exactly at i - 10', () => {
    for (let i = 0; i <= 100; i += 1) {
      const before = stateAt(i);
      const verdict = merchantHandler.validate(MERCHANT, SERVICE_MERCHANT, before);
      expect(verdict).toBe(i >= MERCHANT_SERVICE_INSTABILITY_REDUCTION ? null : 'OPTION_UNAVAILABLE');
      if (verdict === null) {
        const after = merchantHandler.commit(MERCHANT, SERVICE_MERCHANT, before).state;
        expect(after.instability).toBe(i - MERCHANT_SERVICE_INSTABILITY_REDUCTION);
        expect(after.instability).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('altar ACCEPT is legal iff i + 10 <= INSTABILITY_CEILING (blocked exactly at 91+)', () => {
    for (let i = 0; i <= 100; i += 1) {
      const before = stateAt(i);
      const verdict = altarHandler.validate(ALTAR, ACCEPT_ALTAR, before);
      expect(verdict).toBe(i + ALTAR_DOWNSIDE_INSTABILITY <= INSTABILITY_CEILING ? null : 'OPTION_UNAVAILABLE');
      if (verdict === null) {
        const after = altarHandler.commit(ALTAR, ACCEPT_ALTAR, before).state;
        expect(after.instability).toBe(i + ALTAR_DOWNSIDE_INSTABILITY);
        expect(after.instability).toBeLessThanOrEqual(INSTABILITY_CEILING);
      }
    }
  });

  it('the shared ceiling constant is the single bound behind every gate', () => {
    // The altar + re-engage gates both key off the SAME constant — the sweep
    // above would catch a drift, but pin the shared identity explicitly too.
    expect(INSTABILITY_CEILING).toBe(100);
    expect(ALTAR_DOWNSIDE_INSTABILITY).toBe(10);
    expect(DEFEAT_INSTABILITY_DELTA).toBe(5);
    expect(ANCHOR_SERVICE_INSTABILITY_REDUCTION).toBe(8);
    expect(MERCHANT_SERVICE_INSTABILITY_REDUCTION).toBe(10);
  });
});
