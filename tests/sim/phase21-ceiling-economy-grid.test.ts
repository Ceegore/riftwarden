/**
 * Phase 21 §9 CEILING-ECONOMY GRID — every bound-reaching SOURCE × every
 * recovery LEVER over the REAL handlers (through the REAL transaction
 * service) at every integer instability 0..100, as ONE sweep:
 *
 *   SOURCES (optional actions that may push instability past the bound):
 *     - ENGAGE_DEFEAT re-engage attempt k (the escalating tax 5×k; attempt k
 *       is the next one after k−1 committed defeats on the node);
 *     - altar ACCEPT (+10).
 *   LEVERS (optional actions that lower instability):
 *     - anchor SERVICE (−8, floor 8);
 *     - merchant SERVICE (−10, floor 10).
 *
 * At every instability value i: if the source is ceiling-blocked at i, each
 * legal lever must re-open it EXACTLY when (i − reduction) + sourceDelta
 * still fits under INSTABILITY_CEILING — and never otherwise. The grid is
 * exhaustive (i × source × lever), so a NEW source or lever cannot silently
 * miss the shared ceiling: the recovery is only ever the arithmetic of the
 * one constant every gate keys off.
 *
 * The exact-boundary tables below pin the recovery windows per pair:
 *
 *   re-engage k=1 (δ5):  blocked i ≥ 96  — anchor AND merchant always re-open
 *   re-engage k=2 (δ10): blocked i ≥ 91  — anchor re-opens ≤ 98, merchant always
 *   re-engage k=3 (δ15): blocked i ≥ 86  — anchor re-opens ≤ 93, merchant ≤ 95
 *   altar ACCEPT (δ10):  blocked i ≥ 91  — anchor re-opens ≤ 98, merchant always
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

const REENGAGE = Object.freeze({ transactionId: 'tx-re-grid', nodeId: BATTLE.nodeId, action: 'ENGAGE_DEFEAT' });
const ACCEPT_ALTAR = Object.freeze({ transactionId: 'tx-aa-grid', nodeId: ALTAR.nodeId, action: 'ACCEPT' });

/** An open visit on every swept node at exactly `instability` (gold ample). */
function stateAt(instability: number): NodeRunState {
  let state = createNodeRunState({ runId: 'r', modeId: 'm', contentRevision: '32.0', seed: 1, mapHash: 'h', gold: 500 });
  state = openVisit(state, BATTLE.nodeId, 0);
  state = openVisit(state, ANCHOR.nodeId, 0);
  state = openVisit(state, MERCHANT.nodeId, 0);
  state = openVisit(state, ALTAR.nodeId, 0);
  return { ...state, instability };
}

/**
 * A state whose CURRENT instability scalar is exactly `instability` and whose
 * battle node carries `priorDefeats` COMMITTED re-engage ledger records (the
 * next attempt is priorDefeats + 1) — the exact shape a live run has after n
 * defeats: visit COMMITTED, ledger with n committed ENGAGE_DEFEAT records,
 * and the scalar as the persisted authority the handlers gate on. The
 * escalation counting reads the ledger records; the ceiling gate reads the
 * scalar.
 */
