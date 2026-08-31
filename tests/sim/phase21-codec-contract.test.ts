/**
 * Phase 21 §9.5 save-codec CONTRACT for the whole ledger. The reload
 * continuity fix made `completedKinds` round-trip, but the FULL field closure
 * of every `TransactionRecord` and `NodeVisitState` must hold — a future
 * optional key can never silently break reload again, and a malformed ledger
 * entry must never decode into a silently-different run.
 *
 *  1. FULL ROUND-TRIP: a run that exercised every action family (ENTER,
 *     ENGAGE victory + defeat, DECLINE, SERVICE, ACCEPT, SECURE, TAKE,
 *     CONTINUE, …) encodes → decodes → deep-equals its own state — the whole
 *     ledger, visits and snapshots survive byte-identically (revision,
 *     gold, instability, every record's optional keys).
 *  2. LEDGER FIELD CLOSURE: every required key is MISSING_FIELD when absent,
 *     every optional key is UNKNOWN_FIELD when unknown, the status enum is
 *     closed, and outcomeIds/completedKinds are validated shapes.
 *  3. VISIT FIELD CLOSURE: nodeId/status/previewRevision required,
 *     transactionId optional, the status enum is closed.
 */
import { describe, expect, it } from 'vitest';
import { createExpedition } from '../../src/game/expedition/expedition-runner.js';
import { generateMap } from '../../src/game/expedition/map-generator.js';
import type { ExpeditionMap, MapProfile } from '../../src/game/expedition/types.js';
import { decodeExpeditionSave, encodeExpeditionSave } from '../../src/game/expedition/expedition-save.js';
import { fnv1a32 } from '../../src/game/expedition/stable.js';
import type { NodeActionRequest } from '../../src/game/expedition/nodes/types.js';

const PROFILE: MapProfile = {
  id: 'exp-codec.v1',
  logicalLevels: 6,
  targetVisited: [5, 8] as const,
  mandatoryRoles: ['anchor', 'preparation', 'boss'],
  attemptCap: 50,
  fallbackTemplateId: 'fallback.v1',
};

function mapFor(seed: number): ExpeditionMap {
  return generateMap({ seed, profileId: 'exp-codec.v1', contentRevision: '32.0' }, PROFILE);
}

/** A deterministic full-map walk committing a WIDE variety of ledger actions. */
function walkRun(seed: number): ReturnType<typeof createExpedition> {
  let exp = createExpedition(mapFor(seed), { startGold: 250 });
  let step = 0;
  let guard = 0;
  while (exp.reachableNodes.length > 0 && guard < 300) {
    const type = exp.definition.type;
    const nodeId = exp.currentNodeId;
    const h = fnv1a32([String(seed), nodeId]);
    exp = exp.enter(`c-${String(seed)}-e-${String(step)}`);
    let action: NodeActionRequest;
    if (type === 'battle' || type === 'elite' || type === 'boss') {
      action = h % 2 === 0
        ? { transactionId: `c-${String(seed)}-a-${String(step)}`, nodeId, action: 'ENGAGE_DEFEAT' }
        : { transactionId: `c-${String(seed)}-a-${String(step)}`, nodeId, action: 'ENGAGE', completedKinds: ['heal_sustain'] };
    } else if (type === 'merchant') {
      action = exp.state.gold >= 30 && exp.state.instability >= 10
        ? { transactionId: `c-${String(seed)}-a-${String(step)}`, nodeId, action: 'SERVICE' }
        : { transactionId: `c-${String(seed)}-a-${String(step)}`, nodeId, action: 'DECLINE' };
    } else if (type === 'anchor') {
      action = exp.state.gold >= 30 && exp.state.instability >= 8
        ? { transactionId: `c-${String(seed)}-a-${String(step)}`, nodeId, action: 'SERVICE' }
        : { transactionId: `c-${String(seed)}-a-${String(step)}`, nodeId, action: 'SECURE' };
    } else if (type === 'altar') {
      action = exp.state.instability + 10 <= 100
        ? { transactionId: `c-${String(seed)}-a-${String(step)}`, nodeId, action: 'ACCEPT' }
        : { transactionId: `c-${String(seed)}-a-${String(step)}`, nodeId, action: 'DECLINE' };
    } else if (type === 'treasure') {
      action = { transactionId: `c-${String(seed)}-a-${String(step)}`, nodeId, action: 'TAKE' };
    } else if (type === 'story') {
      action = { transactionId: `c-${String(seed)}-a-${String(step)}`, nodeId, action: 'CONTINUE' };
    } else {
      action = { transactionId: `c-${String(seed)}-a-${String(step)}`, nodeId, action: 'DECLINE' };
    }
    exp = exp.act(action);
    if ((type === 'battle' || type === 'elite' || type === 'boss') && action.action === 'ENGAGE_DEFEAT') {
      exp = exp.act({ transactionId: `c-${String(seed)}-d-${String(step)}`, nodeId, action: 'DECLINE' });
    }
    exp = exp.resolve();
    const next = exp.reachableNodes[0];
    if (next === undefined) break;
    exp = exp.advance(next);
    step += 1;
    guard += 1;
  }
  return exp;
}

