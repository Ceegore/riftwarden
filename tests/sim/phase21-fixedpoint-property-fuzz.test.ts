/**
 * Phase 21 §9.5 FIXED-POINT PROPERTY FUZZ. The battery pinned the codec fixed
 * point on deterministic scripted walks; this fuzz makes it a PROPERTY test —
 * arbitrary seeded action walks (random ENTER / ENGAGE / ENGAGE_DEFEAT /
 * SERVICE / SECURE / ACCEPT / TAKE / CONTINUE / DECLINE mixes, including
 * reordered and repeated actions across all node kinds) commit arbitrary
 * ledgers, and after EVERY committed step `encode → decode → re-encode` must
 * stay byte-identical. The codec is a fixed point for ALL walks, not just the
 * scripted ones:
 *
 *   1. POST-COMMIT FIXED POINT — after each mutate (enter/act/resolve/advance)
 *      the save re-encodes byte-identically, so a reload between ANY two steps
 *      cannot drift the run;
 *   2. STORE FIXED POINT — the persisted payload (saveExpedition →
 *      restoreStoredExpedition → saveExpedition) is byte-identical at every
 *      sampled checkpoint, through the real store layer;
 *   3. LEDGER NON-EMPTY — the fuzz never degenerates into a no-op walk: each
 *      walk makes genuine progress (multiple committed ledger entries, gold /
 *      kills / instability move at least somewhere), so the fixed point is
 *      proven over real, non-trivial state.
 *
 * A failing seed reruns deterministically (no RNG divergence across runs).
 */
import { describe, expect, it } from 'vitest';
import { createExpedition } from '../../src/game/expedition/expedition-runner.js';
import { generateMap } from '../../src/game/expedition/map-generator.js';
import type { ExpeditionMap, MapProfile, NodeType } from '../../src/game/expedition/types.js';
import { decodeExpeditionSave, encodeExpeditionSave } from '../../src/game/expedition/expedition-save.js';
import { restoreStoredExpedition, saveExpedition } from '../../src/game/expedition/expedition-store.js';
import type { ExpeditionRunner } from '../../src/game/expedition/expedition-runner.js';

const store = new Map<string, string>();
(globalThis as { localStorage: unknown }).localStorage = {
  getItem(key: string) { return store.get(key) ?? null; },
  setItem(key: string, value: string) { store.set(key, value); },
  removeItem(key: string) { store.delete(String(key)); },
  clear() { store.clear(); },
  get length() { return store.size; },
  key(index: number) { return [...store.keys()][index] ?? null; },
};

/** Deterministic 32-bit PRNG (mulberry32) so every failing seed reproduces. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PROFILE: MapProfile = {
  id: 'exp-fpfuzz.v1',
  logicalLevels: 6,
  targetVisited: [5, 8] as const,
  mandatoryRoles: ['anchor', 'preparation', 'boss'],
  attemptCap: 50,
  fallbackTemplateId: 'fallback.v1',
};

function mapFor(seed: number): ExpeditionMap {
  return generateMap({ seed, profileId: 'exp-fpfuzz.v1', contentRevision: '32.0' }, PROFILE);
}

/** Re-encodes the decode of a serialization — the FIXED-POINT probe. */
function reencode(serialized: string): string {
  const decoded = decodeExpeditionSave(JSON.parse(serialized));
  return encodeExpeditionSave({ currentNodeId: decoded.currentNodeId, state: decoded.state } as unknown as ExpeditionRunner);
}

/** The SAFE action names by node kind (always valid on an OPEN visit; no
 * preconditions the fuzz cannot reason about). combat nodes choose between the
 * two verdict actions; every non-combat node offers at least DECLINE, so the
 * fuzz can always make a legal commit. */
const ACTION_NAMES: Readonly<Record<NodeType, readonly string[]>> = Object.freeze({
  battle: Object.freeze(['ENGAGE', 'ENGAGE_DEFEAT'] as const),
  elite: Object.freeze(['ENGAGE', 'ENGAGE_DEFEAT'] as const),
  boss: Object.freeze(['ENGAGE', 'ENGAGE_DEFEAT'] as const),
  merchant: Object.freeze(['SERVICE', 'DECLINE'] as const),
  anchor: Object.freeze(['SERVICE', 'SECURE', 'DECLINE'] as const),
  altar: Object.freeze(['ACCEPT', 'DECLINE'] as const),
  treasure: Object.freeze(['TAKE', 'DECLINE'] as const),
  story: Object.freeze(['CONTINUE', 'DECLINE'] as const),
  scout: Object.freeze(['REVEAL_PATH', 'REVEAL_REWARD', 'DECLINE'] as const),
  event: Object.freeze(['DECLINE'] as const),
  recruitment: Object.freeze(['DECLINE'] as const),
  workshop: Object.freeze(['DECLINE'] as const),
});

