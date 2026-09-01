/**
 * Phase 21 §9.5 BOUNTY ENTITLEMENT BOUNDARY FUZZ. The mission-kind matrix and
 * wallet audit pinned disclosure == grant on the FAMILY's real kinds. This fuzz
 * hammers the ENTITLEMENT boundary — what a victory pays for ARBITRARY
 * completed-kind sets, including kinds that pay nothing and kinds that do not
 * exist:
 *
 *   1. UNKNOWN KINDS PAY 0 — a kind outside the contract table contributes
 *      nothing to the bounty, whether it is a real sim ObjectiveKind that is
 *      NOT an EncounterObjectiveKind (`destroy_object`), a made-up string, or
 *      an empty-kind victory;
 *   2. GRANT == DISCLOSURE — the gold a victory ENGAGE actually grants is
 *      EXACTLY `base(snapshot) + bountyForKinds(kinds)` for every random mix,
 *      and `bountyForKinds(kinds)` equals the disclosed affordance announced
 *      for the node's single-objective mission (never more than what the kind
 *      table says the completed kinds are worth);
 *   3. BREAKDOWN CONSISTENCY — `bountyBreakdownForKinds` folds to exactly
 *      `bountyForKinds`, omits every zero/unknown kind, and preserves order;
 *   4. EXACTLY-ONCE — replaying a random-mix ENGAGE grants nothing a second
 *      time; a second distinct ENGAGE is rejected and pays nothing.
 *
 * A failing seed reruns deterministically (mulberry32 seeding).
 */
import { describe, expect, it } from 'vitest';
import { createExpedition } from '../../src/game/expedition/expedition-runner.js';
import { generateMap } from '../../src/game/expedition/map-generator.js';
import type { ExpeditionMap, MapProfile } from '../../src/game/expedition/types.js';
import { bountyBreakdownForKinds, bountyForKinds, bountyPreviewForEncounterObjective } from '../../src/game/expedition/nodes/handlers/combat.js';

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
  id: 'exp-bounty-fuzz.v1',
  logicalLevels: 6,
  targetVisited: [5, 8] as const,
  mandatoryRoles: ['anchor', 'preparation', 'boss'],
  attemptCap: 50,
  fallbackTemplateId: 'fallback.v1',
};

function mapFor(seed: number): ExpeditionMap {
  return generateMap({ seed, profileId: 'exp-bounty-fuzz.v1', contentRevision: '32.0' }, PROFILE);
}

function walkToBattle(seed: number): { exp: ReturnType<typeof createExpedition>; nodeId: string } {
  let exp = createExpedition(mapFor(seed), { startGold: 300 });
  let guard = 0;
  while (exp.definition.type !== 'battle') {
    const next = exp.reachableNodes[0];
    if (next === undefined) throw new Error(`dead-end ${exp.currentNodeId} seed ${String(seed)}`);
    exp = exp.enter(`bf-walk-${String(guard)}`).resolve().advance(next);
    guard += 1;
    if (guard > 150) throw new Error('walk diverged');
  }
  return { exp, nodeId: exp.currentNodeId };
}

function baseGold(rollSlots: Readonly<Record<string, number>>): number {
  return 45 + ((rollSlots['gold'] ?? 0) % 26);
}

/** The contract table amounts, re-derived independently (the honest fold). */
const CONTRACT_PAYS: Readonly<Record<string, number>> = Object.freeze({
  kill_regulars: 5,
  kill_boss: 15,
  destroy_object: 10,
  protect_object: 10,
  survive_until: 10,
  complete_waves: 10,
  heal_sustain: 10,
});
const ENCOUNTER_OBJECTIVES: readonly string[] = Object.freeze([
  'defeat_all', 'survive', 'defeat_boss', 'protect_object', 'complete_waves', 'heal_sustain',
]);
const KNOWN_KINDS: readonly string[] = Object.freeze(Object.keys(CONTRACT_PAYS));
// Kinds that must pay 0: plainly-bogus strings. NOTE — `destroy_object` is
// deliberately NOT here: it IS in the pay table (10) but has NO encounter
// objective that can disclose it, so it can be GRANTED but never DISCLOSED.
const ZERO_PAY_KINDS: readonly string[] = Object.freeze([
  'banish_trap',
  'unlock_door',
  'not_a_kind',
  'still_not_a_kind',
  '',
]);

/** Honest oracle: sum over the paying kinds (an independent fold of the table). */
function oracleBounty(kinds: readonly string[]): number {
  return kinds.reduce((sum, kind) => sum + (CONTRACT_PAYS[kind] ?? 0), 0);
}

