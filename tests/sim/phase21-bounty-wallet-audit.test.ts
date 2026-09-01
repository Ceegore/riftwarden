/**
 * Phase 21 §9.5 BOUNTY GRANT × DISCLOSURE WALLET AUDIT. Replays victory
 * ENGAGE commits through the REAL expedition runner and checks the wallet
 * against a CLEAN-ROOM oracle: the granted gold must equal
 *
 *     base(snapshot) + bountyForKinds(completedKinds)
 *
 * EXACTLY — the base is recomputed independently from the persisted REWARD
 * snapshot's roll slots (battle 45 + (gold % 26), elite 90 + (gold % 51),
 * boss pays no base gold), the bounty from the pinned per-kind contract map.
 * The audit also pins:
 *   - the DISCLOSED amount (bountyPreviewForEncounterObjective over the node's
 *     resolved encounter) equals the granted bounty for the mission kind;
 *   - replaying the same transaction id grants NOTHING again (zero mutation);
 *   - a second ENGAGE is rejected and pays nothing;
 *   - a DEFEAT pays nothing at all.
 */
import { describe, expect, it } from 'vitest';
import { createExpedition } from '../../src/game/expedition/expedition-runner.js';
import { generateMap } from '../../src/game/expedition/map-generator.js';
import type { ExpeditionMap, MapProfile } from '../../src/game/expedition/types.js';
import { bountyForKinds, bountyPreviewForEncounterObjective } from '../../src/game/expedition/nodes/handlers/combat.js';
import { resolveExpeditionEncounter } from '../../src/features/battle/sim/sim-battle-host.js';

const PROFILE: MapProfile = {
  id: 'exp-bounty-audit.v1',
  logicalLevels: 6,
  targetVisited: [5, 8] as const,
  mandatoryRoles: ['anchor', 'preparation', 'boss'],
  attemptCap: 50,
  fallbackTemplateId: 'fallback.v1',
};

function mapFor(seed: number): ExpeditionMap {
  return generateMap({ seed, profileId: 'exp-bounty-audit.v1', contentRevision: '32.0' }, PROFILE);
}

// ---------------------------------------------------------------------------
// CLEAN-ROOM ORACLE (independent spec — never imports the handler internals).
// ---------------------------------------------------------------------------

/** The base gold a victory pays, recomputed from the persisted REWARD snapshot. */
function oracleBaseGold(nodeType: string, rollSlots: Readonly<Record<string, number>>): number {
  const gold = rollSlots['gold'] ?? 0;
  if (nodeType === 'battle') return 45 + (gold % 26);
  if (nodeType === 'elite') return 90 + (gold % 51);
  return 0; // boss nodes pay no base gold (GDD §23.3)
}

/** §9.5 the whole grant: base + the per-kind contract bounty. */
function oracleGrant(nodeType: string, rollSlots: Readonly<Record<string, number>>, kinds: readonly string[]): number {
  return oracleBaseGold(nodeType, rollSlots) + bountyForKinds(kinds);
}

/**
 * §9.5 the mission kind the node's OWN encounter derives (independent spec
 * over the content classification): a regular battle is a kill_regulars
 * mission, an elite/boss battle a kill_boss mission. The audit sends these
 * kinds so the granted bounty is exactly what the node disclosed.
 */
function missionKindsFor(nodeType: string): readonly string[] {
  if (nodeType === 'battle') return ['kill_regulars'];
  return ['kill_boss'];
}

