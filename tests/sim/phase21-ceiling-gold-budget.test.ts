/**
 * Phase 21 §9 CEILING-ECONOMY GOLD-SIDE BUDGET. The grid pins the INSTABILITY
 * arithmetic of the recovery; this pins the GOLD side of the same economy over
 * the REAL handlers through the REAL transaction service:
 *
 *   PRICE IDENTITY — the anchor and merchant services share ONE flat price
 *   (`MERCHANT_SERVICE_PRICE_GOLD = 30`; anchor aliases it), so the recovery
 *   never costs more than the source's own tax did in gold (the tax is 0 —
 *   defeats pay no gold, the re-engage stack is FREE);
 *   BUDGET FLOOR — `INSUFFICIENT_GOLD` gates the lever SEPARATELY from the
 *   instability floor: at gold < 30 the lever is refused at EVERY instability,
 *   even where the instability floor would allow it;
 *   EXACT-30 — at gold == 30 exactly the lever commits and gold lands at
 *   EXACTLY 0 (never negative) while instability drops by the reduction;
 *   CHEAPEST RECOVERY — for every ceiling-blocked source at every i, ONE
 *   service (exactly 30 gold) is sufficient to re-open it exactly when the
 *   arithmetic fits — the gold cost of recovery is FLAT, never scaled by the
 *   source or the depth of the block;
 *   STACK GOLD — the max-stack re-engage budget (3 attempts) costs ZERO gold:
 *   the full stack leaves gold byte-identical, so the worst-case gold spent on
 *   a combat node is exactly the single recovery service (30), nothing more.
 */
import { describe, expect, it } from 'vitest';
import { INSTABILITY_CEILING, DEFEAT_INSTABILITY_DELTA, battleHandler } from '../../src/game/expedition/nodes/handlers/combat.js';
import {
  ANCHOR_SERVICE_INSTABILITY_REDUCTION,
  ANCHOR_SERVICE_COST_GOLD,
  anchorStoryHandlers,
} from '../../src/game/expedition/nodes/handlers/anchor.js';
import {
  MERCHANT_SERVICE_INSTABILITY_REDUCTION,
  merchantHandler,
} from '../../src/game/expedition/nodes/handlers/merchant.js';
import { MERCHANT_SERVICE_PRICE_GOLD } from '../../src/game/expedition/offers/offer-service.js';
import { ALTAR_DOWNSIDE_INSTABILITY, altarHandler } from '../../src/game/expedition/nodes/handlers/altar.js';
import { dispatchCommit } from '../../src/game/expedition/nodes/node-run-reducer.js';
import { createNodeRunState, openVisit } from '../../src/game/expedition/nodes/run-state.js';
import type { NodeDefinition, NodeRunState, TransactionRecord } from '../../src/game/expedition/nodes/types.js';

const anchorHandler = anchorStoryHandlers[0];
if (anchorHandler === undefined) throw new Error('anchor handler missing');

const DEF = (id: string, type: 'battle' | 'anchor' | 'merchant' | 'altar', payloadKey = ''): NodeDefinition =>
  Object.freeze({ nodeId: id, type, contentRevision: '32.0', payloadKey });

const BATTLE = DEF('n_battle', 'battle', 'e');
const ANCHOR = DEF('n_anchor', 'anchor');
const MERCHANT = DEF('n_merchant', 'merchant');
const ALTAR = DEF('n_altar', 'altar', 'relic_ash_crown');

const REENGAGE = Object.freeze({ transactionId: 'tx-re-gold', nodeId: BATTLE.nodeId, action: 'ENGAGE_DEFEAT' });
const ACCEPT_ALTAR = Object.freeze({ transactionId: 'tx-aa-gold', nodeId: ALTAR.nodeId, action: 'ACCEPT' });

/** An open visit on every swept node at exactly `instability` and `gold`. */
function stateAt(instability: number, gold: number): NodeRunState {
  let state = createNodeRunState({ runId: 'r', modeId: 'm', contentRevision: '32.0', seed: 1, mapHash: 'h', gold });
  state = openVisit(state, BATTLE.nodeId, 0);
  state = openVisit(state, ANCHOR.nodeId, 0);
  state = openVisit(state, MERCHANT.nodeId, 0);
  state = openVisit(state, ALTAR.nodeId, 0);
  return { ...state, instability };
}

/** A state with `priorDefeats` COMMITTED re-engage records on the battle node
 * (the next attempt is priorDefeats + 1) — the exact live-run shape. */