describe('P21 §9.5 bounty entitlement boundary fuzz', () => {
  it('unknown, zero-paying and empty kinds contribute exactly 0 to bountyForKinds and the breakdown', () => {
    for (const kind of ZERO_PAY_KINDS) {
      expect(bountyForKinds([kind]), `bountyForKinds([${kind}])`).toBe(0);
      expect(bountyBreakdownForKinds([kind])).toEqual([]);
    }
    expect(bountyForKinds([])).toBe(0);
    expect(bountyBreakdownForKinds([])).toEqual([]);
    // A mix of ONLY unknown kinds pays nothing.
    expect(bountyForKinds(['not_a_kind', 'banish_trap', 'still_not_a_kind'])).toBe(0);
    // A single known kind mixed with unknowns pays exactly its table amount.
    expect(bountyForKinds(['kill_regulars', 'not_a_kind', 'banish_trap'])).toBe(5);
    // destroy_object IS payable on grant (10) even though it has no disclosure
    // mapping — GRANTED-but-never-disclosed is the boundary to pin.
    expect(bountyForKinds(['destroy_object'])).toBe(10);
    expect(bountyForKinds(['kill_boss', 'not_a_kind', 'destroy_object'])).toBe(25);
  });

  it('bountyForKinds == the honest independent fold for seeded random mixes (known + unknown + duplicates + empty)', () => {
    const rand = mulberry32(0x1e_97_00);
    for (let trial = 0; trial < 400; trial += 1) {
      const count = Math.floor(rand() * 6); // 0..5 kinds
      const kinds: string[] = [];
      for (let i = 0; i < count; i += 1) {
        // ~60% a real paying kind (with duplicates allowed), ~40% a zero-pay kind.
        kinds.push(rand() < 0.6
          ? KNOWN_KINDS[Math.floor(rand() * KNOWN_KINDS.length)] ?? 'kill_regulars'
          : ZERO_PAY_KINDS[Math.floor(rand() * ZERO_PAY_KINDS.length)] ?? 'not_a_kind');
      }
      expect(bountyForKinds(kinds), `trial ${trial}: ${JSON.stringify(kinds)}`).toBe(oracleBounty(kinds));
      // Breakdown folds to the same total, omits non-paying kinds, preserves order.
      const breakdown = bountyBreakdownForKinds(kinds);
      const breakdownSum = breakdown.reduce((sum, entry) => sum + entry.amount, 0);
      expect(breakdownSum, `breakdown fold trial ${trial}`).toBe(oracleBounty(kinds));
      expect(breakdown.length).toBe(kinds.filter((k) => CONTRACT_PAYS[k] !== undefined).length);
      for (const entry of breakdown) {
        expect(CONTRACT_PAYS[entry.kind]).toBe(entry.amount);
      }
    }
  });

  it('the disclosure for every encounter objective == bountyForKinds over its mapped kind', () => {
    // Every encounter objective announces exactly its mapped kind's amount.
    for (const objective of ENCOUNTER_OBJECTIVES) {
      const disclosed = bountyPreviewForEncounterObjective(objective);
      expect(disclosed).toBeGreaterThan(0);
      // The grant play would be: a victory completing that objective's kind.
      const kind = objective === 'defeat_all' ? 'kill_regulars'
        : objective === 'survive' ? 'survive_until'
        : objective === 'defeat_boss' ? 'kill_boss'
        : objective; // protect_object / complete_waves / heal_sustain share their kind name
      expect(disclosed, objective).toBe(bountyForKinds([kind]));
    }
    // A NON-encounter objective (destroy_object / bogus) discloses nothing —
    // even though destroy_object PAYS on grant, its disclosure is 0, so the UI
    // can never over-announce it (GRANTED-but-undisclosable).
    expect(bountyPreviewForEncounterObjective('destroy_object')).toBe(0);
    expect(bountyPreviewForEncounterObjective('not_a_kind')).toBe(0);
    expect(bountyPreviewForEncounterObjective('')).toBe(0);
  });

  it('committing ENGAGE with arbitrary random kind mixes grants exactly base + bounty, and only once', { timeout: 60_000 }, () => {
    const rand = mulberry32(0x5a_c0_21);
    const seeds = [1101, 1102, 1103, 1104, 1105];
    let engagements = 0;
    for (const seed of seeds) {
      const { exp: walked, nodeId } = walkToBattle(seed);
      const entered = walked.enter(`bf-enter-${String(seed)}`);
      const snap = entered.state.snapshots[nodeId];
      const rollSlots = snap !== undefined && snap.kind === 'REWARD' ? snap.rollSlots : {};
      const base = baseGold(rollSlots);
      const count = 1 + Math.floor(rand() * 5);
      const kinds: string[] = [];
      for (let i = 0; i < count; i += 1) {
        kinds.push(rand() < 0.6
          ? KNOWN_KINDS[Math.floor(rand() * KNOWN_KINDS.length)] ?? 'kill_regulars'
          : ZERO_PAY_KINDS[Math.floor(rand() * ZERO_PAY_KINDS.length)] ?? 'not_a_kind');
      }
      const expected = base + oracleBounty(kinds);
      const goldBefore = entered.state.gold;
      const committed = entered.act({ transactionId: `bf-engage-${String(seed)}`, nodeId, action: 'ENGAGE', completedKinds: kinds });
      // GRANT == base + the honest bounty, for EVERY random mix (unknown kinds pay 0).
      expect(committed.state.gold - goldBefore, `seed ${seed} kinds ${JSON.stringify(kinds)}`).toBe(expected);
      expect(committed.state.ledger[`bf-engage-${String(seed)}`]?.status).toBe('COMMITTED');
      engagements += 1;
      // The breakdown stored on the ledger reproduces the same total.
      expect(bountyForKinds(committed.state.ledger[`bf-engage-${String(seed)}`]?.completedKinds ?? [])).toBe(oracleBounty(kinds));
      // EXACTLY-ONCE: replaying the same ENGAGE grants nothing a second time.
      const replay = committed.act({ transactionId: `bf-engage-${String(seed)}`, nodeId, action: 'ENGAGE', completedKinds: kinds });
      expect(replay.state.gold).toBe(committed.state.gold);
      expect(replay.state.revision).toBe(committed.state.revision);
      // A second distinct ENGAGE is rejected and pays nothing.
      const second = committed.act({ transactionId: `bf-engage2-${String(seed)}`, nodeId, action: 'ENGAGE', completedKinds: kinds });
      expect(second.state.ledger[`bf-engage2-${String(seed)}`]?.status).toBe('REJECTED');
      expect(second.state.gold).toBe(committed.state.gold);
    }
    expect(engagements).toBe(seeds.length);
  });
});
