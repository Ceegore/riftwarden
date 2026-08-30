/**
 * Phase 21 §9 FULL-RUN INSTABILITY LEDGER DIFFERENTIAL. Drives the REAL
 * expedition runner across entire maps with a deterministic policy and
 * compares the runner's live `state.instability` against a CLEAN-ROOM oracle
 * at EVERY step.
 *
 * The oracle never reads the handler code — it is an independent hardcoded
 * spec of how each COMMITTED ledger action moves instability:
 *
 *   ENTER           → the registry default per node type (battle +5, elite
 *                     +12, altar +8, anchor −10 floor-clamped at 0, …);
 *   ENGAGE_DEFEAT   → the ESCALATING defeat tax: attempt k on a node costs
 *                     5×k (5, 10, 15, …), counted over prior defeats there;
 *   ACCEPT (altar)  → +10;
 *   SERVICE         → merchant −10, anchor −8;
 *   everything else → 0.
 *
 * The fold is `instability = max(0, instability + delta)` — the floor clamp is
 * the ONLY nonlinearity (handlers refuse deltas that would cross it, so a
 * committed action never makes the runner throw NEGATIVE_RESOURCE). REJECTED
 * records are skipped (they never move instability). The ceiling (100) is a
 * VALIDATION bound, not a cap — mandatory ENTER may exceed it, so the oracle
 * asserts equality (which itself proves every committed optional action kept
 * the run under the bound the handlers enforce).
 *
 * Because the oracle and the handlers are written independently, any drift in
 * the instability contract (a new action that moves instability, a changed
 * registry delta, a changed escalation curve, a lost clamp) fails here.
 */
import { describe, expect, it } from 'vitest';
import { generateMap } from '../../src/game/expedition/map-generator.js';
import type { ExpeditionMap, MapProfile } from '../../src/game/expedition/types.js';
import { createExpedition } from '../../src/game/expedition/expedition-runner.js';
import { fnv1a32 } from '../../src/game/expedition/stable.js';
import { commitNodeAction } from '../../src/game/expedition/nodes/node-transaction.js';
import { anchorStoryHandlers } from '../../src/game/expedition/nodes/handlers/anchor.js';
import { createNodeRunState, openVisit } from '../../src/game/expedition/nodes/run-state.js';
import { INSTABILITY_CEILING } from '../../src/game/expedition/nodes/handlers/combat.js';
import type { NodeActionRequest, NodeDefinition, TransactionRecord } from '../../src/game/expedition/nodes/types.js';

const PROFILE: MapProfile = {
  id: 'exp-ledger-diff.v1',
  logicalLevels: 6,
  targetVisited: [5, 8] as const,
  mandatoryRoles: ['anchor', 'preparation', 'boss'],
  attemptCap: 50,
  fallbackTemplateId: 'fallback.v1',
};

function mapFor(seed: number): ExpeditionMap {
  return generateMap({ seed, profileId: 'exp-ledger-diff.v1', contentRevision: '32.0' }, PROFILE);
}

// ---------------------------------------------------------------------------
// CLEAN-ROOM ORACLE (independent spec — never imports the handler modules).
// ---------------------------------------------------------------------------

/** Hardcoded registry defaults — the INDEPENDENT truth the oracle folds. */
const ENTER_DELTA_BY_TYPE: Readonly<Record<string, number>> = Object.freeze({
  battle: 5,
  elite: 12,
  boss: 0,
  event: 3,
  merchant: 3,
  recruitment: 4,
  treasure: 5,
  workshop: 2,
  altar: 8,
  scout: 2,
  anchor: -10,
  story: 0,
});

const DEFEAT_TAX_BASE = 5; // attempt k costs 5×k
const ALTAR_ACCEPT_DELTA = 10;
const SERVICE_DELTA_BY_TYPE: Readonly<Record<string, number>> = Object.freeze({
  merchant: -10,
  anchor: -8,
});

function typeOf(map: ExpeditionMap, nodeId: string): string {
  const node = map.nodes.find((candidate) => candidate.id === nodeId);
  return node?.type ?? 'story';
}

/** Folds the committed ledger into the instability the run SHOULD have. */
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
      delta = DEFEAT_TAX_BASE * attempt;
    } else if (entry.action === 'ACCEPT' && type === 'altar') {
      delta = ALTAR_ACCEPT_DELTA;
    } else if (entry.action === 'SERVICE') {
      delta = SERVICE_DELTA_BY_TYPE[type] ?? 0;
    }
    // The floor is the ONLY nonlinearity — identical to the runner's clamp.
    instability = Math.max(0, instability + delta);
  }
  return instability;
}

// ---------------------------------------------------------------------------
// DETERMINISTIC WALK POLICY (drives the real runner across the whole map).
// ---------------------------------------------------------------------------

function policyAction(
  runSeed: number,
  nodeId: string,
  type: string,
  gold: number,
  instability: number,
  txId: string,
): NodeActionRequest {
  const h = fnv1a32([String(runSeed), nodeId]);
  const base = { transactionId: txId, nodeId };
  if (type === 'battle' || type === 'elite' || type === 'boss') {
    // ~1/3 of fights lost → escalating defeat taxes; the rest victory ENGAGE.
    return h % 3 === 0
      ? { ...base, action: 'ENGAGE_DEFEAT' }
      : { ...base, action: 'ENGAGE' };
  }
  if (type === 'merchant') {
    return gold >= 30 && instability >= 10
      ? { ...base, action: 'SERVICE' }
      : { ...base, action: 'DECLINE' };
  }
  if (type === 'anchor') {
    return gold >= 30 && instability >= 8
      ? { ...base, action: 'SERVICE' }
      : { ...base, action: 'SECURE' };
  }
  if (type === 'altar') {
    return instability + ALTAR_ACCEPT_DELTA <= INSTABILITY_CEILING
      ? { ...base, action: 'ACCEPT' }
      : { ...base, action: 'DECLINE' };
  }
  if (type === 'treasure') return { ...base, action: 'TAKE' };
  if (type === 'story') return { ...base, action: 'CONTINUE' };
  if (type === 'scout') return { ...base, action: 'REVEAL_PATH' };
  if (type === 'workshop') {
    return gold >= 220 ? { ...base, action: 'POLISH' } : { ...base, action: 'DECLINE' };
  }
  // event / recruitment / anything else: decline.
  return { ...base, action: 'DECLINE' };
}

