/**
 * Phase 21 §9 CEILING-ECONOMY ESCALATION × LEVER ROUND-TRIP SWEEP. The grid
 * (phase21-ceiling-economy-grid) pins ONE lever per blocked source; this pins
 * the ROUND-TRIP: at EVERY instability i (0..100), for EVERY lever (anchor −8
 * / merchant −10) and EVERY mid-stack placement (after 0, 1 or 2 committed
 * attempts), drive the REAL handlers through the REAL transaction service in
 * one continuous trajectory:
 *
 *   phase 1 (attempts 1..split) → LEVER mid-stack → phase 2 (continue) →
 *   final retreat.
 *
 * The clean-room oracle computes the EXACT same trajectory independently —
 * the escalation is by COMMITTED defeats (a ceiling-rejected attempt pays
 * nothing and does NOT advance the tax), the lever applies iff the instability
 * floor allows it, and the ceiling gate is `current + 5×(committed+1) ≤ 100`.
 * The real trajectory must equal the oracle at every step, the final
 * instability must never exceed the bound, and the gold fold
 * (`500 − 30 × committed services`) must hold — the round-trip is one
 * continuous run, not isolated pairs.
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
import { dispatchCommit } from '../../src/game/expedition/nodes/node-run-reducer.js';
import { createNodeRunState, openVisit } from '../../src/game/expedition/nodes/run-state.js';
import type { NodeDefinition, NodeRunState } from '../../src/game/expedition/nodes/types.js';

const anchorHandler = anchorStoryHandlers[0];
if (anchorHandler === undefined) throw new Error('anchor handler missing');

const SERVICE_GOLD = 30;

const DEF = (id: string, type: 'battle' | 'anchor' | 'merchant', payloadKey = ''): NodeDefinition =>
  Object.freeze({ nodeId: id, type, contentRevision: '32.0', payloadKey });

const BATTLE = DEF('n_battle', 'battle', 'e');
const ANCHOR = DEF('n_anchor', 'anchor');
const MERCHANT = DEF('n_merchant', 'merchant');

/** An open visit on every round-trip node at exactly `instability` (gold ample). */
function stateAt(instability: number): NodeRunState {
  let state = createNodeRunState({ runId: 'r', modeId: 'm', contentRevision: '32.0', seed: 1, mapHash: 'h', gold: 500 });
  state = openVisit(state, BATTLE.nodeId, 0);
  state = openVisit(state, ANCHOR.nodeId, 0);
  state = openVisit(state, MERCHANT.nodeId, 0);
  return { ...state, instability };
}

/** Commits the re-engage on the battle node through the full dispatch pipeline. */
function tryReengage(state: NodeRunState, loopK: number): { readonly status: 'COMMITTED' | 'REJECTED' | 'FAILED'; readonly state: NodeRunState } {
  const outcome = dispatchCommit(
    state,
    Object.freeze({ transactionId: `tx-rt-${String(loopK)}`, nodeId: BATTLE.nodeId, action: 'ENGAGE_DEFEAT' }),
    BATTLE, battleHandler,
  );
  return { status: outcome.result.status, state: outcome.state };
}

interface RoundLever {
  readonly name: string;
  readonly reduction: number;
  validate(state: NodeRunState): string | null;
  commit(state: NodeRunState): NodeRunState;
}

const LEVERS: readonly RoundLever[] = Object.freeze([
  {
    name: 'anchor',
    reduction: ANCHOR_SERVICE_INSTABILITY_REDUCTION,
    validate: (s) => anchorHandler.validate(ANCHOR, Object.freeze({ transactionId: 'tx-sa-rt', nodeId: ANCHOR.nodeId, action: 'SERVICE' }), s),
    commit: (s) => dispatchCommit(
      s,
      Object.freeze({ transactionId: 'tx-sa-rt', nodeId: ANCHOR.nodeId, action: 'SERVICE' }),
      ANCHOR, anchorHandler,
    ).state,
  },
  {
    name: 'merchant',
    reduction: MERCHANT_SERVICE_INSTABILITY_REDUCTION,
    validate: (s) => merchantHandler.validate(MERCHANT, Object.freeze({ transactionId: 'tx-sm-rt', nodeId: MERCHANT.nodeId, action: 'SERVICE' }), s),
    commit: (s) => dispatchCommit(
      s,
      Object.freeze({ transactionId: 'tx-sm-rt', nodeId: MERCHANT.nodeId, action: 'SERVICE' }),
      MERCHANT, merchantHandler,
    ).state,
  },
]);

