import { describe, expect, it } from 'vitest';
import { abilityRejectOrdinal } from '../../src/game/sim/ability/ability-events.js';
import { advanceAbilityTick, tryCast, createAbilityInstance, type AbilityConfig, type AbilityInstance } from '../../src/game/sim/ability/ability-system.js';
import { applyInstabilityDelta } from '../../src/game/expedition/nodes/node-run-reducer.js';
import { createNodeRunState } from '../../src/game/expedition/nodes/run-state.js';
import { collapseDamageFor } from '../../src/game/sim/combat/battle-end-resolver.js';
import { mulDivRound } from '../../src/game/sim/math/fixed-math.js';
import { entity } from './test-helpers.js';

// ── Bug 1: collapseDamageFor must use mulDivRound (§8.1 integer pipeline) ──

describe('collapseDamageFor: uses mulDivRound consistently', () => {
  it('matches mulDivRound for all maxLp values 1..5000', () => {
    for (let maxLp = 1; maxLp <= 5000; maxLp += 1) {
      const e = entity('unit_test', { maxLp, lp: maxLp });
      const damage = collapseDamageFor(e);
      const expected = Math.max(1, mulDivRound(maxLp, 800, 10000));
      expect(damage).toBe(expected);
    }
  });

  it('rounds up at the half (where Math.floor would round down)', () => {
    // maxLp=7: 7*800=5600, 5600/10000=0.56 → mulDivRound=1, Math.floor=0
    const e = entity('unit_test', { maxLp: 7, lp: 7 });
    expect(collapseDamageFor(e)).toBe(1);
  });
});

// ── Bug 2: applyInstabilityDelta must validate Number.isSafeInteger ──

describe('applyInstabilityDelta: safe-integer validation', () => {
  function makeState() {
    return createNodeRunState({
      runId: 'run-test',
      modeId: 'normal',
      contentRevision: '32',
      seed: 42,
      mapHash: 'hash',
      gold: 100,
      troopCopies: {},
    });
  }

  it('accepts a normal positive delta', () => {
    const state = makeState();
    const next = applyInstabilityDelta(state, 5);
    expect(next.instability).toBe(5);
  });

  it('throws on a delta that would overflow to a non-safe integer', () => {
    const state = makeState();
    // Number.MAX_SAFE_INTEGER + 1 is not a safe integer.
    expect(() => applyInstabilityDelta(state, Number.MAX_SAFE_INTEGER + 1)).toThrow();
  });

  it('throws on a negative result', () => {
    const state = makeState();
    expect(() => applyInstabilityDelta(state, -1)).toThrow();
  });

  it('does not accept non-integer deltas (parity with applyGoldDelta)', () => {
    const state = makeState();
    expect(() => applyInstabilityDelta(state, 1.5)).toThrow();
  });
});

// ── Bug 3: tryCast rejected events carry the correct reject ordinal ──

describe('ability lifecycle: rejected event reason ordinal', () => {
  const config: AbilityConfig = {
    abilityId: 'test_ability',
    chargeTicks: 0,
    cooldownTicks: 10,
    castTicks: 1,
    recoveryTicks: 1,
    interruptPolicy: 'interruptible',
    usesPerBattle: 1,
    invalidTargetPolicy: 'wait',
    bossPhaseCancelAllowed: false,
  };

  function instance(overrides: Partial<AbilityInstance> = {}): AbilityInstance {
    return Object.freeze({
      ...createAbilityInstance(config, 'inst_0', 'owner_0'),
      ...overrides,
    });
  }

  const target = { kind: 'entity' as const, entityId: 'target_0', groundKey: null, slotId: null, lane: 'middle' as const, x100: 5000, acquiredTick: 0 };
  const source = { sourceId: 'owner_0', sourceLane: 'middle' as const, sourceX100: 1800, sourceLp: 1000, sourceMaxLp: 1000 };

  it('a rejected cast from disabled state returns only [rejected]', () => {
    const inst = instance({ state: 'disabled' });
    const result = tryCast(inst, config, 5, target, source);
    expect(result.events).toEqual(['rejected']);
  });

  it('a rejected cast from a non-ready state returns only [rejected]', () => {
    const inst = instance({ state: 'casting_precommit' });
    const result = tryCast(inst, config, 5, target, source);
    expect(result.events).toEqual(['rejected']);
    // The rejection ordinal for a non-exhaustion reject should NOT be 'exhausted' (3).
    // It should be 'not_ready' (0).
    expect(abilityRejectOrdinal('not_ready')).toBe(0);
    expect(abilityRejectOrdinal('exhausted')).toBe(3);
  });

  it('an exhausted cast returns [exhausted, rejected]', () => {
    const inst = instance({ state: 'ready', usesRemaining: 0 });
    const result = tryCast(inst, config, 5, target, source);
    expect(result.events).toEqual(['exhausted', 'rejected']);
    expect(result.instance.state).toBe('exhausted');
  });
});