/** Walks one full map and returns { finalInstability, committed action counts }. */
function walkRun(seed: number): { readonly finalInstability: number; readonly committed: Readonly<Record<string, number>> } {
  let exp = createExpedition(mapFor(seed), { startGold: 200 });
  const committed: Record<string, number> = {};
  let step = 0;
  let guard = 0;
  while (exp.reachableNodes.length > 0 && guard < 300) {
    const type = exp.definition.type;
    const nodeId = exp.currentNodeId;
    exp = exp.enter(`tx-${String(seed)}-e-${String(step)}`);
    // §9 differential at every step: the runner's instability MUST equal the
    // clean-room fold of the ledger so far.
    expect(exp.state.instability).toBe(foldInstability(exp.map, exp.state.ledger));
    const action = policyAction(seed, nodeId, type, exp.state.gold, exp.state.instability, `tx-${String(seed)}-a-${String(step)}`);
    exp = exp.act(action);
    const record = exp.state.ledger[action.transactionId];
    if (record?.status === 'COMMITTED') {
      committed[record.action] = (committed[record.action] ?? 0) + 1;
    }
    expect(exp.state.instability).toBe(foldInstability(exp.map, exp.state.ledger));
    // A lost fight keeps the node COMMITTED — a retreat (DECLINE) clears it
    // before resolve/advance (the verdict contract).
    if ((type === 'battle' || type === 'elite' || type === 'boss') && action.action === 'ENGAGE_DEFEAT') {
      exp = exp.act({ transactionId: `tx-${String(seed)}-d-${String(step)}`, nodeId, action: 'DECLINE' });
      expect(exp.state.instability).toBe(foldInstability(exp.map, exp.state.ledger));
    }
    exp = exp.resolve();
    const next = exp.reachableNodes[0];
    if (next === undefined) break;
    exp = exp.advance(next);
    step += 1;
    guard += 1;
  }
  return { finalInstability: exp.state.instability, committed };
}

describe('P21 §9 full-run instability ledger differential (clean-room oracle)', () => {
  it('the runner instability equals the clean-room fold on every step of every seed', () => {
    // Deterministic: the policy + map generation are seeded, so the exact
    // walks (and their action mixes) are pinned forever.
    for (const seed of [101, 102, 103, 104, 105, 106]) {
      const result = walkRun(seed);
      // The differential was already asserted at EVERY step inside walkRun.
      expect(result.finalInstability).toBeGreaterThanOrEqual(0);
    }
  });

  it('the walks actually exercise the escalating defeat tax, the rest services and the altar downside', () => {
    // Coverage guard: the differential is only meaningful if the oracle's
    // interesting deltas fired at least once across the deterministic walks.
    let defeats = 0;
    let services = 0;
    let accepts = 0;
    for (const seed of [101, 102, 103, 104, 105, 106]) {
      const committed = walkRun(seed).committed;
      defeats += committed['ENGAGE_DEFEAT'] ?? 0;
      services += committed['SERVICE'] ?? 0;
      accepts += committed['ACCEPT'] ?? 0;
    }
    expect(defeats).toBeGreaterThan(0);
    expect(services).toBeGreaterThan(0);
    expect(accepts).toBeGreaterThan(0);
  });

  it('the fold honors the floor clamp exactly as the transaction service does (anchor enter at low instability)', () => {
    // A dedicated anchor-at-the-floor case through the REAL transaction
    // service (commitNodeAction writes the ledger record): entering the anchor
    // at instability 4 applies the −10 enter delta but lands at 0 (floor),
    // never negative — and the oracle's max(0, ·) fold reproduces it
    // byte-for-byte. The handler pre-clamps the command to −4 while the
    // oracle clamps the accumulated value; both land at the same 0, which is
    // exactly the identity the differential must hold.
    const anchorHandler = anchorStoryHandlers[0];
    if (anchorHandler === undefined) throw new Error('anchor handler missing');
    const ANCHOR: NodeDefinition = Object.freeze({ nodeId: 'n_anchor', type: 'anchor', contentRevision: '32.0', payloadKey: '' });
    const ENTER: NodeActionRequest = Object.freeze({ transactionId: 'tx-floor-enter', nodeId: 'n_anchor', action: 'ENTER' });
    let state = createNodeRunState({ runId: 'r1', modeId: 'm', contentRevision: '32.0', seed: 1, mapHash: 'h', gold: 500 });
    state = openVisit(state, 'n_anchor', 0);
    state = { ...state, instability: 4 };
    const outcome = commitNodeAction(state, ENTER, ANCHOR, anchorHandler.validate, anchorHandler.commit);
    // The floor: the runner clamped to 0, never negative.
    expect(outcome.state.instability).toBe(0);
    expect(outcome.result.status).toBe('COMMITTED');
    // The oracle fold over the committed ledger reproduces the runner exactly.
    const anchorMap = { nodes: Object.freeze([Object.freeze({ id: 'n_anchor', type: 'anchor' })]) } as unknown as ExpeditionMap;
    expect(foldInstability(anchorMap, outcome.state.ledger)).toBe(outcome.state.instability);
  });
});