/**
 * CLEAN-ROOM ORACLE — the trajectory a perfect implementation must produce.
 * Independent arithmetic: the escalation is by COMMITTED defeats, the lever
 * applies iff the floor allows, the ceiling gate is checked at every attempt.
 */
function oracle(
  start: number,
  lever: RoundLever,
  split: number,
): { readonly final: number; readonly committedAttempts: readonly number[]; readonly rejectedAttempts: readonly number[]; readonly leverApplied: boolean } {
  let current = start;
  let committed = 0;
  const committedAttempts: number[] = [];
  const rejectedAttempts: number[] = [];
  let leverApplied = false;
  for (let loopK = 1; loopK <= 3; loopK += 1) {
    if (loopK === split + 1) {
      if (current >= lever.reduction) {
        current -= lever.reduction;
        leverApplied = true;
      }
    }
    const tax = DEFEAT_INSTABILITY_DELTA * (committed + 1);
    if (current + tax <= INSTABILITY_CEILING) {
      current += tax;
      committed += 1;
      committedAttempts.push(loopK);
    } else {
      rejectedAttempts.push(loopK);
    }
  }
  return { final: current, committedAttempts, rejectedAttempts, leverApplied };
}

describe('P21 §9 ceiling-economy escalation × lever round-trip sweep (0..100)', () => {
  it('at every i × lever × mid-stack split the REAL round-trip trajectory equals the clean-room oracle, never passes the bound, and folds gold', () => {
    for (let i = 0; i <= 100; i += 1) {
      for (const lever of LEVERS) {
        for (let split = 0; split <= 2; split += 1) {
          // -- CLEAN ROOM --
          const expected = oracle(i, lever, split);

          // -- REAL (one continuous trajectory through the real handlers) --
          let state = stateAt(i);
          let servicesCommitted = 0;
          const realCommitted: number[] = [];
          const realRejected: number[] = [];
          for (let loopK = 1; loopK <= 3; loopK += 1) {
            if (loopK === split + 1) {
              const verdict = lever.validate(state);
              if (verdict === null) {
                state = lever.commit(state);
                servicesCommitted += 1;
              }
            }
            const outcome = tryReengage(state, loopK);
            if (outcome.status === 'COMMITTED') realCommitted.push(loopK);
            else realRejected.push(loopK);
            state = outcome.state;
          }
          // The round-trip is one continuous run: retreat stays legal after the
          // stack (a defeat stack never soft-locks), and the visit resolves.
          const decline = dispatchCommit(
            state,
            Object.freeze({ transactionId: 'tx-rt-d', nodeId: BATTLE.nodeId, action: 'DECLINE' }),
            BATTLE, battleHandler,
          );
          expect(decline.result.status, `decline after round-trip i=${String(i)} ${lever.name} split=${String(split)}`).toBe('COMMITTED');

          // The real trajectory matches the oracle EXACTLY (which attempts
          // committed / were ceiling-gated — the escalation by committed count).
          expect(realCommitted, `committed i=${String(i)} ${lever.name} split=${String(split)}`).toEqual(expected.committedAttempts);
          expect(realRejected, `rejected i=${String(i)} ${lever.name} split=${String(split)}`).toEqual(expected.rejectedAttempts);
          // The final instability equals the oracle and never passes the bound.
          expect(state.instability, `final i=${String(i)} ${lever.name} split=${String(split)}`).toBe(expected.final);
          expect(state.instability).toBeLessThanOrEqual(INSTABILITY_CEILING);
          // The gold fold: the ONLY gold movement is the service price, exactly
          // once per applied lever (the oracle knows whether the floor allowed
          // the lever at this split point).
          expect(servicesCommitted).toBe(expected.leverApplied ? 1 : 0);
          expect(state.gold).toBe(500 - SERVICE_GOLD * servicesCommitted);
        }
      }
    }
  });
});