describe('P21 §9.5 whole-ledger save-codec contract', () => {
  it('a full walk (every action family) encodes → decodes → deep-equals its own state', () => {
    for (const seed of [401, 402, 403]) {
      const runner = walkRun(seed);
      const ledgerCount = Object.keys(runner.state.ledger).length;
      expect(ledgerCount).toBeGreaterThan(5); // the walk really committed a mixed ledger
      const decoded = decodeExpeditionSave(JSON.parse(encodeExpeditionSave(runner)));
      expect(decoded.currentNodeId).toBe(runner.currentNodeId);
      // Deep equality: revision, gold, instability, EVERY record (incl. the
      // victory ENGAGE's completedKinds), every visit, every snapshot.
      expect(decoded.state).toEqual(runner.state);
      // The ledger survives the boundary as a CANONICALIZED multiset: the
      // codec (canonicalJson) SORTS map keys, so the decoded insertion order
      // is the sorted key order — NOT the commit order. Instability is a
      // persisted SCALAR (never re-derived from the ledger), so the runtime
      // is unaffected; anything replaying the ledger must not assume order.
      const sorted = (keys: readonly string[]): readonly string[] => [...keys].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
      expect(sorted(Object.keys(decoded.state.ledger))).toEqual(sorted(Object.keys(runner.state.ledger)));
    }
  });

  it('a victory ENGAGE ledger record round-trips its completedKinds with the whole record', () => {
    const runner = walkRun(401);
    const engage = Object.values(runner.state.ledger).find((entry) => entry.action === 'ENGAGE' && entry.status === 'COMMITTED');
    if (engage === undefined) throw new Error('walk 401 committed no victory ENGAGE');
    expect(engage.completedKinds).toEqual(['heal_sustain']);
    const decoded = decodeExpeditionSave(JSON.parse(encodeExpeditionSave(runner)));
    const restored = decoded.state.ledger[engage.transactionId];
    expect(restored).toEqual(engage);
  });

  it('ledger field closure: required keys are MISSING_FIELD, unknown keys are UNKNOWN_FIELD', () => {
    const value = JSON.parse(encodeExpeditionSave(walkRun(404))) as Record<string, unknown>;
    const state = value['state'] as Record<string, unknown>;
    const ledger = state['ledger'] as Record<string, Record<string, unknown>>;
    const txId = Object.keys(ledger)[0];
    if (txId === undefined) throw new Error('no ledger record');
    const record = ledger[txId] as Record<string, unknown>;
    for (const key of ['transactionId', 'nodeId', 'action', 'status', 'outcomeIds']) {
      const { [key]: _removed, ...rest } = record;
      const poked = { ...state, ledger: { ...ledger, [txId]: rest } };
      expect(() => decodeExpeditionSave({ ...value, state: poked })).toThrow('MISSING_FIELD');
    }
    // An UNKNOWN key on a ledger record is rejected (the closure is closed).
    const unknown = { ...state, ledger: { ...ledger, [txId]: { ...record, extra: true } } };
    expect(() => decodeExpeditionSave({ ...value, state: unknown })).toThrow('UNKNOWN_FIELD');
  });

  it('ledger field closure: status enum, outcomeIds and completedKinds shapes are validated', () => {
    const value = JSON.parse(encodeExpeditionSave(walkRun(405))) as Record<string, unknown>;
    const state = value['state'] as Record<string, unknown>;
    const ledger = state['ledger'] as Record<string, Record<string, unknown>>;
    const txId = Object.keys(ledger)[0];
    if (txId === undefined) throw new Error('no ledger record');
    const poke = (patch: Record<string, unknown>): void => {
      const poked = { ...state, ledger: { ...ledger, [txId]: { ...ledger[txId], ...patch } } };
      expect(() => decodeExpeditionSave({ ...value, state: poked })).toThrow('INVALID_FIELD');
    };
    // A status outside the closed enum is INVALID_ENUM.
    expect(() => decodeExpeditionSave({
      ...value,
      state: { ...state, ledger: { ...ledger, [txId]: { ...ledger[txId], status: 'BOGUS' } } },
    })).toThrow('INVALID_ENUM');
    // outcomeIds must be a string array.
    poke({ outcomeIds: 'nope' });
    poke({ outcomeIds: [1, 2] });
    // completedKinds must be a string array when present.
    poke({ completedKinds: 'heal_sustain' });
    poke({ completedKinds: [1] });
    // reason must be a string when present.
    poke({ reason: 42 });
  });

  it('visit field closure: required keys, optional transactionId, closed status enum', () => {
    const value = JSON.parse(encodeExpeditionSave(walkRun(406))) as Record<string, unknown>;
    const state = value['state'] as Record<string, unknown>;
    const visits = state['visits'] as Record<string, Record<string, unknown>>;
    const nodeId = Object.keys(visits)[0];
    if (nodeId === undefined) throw new Error('no visits');
    const visit = visits[nodeId] as Record<string, unknown>;
    for (const key of ['nodeId', 'status', 'previewRevision']) {
      const { [key]: _removed, ...rest } = visit;
      const poked = { ...state, visits: { ...visits, [nodeId]: rest } };
      expect(() => decodeExpeditionSave({ ...value, state: poked })).toThrow('MISSING_FIELD');
    }
    // Optional transactionId round-trips; unknown keys are rejected.
    const withTx = { ...state, visits: { ...visits, [nodeId]: { ...visit, transactionId: 'tx-42' } } };
    const decoded = decodeExpeditionSave({ ...value, state: withTx });
    expect(decoded.state.visits[nodeId]?.transactionId).toBe('tx-42');
    const unknownVisit = { ...state, visits: { ...visits, [nodeId]: { ...visit, extra: true } } };
    expect(() => decodeExpeditionSave({ ...value, state: unknownVisit })).toThrow('UNKNOWN_FIELD');
    // Closed status enum.
    const badStatus = { ...state, visits: { ...visits, [nodeId]: { ...visit, status: 'BOGUS' } } };
    expect(() => decodeExpeditionSave({ ...value, state: badStatus })).toThrow('INVALID_ENUM');
  });
});
