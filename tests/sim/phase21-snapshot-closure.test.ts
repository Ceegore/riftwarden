/**
 * Phase 21 §9.5 SNAPSHOT FIELD-CLOSURE BATTERY. The whole-ledger codec test
 * pinned the `TransactionRecord` and `NodeVisitState` closures, but the THIRD
 * state container — the persisted `NodeSnapshot` map (OFFERS / EVENT / REWARD
 * kinds plus their nested `Offer` / `EventOptionState`) — has its own closure
 * that must hold: a future optional key can never silently break a save
 * reload, and a malformed snapshot must never decode into a silently-different
 * run. This battery drives the REAL handlers to materialise every snapshot
 * kind and pins:
 *
 *   1. ROUND-TRIP: each kind encodes → decodes → deep-equals its own snapshot
 *      (seed, rollSlots, nested arrays and all optional keys survive);
 *   2. KIND ENUM CLOSED: a snapshot whose `kind` is not one of the three is
 *      INVALID_ENUM — never decoded into a bag of unknown fields;
 *   3. TOP-LEVEL FIELD CLOSURE: every required key is rejected when absent
 *      (MISSING_FIELD / INVALID_FIELD for the kind pre-validated key) and
 *      every unknown key is UNKNOWN_FIELD, per KIND;
 *   4. NESTED CLOSURE: the OFFERS array's `Offer` and the EVENT array's
 *      `EventOptionState` enforce their own required/optional/unknown closures.
 */
import { describe, expect, it } from 'vitest';
import { createExpedition } from '../../src/game/expedition/expedition-runner.js';
import { generateMap } from '../../src/game/expedition/map-generator.js';
import type { ExpeditionMap, MapProfile } from '../../src/game/expedition/types.js';
import { decodeExpeditionSave, encodeExpeditionSave } from '../../src/game/expedition/expedition-save.js';

const PROFILE: MapProfile = {
  id: 'exp-snap-closure.v1',
  logicalLevels: 6,
  targetVisited: [5, 8] as const,
  mandatoryRoles: ['anchor', 'preparation', 'boss'],
  attemptCap: 50,
  fallbackTemplateId: 'fallback.v1',
};

function mapFor(seed: number): ExpeditionMap {
  return generateMap({ seed, profileId: 'exp-snap-closure.v1', contentRevision: '32.0' }, PROFILE);
}

type Family = 'merchant' | 'event' | 'battle';

function familyMatches(type: string, family: Family): boolean {
  return family === 'merchant' ? type === 'merchant' || type === 'recruitment'
    : family === 'event' ? type === 'event'
    : ['battle', 'elite', 'boss'].includes(type);
}

interface FoundNode { readonly exp: ReturnType<typeof createExpedition>; readonly nodeId: string; readonly seed: number; }

/**
 * Deterministically finds a map (scanning seeds 1..) whose reachableNodes[0]
 * walk reaches a node of the target family, performs the real handler's ENTER
 * (materialising the OFFERS / EVENT / REWARD snapshot at that node) and returns
 * the expedition + the TARGET node id. Scanning upward is deterministic because
 * each (seed, profile) map is deterministic.
 */
function findNode(family: Family): FoundNode {
  for (let seed = 1; seed <= 600; seed += 1) {
    try {
      let exp = createExpedition(mapFor(seed), { startGold: 300 });
      let guard = 0;
      while (!familyMatches(exp.definition.type, family)) {
        const next = exp.reachableNodes[0];
        if (next === undefined) throw new Error('deadend');
        exp = exp.enter(`snap-walk-${String(guard)}`).resolve().advance(next);
        guard += 1;
        if (guard > 150) throw new Error('diverged');
      }
      const nodeId = exp.currentNodeId;
      const entered = exp.enter(`snap-enter-${String(seed)}`);
      if (entered.state.snapshots[nodeId] === undefined) throw new Error('no snapshot at target');
      return { exp: entered, nodeId, seed };
    } catch {
      // try the next seed
    }
  }
  throw new Error(`no seed routes to family ${family}`);
}

function kindOf(family: Family): 'OFFERS' | 'EVENT' | 'REWARD' {
  return family === 'merchant' ? 'OFFERS' : family === 'event' ? 'EVENT' : 'REWARD';
}

/** Root save object (clone targets for poking) plus the target node's snapshot. */
function pokeTargets(family: Family): { root: Record<string, unknown>; nodeId: string; snap: Record<string, unknown> } {
  const { exp, nodeId } = findNode(family);
  const root = JSON.parse(encodeExpeditionSave(exp)) as Record<string, unknown>;
  const state = root['state'] as Record<string, unknown>;
  const snapshots = state['snapshots'] as Record<string, unknown>;
  const snap = snapshots[nodeId] as Record<string, unknown>;
  if (snap === undefined || snap['kind'] !== kindOf(family)) {
    throw new Error(`expected ${kindOf(family)} at ${nodeId}, got ${String(snap?.['kind'])}`);
  }
  return { root, nodeId, snap };
}

function pokeSnapshot(root: Record<string, unknown>, nodeId: string, patch: (snap: Record<string, unknown>) => Record<string, unknown>): Record<string, unknown> {
  const state = root['state'] as Record<string, unknown>;
  const snapshots = state['snapshots'] as Record<string, unknown>;
  return { ...root, state: { ...state, snapshots: { ...snapshots, [nodeId]: patch(snapshots[nodeId] as Record<string, unknown>) } } };
}