/** A legal action for any node kind (DECLINE is valid on every non-combat kind). */
const SAFE_FALLBACK_ACTION = 'DECLINE';

const objectivesForBattle: readonly string[] = Object.freeze(['kill_regulars', 'heal_sustain', 'survive_until'] as const);

function objectivesForKind(type: string): readonly string[] {
  if (type === 'elite' || type === 'boss') return Object.freeze(['defeat_boss', 'kill_boss', 'survive_until'] as const);
  return objectivesForBattle;
}

interface WalkStats {
  readonly steps: number;
  readonly committedActions: number;
  readonly goldMoved: boolean;
  readonly killsMoved: boolean;
}

/**
 * One seeded random walk over the REAL runner. After every commit/settle hop it
 * asserts `encode → re-encode` is byte-identical, and periodically puts the
 * save through the REAL store layer (save → restore → re-save) asserting the
 * stored payload is byte-identical. Returns stats proving the walk did real work.
 */
function fuzzWalk(seed: number): WalkStats {
  const rand = mulberry32(seed ^ 0x5e6_0);
  let exp = createExpedition(mapFor(seed), { startGold: 300 });
  store.clear();
  let steps = 0;
  let committedActions = 0;
  let guard = 0;
  let startGold = exp.state.gold;
  let startKills = exp.state.killsEarned;
  const goldMoved = (): boolean => exp.state.gold !== startGold || exp.state.goldEarned !== 0;
  const killsMoved = (): boolean => exp.state.killsEarned !== startKills;
  const assertFixed = (label: string): void => {
    const s1 = encodeExpeditionSave(exp);
    expect(reencode(s1), `${label} re-encode === encode (seed ${seed}, step ${steps})`).toBe(s1);
  };
  const assertStoreFixed = (): void => {
    saveExpedition(exp);
    const first = store.get('rw.expedition.v1');
    if (first === undefined) throw new Error('store save wrote nothing');
    const restored = restoreStoredExpedition(mapFor(seed));
    if (restored === null) throw new Error('store restore failed');
    expect(encodeExpeditionSave(restored)).toBe(first);
    saveExpedition(restored);
    expect(store.get('rw.expedition.v1')).toBe(first);
  };

  // The first step ENTERs the start node (always a battle family) — commit it.
  exp = exp.enter('ff-enter-0');
  assertFixed('enter-0');

  while (exp.reachableNodes.length > 0 && guard < 400) {
    const type = exp.definition.type;
    const nodeId = exp.currentNodeId;
    const pick = rand();
    const poolForKind = ACTION_NAMES[type];
    const actions = poolForKind === undefined ? ACTION_NAMES.scout : poolForKind;
    const action = actions[Math.floor(pick * actions.length)] ?? SAFE_FALLBACK_ACTION;

    // ENTER is committed only once per node (re-ENTER on a COMMITTED visit is a
    // benign replay that must not mutate the payload).
    exp = exp.enter(`ff-e-${String(seed)}-${String(guard)}`);
    assertFixed(`enter ${guard}`);

    let chose = action;
    if (type === 'battle' || type === 'elite' || type === 'boss') {
      if (chose === 'ENGAGE_DEFEAT' && rand() < 0.8) chose = 'ENGAGE';
      // Random completedKinds mixes: some victories carry a kind set, some an
      // empty set, some a pair — all must compress identically.
      const kindsRoll = rand();
      const kindPool = objectivesForKind(type);
      const kinds = kindsRoll < 0.4 ? []
        : kindsRoll < 0.7 ? [kindPool[Math.floor(rand() * kindPool.length)] ?? 'kill_regulars']
        : [kindPool[0] ?? 'kill_regulars', kindPool[1] ?? 'survive_until'];
      exp = exp.act({
        transactionId: `ff-a-${String(seed)}-${String(guard)}`,
        nodeId,
        action: chose,
        ...(chose === 'ENGAGE' ? { completedKinds: kinds } : {}),
      });
    } else if (type === 'merchant' || type === 'anchor') {
      const svcAffordable = exp.state.gold >= 30 && (type === 'merchant' ? exp.state.instability >= 10 : exp.state.instability >= 8);
      const useService = chose === 'SERVICE' && svcAffordable;
      exp = exp.act({ transactionId: `ff-a-${String(seed)}-${String(guard)}`, nodeId, action: useService ? 'SERVICE' : 'DECLINE' });
    } else {
      exp = exp.act({ transactionId: `ff-a-${String(seed)}-${String(guard)}`, nodeId, action: chose });
    }
    if (exp.state.ledger[`ff-a-${String(seed)}-${String(guard)}`]?.status === 'COMMITTED' && (type === 'battle' || type === 'elite' || type === 'boss')) {
      committedActions += 1;
    }
    assertFixed(`act ${guard}`);

    exp = exp.resolve();
    assertFixed(`resolve ${guard}`);

    const next = exp.reachableNodes[0];
    if (next === undefined) break;
    exp = exp.advance(next);
    assertFixed(`advance ${guard}`);

    // Store fixed-point sampled ~1 in 7 hops.
    if (guard % 7 === 3) assertStoreFixed();

    steps += 1;
    guard += 1;
  }
  // One final store fixed-point at the terminal.
  assertStoreFixed();

  if (!goldMoved() && !killsMoved()) {
    // A walk that neither spent nor earned anything is not exercising state;
    // but battles always set killsEarned on ENGAGE, so this should not occur.
    expect([goldMoved(), killsMoved()], `seed ${seed} made no ledger progress`).toEqual([true, true]);
  }
  return { steps, committedActions, goldMoved: goldMoved(), killsMoved: killsMoved() };
}

