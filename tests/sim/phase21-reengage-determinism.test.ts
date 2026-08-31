/**
 * Phase 21 §9 RE-ENGAGE × REWARD-SNAPSHOT DETERMINISM. A lost fight only
 * re-watches the SAME deterministic sim (ENGAGE_DEFEAT commits a rewatch; the
 * fight can never flip into a win), so the reward the node would pay is decided
 * by the PERSISTED REWARD snapshot — never re-rolled and never disturbed by the
 * re-engages. Pinned here:
 *
 *   1. the REWARD snapshot is byte-identical after every re-engage (a rewatch
 *      cannot mutate the stored reward);
 *   2. re-engages never pay gold/kills and never clear the snapshot — only the
 *      escalating instability tax moves;
 *   3. the snapshot is a deterministic function of the node: two fresh ENTERs
 *      on the same seed produce byte-identical reward snapshots;
 *   4. the re-watched BATTLE is a deterministic re-simulation: two live battle
 *      handles from the same encounter step tick-for-tick to the SAME terminal
 *      (phase, completed objective kinds, bounty) — the rewatch replays the
 *      identical fight, so the reward stays a pure function of the snapshot.
 */
import { describe, expect, it } from 'vitest';
import { createExpedition } from '../../src/game/expedition/expedition-runner.js';
import { generateMap } from '../../src/game/expedition/map-generator.js';
import type { ExpeditionMap, MapProfile } from '../../src/game/expedition/types.js';
import { createLiveSimBattle, resolveExpeditionEncounter } from '../../src/features/battle/sim/sim-battle-host.js';
import { MAX_REENGAGE_ATTEMPTS } from '../../src/game/expedition/nodes/handlers/combat.js';
import type { RewardSnapshot } from '../../src/game/expedition/nodes/types.js';
import type { LiveOutboundInput } from '../../src/features/battle/outbound/phase21-outbound-presenter.js';

const PROFILE: MapProfile = {
  id: 'exp-reengage.v1',
  logicalLevels: 6,
  targetVisited: [5, 8] as const,
  mandatoryRoles: ['anchor', 'preparation', 'boss'],
  attemptCap: 50,
  fallbackTemplateId: 'fallback.v1',
};

function mapFor(seed: number): ExpeditionMap {
  return generateMap({ seed, profileId: 'exp-reengage.v1', contentRevision: '32.0' }, PROFILE);
}

/** Declares the battle's win for the ledger so the CLAIM path is reachable (helper of last resort). */
function walkToCombat(seed: number): ReturnType<typeof createExpedition> {
  let exp = createExpedition(mapFor(seed), { startGold: 300 });
  let guard = 0;
  while (!['battle', 'elite', 'boss'].includes(exp.definition.type)) {
    const next = exp.reachableNodes[0];
    if (next === undefined) throw new Error(`dead-end at ${exp.currentNodeId}`);
    exp = exp.enter(`re-walk-${String(guard)}`).resolve().advance(next);
    guard += 1;
    if (guard > 150) throw new Error('walk diverged');
  }
  return exp;
}

function rewardOf(exp: ReturnType<typeof createExpedition>, nodeId: string): RewardSnapshot {
  const snap = exp.state.snapshots[nodeId];
  if (snap === undefined || snap.kind !== 'REWARD') throw new Error('no REWARD snapshot');
  return snap;
}

describe('P21 §9 re-engage × reward-snapshot determinism', () => {
  it('a REWARD snapshot is byte-identical across every ENGINE_DEFEAT rewatch', () => {
    const seed = 801;
    let exp = walkToCombat(seed);
    const nodeId = exp.currentNodeId;
    exp = exp.enter('re-enter');
    const snapshot0 = rewardOf(exp, nodeId);
    const gold0 = exp.state.gold;
    const kills0 = exp.state.killsEarned;
    const inst0 = exp.state.instability;
    let instability = inst0;
    let gold = gold0;
    for (let attempt = 0; attempt < MAX_REENGAGE_ATTEMPTS; attempt += 1) {
      exp = exp.act({ transactionId: `re-lost-${String(attempt)}`, nodeId, action: 'ENGAGE_DEFEAT' });
      expect(exp.state.ledger[`re-lost-${String(attempt)}`]?.status).toBe('COMMITTED');
      // A rewatch never touches the stored reward.
      expect(rewardOf(exp, nodeId)).toEqual(snapshot0);
      // A rewatch pays no gold and no kills — only the escalating tax.
      expect(exp.state.gold).toBe(gold);
      expect(exp.state.killsEarned).toBe(kills0);
      instability += 5 * (attempt + 1);
      expect(exp.state.instability).toBe(instability);
      gold = exp.state.gold;
    }
    // After the full re-engage stack the snapshot is still the original.
    expect(rewardOf(exp, nodeId)).toEqual(snapshot0);
  });

  it('the reward snapshot is a DETERMINISTIC function of the node (two ENTERs agree byte-for-byte)', () => {
    const seed = 802;
    const nodeId = walkToCombat(seed).currentNodeId;
    const a = rewardOf(walkToCombat(seed).enter('re-a-enter'), nodeId);
    const b = rewardOf(walkToCombat(seed).enter('re-b-enter'), nodeId);
    expect(b).toEqual(a);
    expect(a.kind).toBe('REWARD');
    // The claim options and roll slots are also deterministic.
    expect(a.rewardIds).toEqual(b.rewardIds);
    expect(a.rollSlots).toEqual(b.rollSlots);
  });

  it('the re-watched battle is a deterministic re-simulation: two live handles step identically', { timeout: 60_000 }, () => {
    // Two independent handles for the SAME encounter run the identical kernel
    // battle tick-for-tick to the identical terminal — the rewatch can never
    // re-litigate the deterministic outcome.
    let exp = walkToCombat(804);
    const encounter = resolveExpeditionEncounter(exp.definition.type, exp.definition.payloadKey);
    if (encounter === null) throw new Error('no encounter');
    const a = createLiveSimBattle({ encounter });
    const b = createLiveSimBattle({ encounter });
    let oa = a.snapshot();
    let ob = b.snapshot();
    const tickBucket = (o: LiveOutboundInput): string =>
      `${o.phase.phase}|${String(o.bounty ?? 0)}|${(o.objectives ?? []).map((x) => `${x.id}:${x.complete ? '1' : '0'}:${String(x.progress)}`).join(',')}`;
    expect(tickBucket(oa)).toBe(tickBucket(ob));
    let guard = 0;
    while (!['VICTORY', 'DEFEAT', 'DRAW_ABORT'].includes(oa.phase.phase) && guard < 2000) {
      oa = a.step();
      ob = b.step();
      expect(tickBucket(oa)).toBe(tickBucket(ob));
      guard += 1;
    }
    expect(oa.phase.phase).toBe(ob.phase.phase);
    expect(oa.bounty).toBe(ob.bounty);
    expect(oa.objectives).toEqual(ob.objectives);
  });
});