function stateAtWithDefeats(instability: number, priorDefeats: number, gold: number): NodeRunState {
  let state = stateAt(instability, gold);
  if (priorDefeats > 0) {
    const ledger: Record<string, TransactionRecord> = {};
    for (let m = 1; m <= priorDefeats; m += 1) {
      ledger[`tx-prior-${String(m)}`] = {
        transactionId: `tx-prior-${String(m)}`,
        nodeId: BATTLE.nodeId,
        action: 'ENGAGE_DEFEAT',
        status: 'COMMITTED',
        outcomeIds: [],
      };
    }
    state = {
      ...state,
      ledger: { ...state.ledger, ...ledger },
      visits: {
        ...state.visits,
        [BATTLE.nodeId]: {
          nodeId: BATTLE.nodeId,
          status: 'COMMITTED',
          previewRevision: 0,
          transactionId: `tx-prior-${String(priorDefeats)}`,
        },
      },
    };
  }
  return state;
}

interface GoldSource {
  readonly name: string;
  readonly priorDefeats: number;
  readonly delta: number;
  commit(state: NodeRunState): { readonly status: 'COMMITTED' | 'REJECTED' | 'FAILED'; readonly reason?: string };
}

interface GoldLever {
  readonly name: string;
  readonly reduction: number;
  validate(state: NodeRunState): string | null;
  commit(state: NodeRunState): NodeRunState;
}

function tryReengage(state: NodeRunState): { readonly status: 'COMMITTED' | 'REJECTED' | 'FAILED'; readonly reason?: string } {
  const outcome = dispatchCommit(state, REENGAGE, BATTLE, battleHandler);
  return outcome.result.reason === undefined
    ? { status: outcome.result.status }
    : { status: outcome.result.status, reason: outcome.result.reason };
}

function tryAltarAccept(state: NodeRunState): { readonly status: 'COMMITTED' | 'REJECTED' | 'FAILED'; readonly reason?: string } {
  const outcome = dispatchCommit(state, ACCEPT_ALTAR, ALTAR, altarHandler);
  return outcome.result.reason === undefined
    ? { status: outcome.result.status }
    : { status: outcome.result.status, reason: outcome.result.reason };
}

const SOURCES: readonly GoldSource[] = Object.freeze([
  { name: 're-1', priorDefeats: 0, delta: DEFEAT_INSTABILITY_DELTA, commit: tryReengage },
  { name: 're-2', priorDefeats: 1, delta: DEFEAT_INSTABILITY_DELTA * 2, commit: tryReengage },
  { name: 're-3', priorDefeats: 2, delta: DEFEAT_INSTABILITY_DELTA * 3, commit: tryReengage },
  { name: 'altar', priorDefeats: 0, delta: ALTAR_DOWNSIDE_INSTABILITY, commit: tryAltarAccept },
]);

const LEVERS: readonly GoldLever[] = Object.freeze([
  {
    name: 'anchor',
    reduction: ANCHOR_SERVICE_INSTABILITY_REDUCTION,
    validate: (s) => anchorHandler.validate(ANCHOR, Object.freeze({ transactionId: 'tx-sa-gold', nodeId: ANCHOR.nodeId, action: 'SERVICE' }), s),
    commit: (s) => dispatchCommit(
      s,
      Object.freeze({ transactionId: 'tx-sa-gold', nodeId: ANCHOR.nodeId, action: 'SERVICE' }),
      ANCHOR, anchorHandler,
    ).state,
  },
  {
    name: 'merchant',
    reduction: MERCHANT_SERVICE_INSTABILITY_REDUCTION,
    validate: (s) => merchantHandler.validate(MERCHANT, Object.freeze({ transactionId: 'tx-sm-gold', nodeId: MERCHANT.nodeId, action: 'SERVICE' }), s),
    commit: (s) => dispatchCommit(
      s,
      Object.freeze({ transactionId: 'tx-sm-gold', nodeId: MERCHANT.nodeId, action: 'SERVICE' }),
      MERCHANT, merchantHandler,
    ).state,
  },
]);