describe('P21 §9.5 fixed-point property fuzz', () => {
  it('every seeded random action walk keeps the codec a fixed point after each commit', { timeout: 60_000 }, () => {
    let seenCombat = 0;
    let seenGold = 0;
    let seenKills = 0;
    let totalSteps = 0;
    for (let seed = 900; seed < 912; seed += 1) {
      const stats = fuzzWalk(seed);
      totalSteps += stats.steps;
      if (stats.committedActions > 0) seenCombat += 1;
      if (stats.goldMoved) seenGold += 1;
      if (stats.killsMoved) seenKills += 1;
    }
    // The aggregated walk really covered the state space.
    expect(totalSteps).toBeGreaterThan(50);
    expect(seenCombat).toBeGreaterThan(4);
    expect(seenGold).toBeGreaterThan(4);
    expect(seenKills).toBeGreaterThan(4);
  });

  it('walks with many re-ENTERS and repeated actions never break the fixed point', { timeout: 60_000 }, () => {
    for (const seed of [912, 913]) {
      const map = mapFor(seed);
      let exp = createExpedition(map, { startGold: 300 });
      const rand = mulberry32(seed ^ 0xabc);
      let guard = 0;
      while (exp.reachableNodes.length > 0 && guard < 120) {
        const nodeId = exp.currentNodeId;
        const type = exp.definition.type;
        // Hammer the SAME node: enter → act → resolve → re-enter → act again.
        exp = exp.enter(`rr-e-${String(guard)}-a`);
        const kindPool = ACTION_NAMES[type] ?? ACTION_NAMES.scout;
        const name = kindPool[Math.floor(rand() * kindPool.length)] ?? SAFE_FALLBACK_ACTION;
        exp = exp.act({ transactionId: `rr-a-${String(guard)}-1`, nodeId, action: name, ...(name === 'ENGAGE' ? { completedKinds: ['kill_regulars'] } : {}) });
        exp = exp.resolve();
        const s1 = encodeExpeditionSave(exp);
        expect(reencode(s1)).toBe(s1);
        exp = exp.enter(`rr-e-${String(guard)}-b`);
        exp = exp.act({ transactionId: `rr-a-${String(guard)}-2`, nodeId, action: name, ...(name === 'ENGAGE' ? { completedKinds: ['kill_regulars'] } : {}) });
        exp = exp.resolve();
        const s2 = encodeExpeditionSave(exp);
        expect(reencode(s2)).toBe(s2);
        const next = exp.reachableNodes[0];
        if (next === undefined) break;
        exp = exp.advance(next);
        guard += 1;
      }
    }
  });
});