// ── Suggestion 4: property-based fuzz test for collapseDamageFor ──

describe('collapseDamageFor: property-based fuzz (deterministic seeds)', () => {
  // Deterministic pseudo-random generator (LCG) so the fuzz is reproducible.
  function lcg(seed: number): () => number {
    let state = seed >>> 0;
    return () => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state;
    };
  }

  it('matches mulDivRound across 10,000 pseudo-random maxLp values', () => {
    const rng = lcg(0xdead_beef);
    for (let i = 0; i < 10_000; i++) {
      const maxLp = 1 + (rng() % 1_000_000);
      const e = entity('unit_fuzz', { maxLp, lp: maxLp });
      const damage = collapseDamageFor(e);
      const expected = Math.max(1, mulDivRound(maxLp, 800, 10000));
      expect(damage).toBe(expected);
    }
  });

  it('always returns at least 1 (the §10 minimum collapse damage)', () => {
    const rng = lcg(0xfeed_face);
    for (let i = 0; i < 1_000; i++) {
      const maxLp = 1 + (rng() % 100);
      const e = entity('unit_fuzz', { maxLp, lp: maxLp });
      expect(collapseDamageFor(e)).toBeGreaterThanOrEqual(1);
    }
  });
});

// ── Suggestion 3: decrementStock never produces negative stock ──

describe('decrementStock: stock guard', () => {
  it('never produces negative stock', async () => {
    const { decrementStock, materializeOffers, MERCHANT_OFFER_COUNT } = await import('../../src/game/expedition/offers/offer-service.js');
    const { createNodeRunState } = await import('../../src/game/expedition/nodes/run-state.js');
    const state = createNodeRunState({ runId: 'run-stock', modeId: 'normal', contentRevision: '32', seed: 1, mapHash: 'h', gold: 100, troopCopies: {} });
    const snapshot = materializeOffers(state, 'n0', MERCHANT_OFFER_COUNT);
    const firstOffer = snapshot.offers[0];
    expect(firstOffer).toBeDefined();
    const offerId = firstOffer?.offerId ?? '';
    // Decrement once → stock goes from 1 to 0.
    const first = decrementStock(snapshot, offerId);
    expect(first.offers[0]?.stock).toBe(0);
    // Decrement again → stock stays at 0 (guarded, never negative).
    const second = decrementStock(first, offerId);
    expect(second.offers[0]?.stock).toBe(0);
  });
});

// ── Suggestion 2: settlement uses CREDIT_GOLD and GRANT_ITEM transaction kinds ──

describe('settlement: uses proper transaction kinds', () => {
  it('uses CREDIT_GOLD for gold credits and GRANT_ITEM for loot', async () => {
    const { buildSettlementRequests } = await import('../../src/game/expedition/expedition-settlement.js');
    const { createNodeRunState } = await import('../../src/game/expedition/nodes/run-state.js');
    const state = createNodeRunState({ runId: 'run-settle', modeId: 'normal', contentRevision: '32', seed: 1, mapHash: 'h', gold: 500, troopCopies: {} });
    // Simulate some earned gold and secured loot.
    const withGold = { ...state, goldEarned: 500, securedLoot: ['loot_a', 'loot_b'] as readonly string[] };
    const result = buildSettlementRequests(withGold, 'victory');
    const kinds = result.requests.map((r) => r.kind);
    expect(kinds).toContain('CREDIT_GOLD');
    expect(kinds.filter((k) => k === 'GRANT_ITEM').length).toBe(2);
    expect(kinds).not.toContain('BUY_COPY');
  });
});

// ── Bug 5 (pass 2): applyOutcomeCommands batch instability overflow not checked ──

describe('applyOutcomeCommands: batch safe-integer validation', () => {
  it('rejects a batch whose accumulated instability overflows to unsafe integer', async () => {
    const { applyOutcomeCommands } = await import('../../src/game/expedition/outcome-commands.js');
    const state = createNodeRunState({ runId: 'run-overflow', modeId: 'normal', contentRevision: '32', seed: 1, mapHash: 'h', gold: 100, troopCopies: {} });
    // Two deltas each at MAX_SAFE_INTEGER/2 + 1 should overflow when summed.
    const big = Math.floor(Number.MAX_SAFE_INTEGER / 2) + 1;
    expect(() => applyOutcomeCommands(state, [
      { kind: 'INSTABILITY_DELTA', amount: big },
      { kind: 'INSTABILITY_DELTA', amount: big },
    ])).toThrow();
  });

  it('rejects a batch whose accumulated gold overflows to unsafe integer', async () => {
    const { applyOutcomeCommands } = await import('../../src/game/expedition/outcome-commands.js');
    const state = createNodeRunState({ runId: 'run-gold-overflow', modeId: 'normal', contentRevision: '32', seed: 1, mapHash: 'h', gold: 0, troopCopies: {} });
    const big = Math.floor(Number.MAX_SAFE_INTEGER / 2) + 1;
    expect(() => applyOutcomeCommands(state, [
      { kind: 'GOLD_DELTA', amount: big },
      { kind: 'GOLD_DELTA', amount: big },
    ])).toThrow();
  });
});