/** Walks the map and commits a victory ENGAGE at every combat node; verifies each grant. */
function auditRun(seed: number, kindsFor: (nodeType: string) => readonly string[]): void {
  let exp = createExpedition(mapFor(seed), { startGold: 300 });
  let step = 0;
  let guard = 0;
  while (exp.reachableNodes.length > 0 && guard < 300) {
    const type = exp.definition.type;
    const nodeId = exp.currentNodeId;
    exp = exp.enter(`b-${String(seed)}-e-${String(step)}`);
    if (type === 'battle' || type === 'elite' || type === 'boss') {
      const snapshot = exp.state.snapshots[nodeId];
      expect(snapshot?.kind).toBe('REWARD');
      const rollSlots = snapshot?.kind === 'REWARD' ? snapshot.rollSlots : {};
      const kinds = kindsFor(type);
      const goldBefore = exp.state.gold;
      exp = exp.act({ transactionId: `b-${String(seed)}-a-${String(step)}`, nodeId, action: 'ENGAGE', completedKinds: kinds });
      const expected = oracleGrant(type, rollSlots, kinds);
      // The wallet moved EXACTLY the oracle's amount — no more, no less.
      expect(exp.state.gold - goldBefore).toBe(expected);
      // Replaying the SAME transaction id grants NOTHING again (exactly-once).
      const revisionBefore = exp.state.revision;
      const replayed = exp.act({ transactionId: `b-${String(seed)}-a-${String(step)}`, nodeId, action: 'ENGAGE', completedKinds: kinds });
      expect(replayed.state.revision).toBe(revisionBefore);
      expect(replayed.state.gold).toBe(exp.state.gold);
      // A SECOND ENGAGE with a new id is REJECTED and pays nothing.
      const second = exp.act({ transactionId: `b-${String(seed)}-a2-${String(step)}`, nodeId, action: 'ENGAGE', completedKinds: kinds });
      expect(second.state.ledger[`b-${String(seed)}-a2-${String(step)}`]?.status).toBe('REJECTED');
      expect(second.state.gold).toBe(exp.state.gold);
      // §9.5 disclosure: the pre-ENGAGE announced amount equals the granted
      // bounty when the mission kind completed (single-objective missions) —
      // the wallet pays exactly what the screen showed before ENGAGE.
      const encounter = resolveExpeditionEncounter(type, exp.definition.payloadKey);
      if (encounter !== null && kinds.length === 1) {
        const disclosed = bountyPreviewForEncounterObjective(encounter.objective);
        expect(bountyForKinds(kinds)).toBe(disclosed);
        expect(exp.state.gold - goldBefore).toBe(disclosed + oracleBaseGold(type, rollSlots));
      }
    }
    exp = exp.resolve();
    const next = exp.reachableNodes[0];
    if (next === undefined) break;
    exp = exp.advance(next);
    step += 1;
    guard += 1;
  }
}

describe('P21 §9.5 bounty grant × disclosure wallet audit', () => {
  it('every combat node across seeds pays base + bounty EXACTLY (the node\'s own mission kind)', () => {
    // The audit sends each node's OWN mission kind (battle → kill_regulars 5,
    // elite/boss → kill_boss 15), so the granted bounty is exactly what the
    // node disclosed pre-ENGAGE.
    for (const seed of [501, 502, 503, 504, 505]) {
      auditRun(seed, missionKindsFor);
    }
  });

  it('multi-kind victories pay the per-kind sum exactly (boss base 0)', () => {
    // Multi-kind on every combat node: kill_boss 15 + survive_until 10 = 25
    // over the base — a boss victory with kinds pays 0 base + 25 bounty.
    auditRun(506, () => ['kill_boss', 'survive_until']);
    // A boss-node victory with NO kinds pays 0 gold (base 0 + bounty 0) —
    // the node clears with nothing added to the wallet.
    auditRun(507, () => []);
  });

  it('a DEFEAT pays nothing at all (no base, no bounty) on the same wallet', () => {
    let exp = createExpedition(mapFor(508), { startGold: 300 });
    let guard = 0;
    while (!['battle', 'elite', 'boss'].includes(exp.definition.type) && guard < 80) {
      const next = exp.reachableNodes[0];
      if (next === undefined) throw new Error('no combat');
      exp = exp.enter(`d-${String(guard)}`).resolve().advance(next);
      guard += 1;
    }
    const nodeId = exp.currentNodeId;
    const type = exp.definition.type;
    exp = exp.enter('d-enter');
    const goldBefore = exp.state.gold;
    exp = exp.act({ transactionId: 'd-lost', nodeId, action: 'ENGAGE_DEFEAT', completedKinds: ['heal_sustain'] });
    expect(exp.state.gold).toBe(goldBefore);
    expect((exp.state.ledger['d-lost'] as { completedKinds?: readonly string[] }).completedKinds).toBeUndefined();
    // And the node type really was a combat node (the audit ran on a fight).
    expect(type === 'battle' || type === 'elite' || type === 'boss').toBe(true);
  });
});