function expectMissing(family: Family, keys: readonly string[]): void {
  const { root, nodeId } = pokeTargets(family);
  for (const key of keys) {
    const poked = pokeSnapshot(root, nodeId, (snap) => {
      const { [key]: _removed, ...rest } = snap;
      return rest;
    });
    // Removing the kind/name key that the decoder pre-validates yields
    // INVALID_FIELD rather than MISSING_FIELD — either way a SaveError fires,
    // never a silent decode. The other required keys hit the closedKeys pass.
    expect(() => decodeExpeditionSave(poked)).toThrow(/MISSING_FIELD|INVALID_FIELD/);
  }
}

function expectUnknown(family: Family): void {
  const { root, nodeId } = pokeTargets(family);
  const poked = pokeSnapshot(root, nodeId, (snap) => ({ ...snap, extraField: 1 }));
  expect(() => decodeExpeditionSave(poked)).toThrow('UNKNOWN_FIELD');
}

describe('P21 §9.5 snapshot field-closure battery', () => {
  it('OFFERS snapshots round-trip byte-identically through the codec', () => {
    const { exp, nodeId } = findNode('merchant');
    const decoded = decodeExpeditionSave(JSON.parse(encodeExpeditionSave(exp)));
    // Deep-equal: seed, rollSlots, offers, rerollsUsed — the WHOLE record.
    expect(decoded.state.snapshots[nodeId]).toEqual(exp.state.snapshots[nodeId]);
  });

  it('EVENT snapshots round-trip byte-identically through the codec', () => {
    const { exp, nodeId } = findNode('event');
    const decoded = decodeExpeditionSave(JSON.parse(encodeExpeditionSave(exp)));
    expect(decoded.state.snapshots[nodeId]).toEqual(exp.state.snapshots[nodeId]);
  });

  it('REWARD snapshots round-trip byte-identically through the codec', () => {
    const { exp, nodeId } = findNode('battle');
    const decoded = decodeExpeditionSave(JSON.parse(encodeExpeditionSave(exp)));
    expect(decoded.state.snapshots[nodeId]).toEqual(exp.state.snapshots[nodeId]);
  });

  it('the snapshot kind enum is CLOSED: an unknown kind is INVALID_ENUM', () => {
    const { root, nodeId, snap } = pokeTargets('battle');
    if (snap['kind'] !== 'REWARD') throw new Error('expected REWARD');
    const poked = pokeSnapshot(root, nodeId, (s) => ({ ...s, kind: 'BOGUS' }));
    expect(() => decodeExpeditionSave(poked)).toThrow('INVALID_ENUM');
  });

  it('OFFERS top-level closure: every required key, plus unknown keys, are rejected', () => {
    expectMissing('merchant', ['kind', 'nodeId', 'offers', 'rerollsUsed', 'rollSlots', 'seed', 'snapshotId']);
    expectUnknown('merchant');
  });

  it('EVENT top-level closure: every required key, plus unknown keys, are rejected', () => {
    expectMissing('event', ['eventId', 'kind', 'nodeId', 'options', 'rollSlots', 'seed', 'snapshotId']);
    expectUnknown('event');
  });

  it('REWARD top-level closure: every required key, plus unknown keys, are rejected', () => {
    expectMissing('battle', ['kind', 'nodeId', 'rewardIds', 'rollSlots', 'seed', 'snapshotId']);
    expectUnknown('battle');
  });

  it('NESTED OFFERS closure: an Offer enforces its own required/optional/unknown keys', () => {
    const { root, nodeId, snap } = pokeTargets('merchant');
    const offers = snap['offers'] as Record<string, unknown>[];
    if (offers.length === 0) throw new Error('no nested offers');
    const offer = offers[0]!;
    for (const key of ['offerId', 'priceGold', 'stock', 'labelKey']) {
      const { [key]: _removed, ...rest } = offer;
      const poked = pokeSnapshot(root, nodeId, (s) => ({ ...s, offers: [rest] }));
      expect(() => decodeExpeditionSave(poked)).toThrow(/MISSING_FIELD|INVALID_FIELD/);
    }
    const unknown = pokeSnapshot(root, nodeId, (s) => ({ ...s, offers: [{ ...offer, extra: true }] }));
    expect(() => decodeExpeditionSave(unknown)).toThrow('UNKNOWN_FIELD');
  });

  it('NESTED EVENT closure: an EventOptionState enforces its keys and cardinality', () => {
    const { root, nodeId, snap } = pokeTargets('event');
    const options = snap['options'] as Record<string, unknown>[];
    if (options.length === 0) throw new Error('no event options');
    const option = options[0]!;
    const unknown = pokeSnapshot(root, nodeId, (s) => ({ ...s, options: [{ ...option, extra: true }] }));
    expect(() => decodeExpeditionSave(unknown)).toThrow('UNKNOWN_FIELD');
    const { optionId: _no, available: _na, ...bare } = option;
    const barePoke = pokeSnapshot(root, nodeId, (s) => ({ ...s, options: [bare] }));
    expect(() => decodeExpeditionSave(barePoke)).toThrow('INVALID_FIELD');
  });
});