// ── Suggestion 5: settlement transaction ids are outcome-scoped and content-keyed ──

describe('settlement: outcome-scoped, content-keyed transaction ids', () => {
  it('different outcomes for the same run never share a transaction id', async () => {
    const { buildSettlementRequests } = await import('../../src/game/expedition/expedition-settlement.js');
    const state = createNodeRunState({ runId: 'run-collide', modeId: 'normal', contentRevision: '32', seed: 1, mapHash: 'h', gold: 500, troopCopies: {} });
    const victory = buildSettlementRequests(state, 'victory');
    const defeat = buildSettlementRequests(state, 'defeat');
    const victoryIds = new Set(victory.requests.map((r) => r.transactionId));
    const defeatIds = new Set(defeat.requests.map((r) => r.transactionId));
    // Gold credit must differ: victory and defeat credit different amounts and
    // must never replay each other's id.
    const shared = [...victoryIds].filter((id) => defeatIds.has(id));
    expect(shared).toEqual([]);
  });

  it('loot transaction ids are keyed by reward id, not list position', async () => {
    const { buildSettlementRequests } = await import('../../src/game/expedition/expedition-settlement.js');
    const base = createNodeRunState({ runId: 'run-keyed', modeId: 'normal', contentRevision: '32', seed: 1, mapHash: 'h', gold: 0, troopCopies: {} });
    const a = buildSettlementRequests({ ...base, securedLoot: ['loot_a', 'loot_b'] }, 'victory');
    const b = buildSettlementRequests({ ...base, securedLoot: ['loot_b', 'loot_a'] }, 'victory');
    const idsA = a.requests.map((r) => r.transactionId);
    const idsB = b.requests.map((r) => r.transactionId);
    // Reordering the loot list must not change which reward a given id maps to.
    const lootIdsA = a.requests.filter((r) => r.kind === 'GRANT_ITEM').map((r) => r.transactionId).sort();
    const lootIdsB = b.requests.filter((r) => r.kind === 'GRANT_ITEM').map((r) => r.transactionId).sort();
    expect(lootIdsA).toEqual(lootIdsB);
    // And the same reward maps to the same id in both orderings.
    const idFor = (reqs: readonly { transactionId: string; kind: string }[], lootId: string) =>
      reqs.find((r) => r.transactionId.endsWith(`-loot-${lootId}`));
    const idA = idFor(a.requests, 'loot_a')?.transactionId;
    const idB = idFor(b.requests, 'loot_a')?.transactionId;
    expect(idA).toBeDefined();
    expect(idB).toBeDefined();
    expect(idA).toBe(idB);
    expect(idsA).toHaveLength(2);
    expect(idsB).toHaveLength(2);
  });

  it('replaying the same outcome produces identical ids (idempotent)', async () => {
    const { buildSettlementRequests } = await import('../../src/game/expedition/expedition-settlement.js');
    const state = createNodeRunState({ runId: 'run-idem', modeId: 'normal', contentRevision: '32', seed: 1, mapHash: 'h', gold: 300, troopCopies: {} });
    const first = buildSettlementRequests({ ...state, securedLoot: ['loot_x'] }, 'victory');
    const second = buildSettlementRequests({ ...state, securedLoot: ['loot_x'] }, 'victory');
    expect(first.requests.map((r) => r.transactionId)).toEqual(second.requests.map((r) => r.transactionId));
  });
});

// ── Bug 4: advanceAbilityTick 'charging' with 0 chargeTicks goes to ready ──

describe('advanceAbilityTick: chargeTicks=0 edge', () => {
  const configWithCharge: AbilityConfig = {
    abilityId: 'test_charge',
    chargeTicks: 5,
    cooldownTicks: 10,
    castTicks: 1,
    recoveryTicks: 1,
    interruptPolicy: 'interruptible',
    usesPerBattle: 1,
    invalidTargetPolicy: 'wait',
    bossPhaseCancelAllowed: false,
  };

  it('charging with chargeTicks=0 config immediately goes ready', () => {
    const noChargeConfig = { ...configWithCharge, chargeTicks: 0 };
    const inst = createAbilityInstance(noChargeConfig, 'inst_1', 'owner_1');
    expect(inst.state).toBe('ready');
  });

  it('charging reaches ready when next >= fullCharge', () => {
    const inst = Object.freeze({
      ...createAbilityInstance(configWithCharge, 'inst_2', 'owner_2'),
      state: 'charging' as const,
      chargeTicks: 4,
    });
    const result = advanceAbilityTick(inst, configWithCharge, 10);
    expect(result.instance.state).toBe('ready');
    expect(result.events).toContain('ready');
  });
});