describe('P21 §9 ceiling-economy gold-side budget (0..100)', () => {
  it('the price is FLAT and SHARED: one service costs exactly 30 gold on both levers (anchor aliases the merchant price)', () => {
    expect(MERCHANT_SERVICE_PRICE_GOLD).toBe(30);
    expect(ANCHOR_SERVICE_COST_GOLD).toBe(30);
    expect(ANCHOR_SERVICE_COST_GOLD).toBe(MERCHANT_SERVICE_PRICE_GOLD);
  });

  it('the BUDGET floor: at gold < 30 the lever is REFUSED (INSUFFICIENT_GOLD) at EVERY instability — a separate gate from the instability floor', () => {
    for (let i = 0; i <= 100; i += 1) {
      for (const lever of LEVERS) {
        const verdict = lever.validate(stateAt(i, MERCHANT_SERVICE_PRICE_GOLD - 1));
        // The gold check runs FIRST in both handlers: even where the
        // instability floor would allow (i >= reduction), the budget binds.
        expect(verdict, `i=${String(i)} ${lever.name}`).toBe('INSUFFICIENT_GOLD');
        // And nothing moved: no commit happened.
      }
    }
  });

  it('at EXACTLY 30 gold the lever commits and gold lands at EXACTLY 0 (never negative) while instability drops by the reduction', () => {
    for (let i = 0; i <= 100; i += 1) {
      for (const lever of LEVERS) {
        const before = stateAt(i, MERCHANT_SERVICE_PRICE_GOLD);
        const verdict = lever.validate(before);
        const expected = i >= lever.reduction ? null : 'OPTION_UNAVAILABLE';
        expect(verdict, `i=${String(i)} ${lever.name}`).toBe(expected);
        if (verdict === null) {
          const after = lever.commit(before);
          expect(after.gold, `i=${String(i)} ${lever.name} gold`).toBe(0);
          expect(after.instability).toBe(i - lever.reduction);
        }
      }
    }
  });

  it('the CHEAPEST recovery: for every ceiling-blocked source at every i, ONE service (exactly 30 gold) re-opens it exactly when the arithmetic fits — never more', () => {
    for (let i = 0; i <= 100; i += 1) {
      for (const source of SOURCES) {
        for (const lever of LEVERS) {
          const blockedAtI = source.commit(stateAtWithDefeats(i, source.priorDefeats, 500)).status === 'REJECTED';
          if (!blockedAtI) continue;
          // The recovery is exactly ONE service at the flat price: with exactly
          // 30 gold the lever commits, lands at 0, and re-opens the source iff
          // (i − reduction) + delta fits under the shared ceiling.
          const before = stateAtWithDefeats(i, source.priorDefeats, MERCHANT_SERVICE_PRICE_GOLD);
          const verdict = lever.validate(before);
          // In the blocked zone (i ≥ 86 for re-3, i ≥ 91 for re-2/altar, i ≥ 96
          // for re-1) the instability floor always allows the lever.
          expect(verdict, `i=${String(i)} ${source.name} ${lever.name}`).toBeNull();
          const after = lever.commit(before);
          expect(after.gold).toBe(0);
          const expected = (i - lever.reduction) + source.delta <= INSTABILITY_CEILING
            ? 'COMMITTED'
            : 'REJECTED';
          const reopened = source.commit(after).status;
          expect(reopened, `i=${String(i)} ${source.name} after one ${lever.name} service`).toBe(expected);
        }
      }
    }
  });

  it('the STACK is FREE: the max-stack re-engage budget (3 attempts) costs ZERO gold — the worst-case gold on a combat node is the single recovery service', () => {
    // The full escalating stack (5+10+15 instability) on a fresh node at i.
    const i = 40;
    let state = stateAtWithDefeats(i, 0, 200);
    const goldBefore = state.gold;
    let attempts = 0;
    for (let k = 1; k <= 3; k += 1) {
      const outcome = dispatchCommit(
        state,
        Object.freeze({ transactionId: `tx-stack-${String(k)}`, nodeId: BATTLE.nodeId, action: 'ENGAGE_DEFEAT' }),
        BATTLE, battleHandler,
      );
      if (outcome.result.status !== 'COMMITTED') break;
      attempts += 1;
      state = outcome.state;
    }
    expect(attempts).toBe(3);
    expect(state.instability).toBe(i + 5 + 10 + 15);
    // The whole stack moved ZERO gold.
    expect(state.gold).toBe(goldBefore);
    // The worst-case gold outflow on the node is then the single recovery
    // service: exactly 30, landing at gold − 30 (never more).
    const merchant = LEVERS.find((l) => l.name === 'merchant');
    if (merchant === undefined) throw new Error('merchant lever missing');
    const after = merchant.commit(state); // merchant −10 (the deeper lever)
    expect(after.gold).toBe(goldBefore - 30);
    expect(after.instability).toBe(i + 5 + 10 + 15 - 10);
  });
});