function stateAtWithDefeats(instability: number, priorDefeats: number): NodeRunState {
  let state = stateAt(instability);
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

interface GridSource {
  readonly name: string;
  readonly priorDefeats: number;
  readonly delta: number;
  /** Full dispatch pipeline (prepare + validate + commit) — returns the verdict. */
  commit(state: NodeRunState): { readonly status: 'COMMITTED' | 'REJECTED' | 'FAILED'; readonly reason?: string; readonly state: NodeRunState };
}

interface GridLever {
  readonly name: string;
  readonly reduction: number;
  validate(state: NodeRunState): string | null;
  commit(state: NodeRunState): NodeRunState;
}

function tryReengage(state: NodeRunState): { readonly status: 'COMMITTED' | 'REJECTED' | 'FAILED'; readonly reason?: string; readonly state: NodeRunState } {
  const outcome = dispatchCommit(state, REENGAGE, BATTLE, battleHandler);
  return outcome.result.reason === undefined
    ? { status: outcome.result.status, state: outcome.state }
    : { status: outcome.result.status, reason: outcome.result.reason, state: outcome.state };
}

function tryAltarAccept(state: NodeRunState): { readonly status: 'COMMITTED' | 'REJECTED' | 'FAILED'; readonly reason?: string; readonly state: NodeRunState } {
  const outcome = dispatchCommit(state, ACCEPT_ALTAR, ALTAR, altarHandler);
  return outcome.result.reason === undefined
    ? { status: outcome.result.status, state: outcome.state }
    : { status: outcome.result.status, reason: outcome.result.reason, state: outcome.state };
}

const SOURCES: readonly GridSource[] = Object.freeze([
  { name: 're-1', priorDefeats: 0, delta: DEFEAT_INSTABILITY_DELTA, commit: tryReengage },
  { name: 're-2', priorDefeats: 1, delta: DEFEAT_INSTABILITY_DELTA * 2, commit: tryReengage },
  { name: 're-3', priorDefeats: 2, delta: DEFEAT_INSTABILITY_DELTA * 3, commit: tryReengage },
  { name: 'altar', priorDefeats: 0, delta: ALTAR_DOWNSIDE_INSTABILITY, commit: tryAltarAccept },
]);

const LEVERS: readonly GridLever[] = Object.freeze([
  {
    name: 'anchor',
    reduction: ANCHOR_SERVICE_INSTABILITY_REDUCTION,
    validate: (s) => anchorHandler.validate(ANCHOR, Object.freeze({ transactionId: 'tx-sa-grid', nodeId: ANCHOR.nodeId, action: 'SERVICE' }), s),
    commit: (s) => dispatchCommit(
      s,
      Object.freeze({ transactionId: 'tx-sa-grid', nodeId: ANCHOR.nodeId, action: 'SERVICE' }),
      ANCHOR, anchorHandler,
    ).state,
  },
  {
    name: 'merchant',
    reduction: MERCHANT_SERVICE_INSTABILITY_REDUCTION,
    validate: (s) => merchantHandler.validate(MERCHANT, Object.freeze({ transactionId: 'tx-sm-grid', nodeId: MERCHANT.nodeId, action: 'SERVICE' }), s),
    commit: (s) => dispatchCommit(
      s,
      Object.freeze({ transactionId: 'tx-sm-grid', nodeId: MERCHANT.nodeId, action: 'SERVICE' }),
      MERCHANT, merchantHandler,
    ).state,
  },
]);

/** Blocked at i, re-opened by the lever (i − reduction + delta ≤ 100). */
const REOPEN: Readonly<Record<string, readonly [number, number]>> = Object.freeze({
  're-1|anchor': [96, 100],
  're-1|merchant': [96, 100],
  're-2|anchor': [91, 98],
  're-2|merchant': [91, 100],
  're-3|anchor': [86, 93],
  're-3|merchant': [86, 95],
  'altar|anchor': [91, 98],
  'altar|merchant': [91, 100],
});

/** Blocked at i and STILL blocked after the lever. */
const STILL_BLOCKED: Readonly<Record<string, readonly [number, number]>> = Object.freeze({
  're-2|anchor': [99, 100],
  're-3|anchor': [94, 100],
  're-3|merchant': [96, 100],
  'altar|anchor': [99, 100],
});

describe('P21 §9 ceiling-economy source × lever grid (0..100)', () => {
  it('EXHAUSTIVE: at every i, every ceiling-blocked source is re-opened by every legal lever EXACTLY when the arithmetic fits under the shared ceiling', () => {
    for (let i = 0; i <= 100; i += 1) {
      for (const source of SOURCES) {
        for (const lever of LEVERS) {
          const before = stateAtWithDefeats(i, source.priorDefeats);
          const blockedAtI = source.commit(before).status === 'REJECTED';
          // Only the recovery case is interesting — a lever on an un-blocked
          // source must keep it legal (a lever can only help).
          const leverVerdict = lever.validate(before);
          if (leverVerdict !== null) continue; // floor-refused — pinned below
          const after = lever.commit(before);
          expect(after.instability).toBe(i - lever.reduction);
          const expected = after.instability + source.delta <= INSTABILITY_CEILING
            ? 'COMMITTED'
            : 'REJECTED';
          const verdict = source.commit(after);
          expect(
            verdict.status,
            `i=${String(i)} ${source.name} after ${lever.name}: ${expected}`,
          ).toBe(expected);
          if (!blockedAtI) {
            expect(source.commit(after).status, `a legal source stays legal after ${lever.name} at i=${String(i)}`).toBe('COMMITTED');
          }
        }
      }
    }
  });

  it('the exact recovery windows: blocked → lever re-opens in REOPEN, stays blocked in STILL_BLOCKED (boundary values pinned)', () => {
    const sourceByName: Readonly<Record<string, GridSource>> = Object.freeze(
      Object.fromEntries(SOURCES.map((s) => [s.name, s])) as Record<string, GridSource>,
    );
    const leverByName: Readonly<Record<string, GridLever>> = Object.freeze(
      Object.fromEntries(LEVERS.map((l) => [l.name, l])) as Record<string, GridLever>,
    );
    for (const [key, [lo, hi]] of Object.entries(REOPEN)) {
      const pair = key.split('|');
      const sourceName = pair[0];
      const leverName = pair[1];
      const source = sourceName === undefined ? undefined : sourceByName[sourceName];
      const lever = leverName === undefined ? undefined : leverByName[leverName];
      if (source === undefined || lever === undefined) throw new Error(`bad pair ${key}`);
      for (const i of [lo, hi]) {
        const before = stateAtWithDefeats(i, source.priorDefeats);
        expect(source.commit(before).status, `${key} blocked at i=${String(i)}`).toBe('REJECTED');
        const after = lever.commit(before);
        expect(source.commit(after).status, `${key} re-opened at i=${String(i)}`).toBe('COMMITTED');
      }
    }
    for (const [key, [lo, hi]] of Object.entries(STILL_BLOCKED)) {
      const pair = key.split('|');
      const sourceName = pair[0];
      const leverName = pair[1];
      const source = sourceName === undefined ? undefined : sourceByName[sourceName];
      const lever = leverName === undefined ? undefined : leverByName[leverName];
      if (source === undefined || lever === undefined) throw new Error(`bad pair ${key}`);
      for (const i of [lo, hi]) {
        const before = stateAtWithDefeats(i, source.priorDefeats);
        expect(source.commit(before).status, `${key} blocked at i=${String(i)}`).toBe('REJECTED');
        const after = lever.commit(before);
        expect(source.commit(after).status, `${key} STILL blocked at i=${String(i)}`).toBe('REJECTED');
      }
    }
  });

  it('the lever FLOOR is part of the grid: below its reduction the recovery is unavailable, so the source stays blocked with NO way down', () => {
    // Anchor SERVICE is refused below 8, merchant below 10 — the grid's floor
    // edge: at i < reduction the lever cannot re-open anything, and the source
    // (which is only ever blocked ≥ 86) simply cannot be recovered there.
    const anchorLever = LEVERS[0];
    const merchantLever = LEVERS[1];
    if (anchorLever === undefined || merchantLever === undefined) throw new Error('levers missing');
    for (let i = 0; i < ANCHOR_SERVICE_INSTABILITY_REDUCTION; i += 1) {
      expect(anchorLever.validate(stateAt(i))).toBe('OPTION_UNAVAILABLE');
    }
    for (let i = 0; i < MERCHANT_SERVICE_INSTABILITY_REDUCTION; i += 1) {
      expect(merchantLever.validate(stateAt(i))).toBe('OPTION_UNAVAILABLE');
    }
  });

  it('the shared ceiling is the single constant behind every gate in the grid (a drift in any one breaks the arithmetic above)', () => {
    expect(INSTABILITY_CEILING).toBe(100);
    expect(DEFEAT_INSTABILITY_DELTA).toBe(5);
    expect(ALTAR_DOWNSIDE_INSTABILITY).toBe(10);
    expect(ANCHOR_SERVICE_INSTABILITY_REDUCTION).toBe(8);
    expect(MERCHANT_SERVICE_INSTABILITY_REDUCTION).toBe(10);
  });
});
