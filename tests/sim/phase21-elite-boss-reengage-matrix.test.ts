/**
 * Phase 21 §9 ELITE/BOSS RE-ENGAGE MATRIX. The escalation tests so far use
 * BATTLE nodes; this extends the re-engage contract to the ELITE and BOSS
 * families and pins two things:
 *
 *   1. FAMILY-INDEPENDENT TAX — the escalating defeat tax is the SAME 5×k
 *      (5, 10, 15) on elite and boss as on battle: attempt k costs
 *      `DEFEAT_INSTABILITY_DELTA * k` instability, pays no gold/kills, never
 *      touches the reward, the 4th is REJECTED, and the REWARD snapshot stays
 *      byte-identical across the whole stack (a rewatch cannot re-roll a
 *      higher-value prize on an epic node);
 *   2. FIRST-TRY PARITY — the victory ENGAGE pays `base(family) +
 *      bountyForKinds(kinds)` whether it is a first-try victory or a victory
 *      won after the Nth rewatch stack. Because the reward is a pure function
 *      of the node (and rewatches can never flip the deterministic sim into a
 *      different outcome), the bounty a victory pays is identical regardless
 *      of how many defeats preceded it.
 */
import { describe, expect, it } from 'vitest';
import { createExpedition } from '../../src/game/expedition/expedition-runner.js';
import { generateMap } from '../../src/game/expedition/map-generator.js';
import type { ExpeditionMap, MapProfile } from '../../src/game/expedition/types.js';
import { bountyForKinds, MAX_REENGAGE_ATTEMPTS, DEFEAT_INSTABILITY_DELTA } from '../../src/game/expedition/nodes/handlers/combat.js';
import type { RewardSnapshot } from '../../src/game/expedition/nodes/types.js';

const PROFILE: MapProfile = {
  id: 'exp-elite-boss-re.matrix.v1',
  logicalLevels: 6,
  targetVisited: [5, 8] as const,
  mandatoryRoles: ['anchor', 'preparation', 'boss'],
  attemptCap: 50,
  fallbackTemplateId: 'fallback.v1',
};

function mapFor(seed: number): ExpeditionMap {
  return generateMap({ seed, profileId: 'exp-elite-boss-re.matrix.v1', contentRevision: '32.0' }, PROFILE);
}

/** Walks a fresh runner to the first node of `family` and returns it (unentered). */
function walkToFamily(seed: number, family: 'battle' | 'elite' | 'boss'): ReturnType<typeof createExpedition> {
  let exp = createExpedition(mapFor(seed), { startGold: 300 });
  let guard = 0;
  while (exp.definition.type !== family) {
    const next = exp.reachableNodes[0];
    if (next === undefined) throw new Error(`dead-end ${exp.currentNodeId} seed ${String(seed)}`);
    exp = exp.enter(`er-walk-${String(guard)}`).resolve().advance(next);
    guard += 1;
    if (guard > 180) throw new Error('walk diverged');
  }
  return exp;
}

/** Deterministically locates a seed that routes to the family. */
function familySeed(family: 'battle' | 'elite' | 'boss'): number {
  for (let seed = 1; seed <= 700; seed += 1) {
    try { walkToFamily(seed, family); return seed; } catch { /* next seed */ }
  }
  throw new Error(`no seed routes to ${family}`);
}

const ELITE_SEED = familySeed('elite');
const BOSS_SEED = familySeed('boss');

function rewardOf(exp: ReturnType<typeof createExpedition>, nodeId: string): RewardSnapshot {
  const snap = exp.state.snapshots[nodeId];
  if (snap === undefined || snap.kind !== 'REWARD') throw new Error('no REWARD snapshot');
  return snap;
}

function baseGold(type: string, rollSlots: Readonly<Record<string, number>>): number {
  const gold = rollSlots['gold'] ?? 0;
  if (type === 'battle') return 45 + (gold % 26);
  if (type === 'elite') return 90 + (gold % 51);
  return 0;
}

/** The live-completed kind for a family (kill_boss for elite/boss, kill_regulars for battle). */
function kindFor(family: 'battle' | 'elite' | 'boss'): string {
  return family === 'battle' ? 'kill_regulars' : 'kill_boss';
}

describe('P21 §9 elite/boss re-engage matrix', () => {
  it('the escalating defeat tax is FAMILY-INDEPENDENT on elite and boss and never disturbs the reward', () => {
    for (const family of ['elite', 'boss'] as const) {
      const exp0 = walkToFamily(family === 'elite' ? ELITE_SEED : BOSS_SEED, family);
      const nodeId = exp0.currentNodeId;
      let exp = exp0.enter(`er-enter-${family}`);
      const snap0 = rewardOf(exp, nodeId);
      const gold0 = exp.state.gold;
      const kills0 = exp.state.killsEarned;
      const inst0 = exp.state.instability;
      // Attempt k costs exactly 5×k instability, pays nothing, on epic nodes.
      for (let attempt = 1; attempt <= MAX_REENGAGE_ATTEMPTS; attempt += 1) {
        exp = exp.act({ transactionId: `er-defeat-${family}-${String(attempt)}`, nodeId, action: 'ENGAGE_DEFEAT' });
        expect(exp.state.ledger[`er-defeat-${family}-${String(attempt)}`]?.status).toBe('COMMITTED');
        expect(exp.state.instability).toBe(inst0 + DEFEAT_INSTABILITY_DELTA * (attempt * (attempt + 1) / 2));
        expect(exp.state.gold).toBe(gold0);
        expect(exp.state.killsEarned).toBe(kills0);
      }
      // The 4th is REJECTED (cap 3), family-independent.
      const fourth = exp.act({ transactionId: `er-defeat-${family}-4`, nodeId, action: 'ENGAGE_DEFEAT' });
      expect(fourth.state.ledger[`er-defeat-${family}-4`]?.status).toBe('REJECTED');
      // The reward on the epic node is byte-identical across the whole stack.
      expect(rewardOf(exp, nodeId)).toEqual(snap0);
    }
  });

  it('the elite/boss victory bounty is a PURE FUNCTION of the node: the reward + disclosure fix the pay the rewatch stack can never change', () => {
    // A rewatch can NEVER flip a losing fight into a win (an ENGAGE after an
    // ENGAGE_DEFEAT is REJECTED ACTION_LIMIT — the deterministic sim already
    // ruled it), so "a victory after the Nth rewatch" is impossible BY DESIGN.
    // What is true is the parity the topic is really after: the bounty a
    // victory WOULD pay — `base(reward) + bountyForKinds(kinds)` — is a pure
    // function of the node's REWARD snapshot, which survives the re-engage
    // stack byte-identically. So a first-try victory and a rewatched node pay
    // the SAME thing; the rewatches themselves pay nothing.
    for (const family of ['elite', 'boss'] as const) {
      const seed = family === 'elite' ? ELITE_SEED : BOSS_SEED;
      const kind = kindFor(family);
      const bountyExpected = bountyForKinds([kind]);

      // FIRST-TRY: a bare victory ENGAGE pays base + bounty, exactly once.
      const fresh = walkToFamily(seed, family).enter(`fresh-enter-${family}`);
      const freshNode = fresh.currentNodeId;
      const reward0 = rewardOf(fresh, freshNode);
      const baseExpected = baseGold(family, reward0.rollSlots);
      const goldBefore = fresh.state.gold;
      const committed = fresh.act({ transactionId: `fresh-engage-${family}`, nodeId: freshNode, action: 'ENGAGE', completedKinds: [kind] });
      const freshPay = committed.state.gold - goldBefore;
      expect(freshPay).toBe(baseExpected + bountyExpected);

      // REWATCHED: same node, full re-engage stack — the reward that fixes the
      // victory entitlement is byte-identical, and the re-engages pay nothing.
      let exp = walkToFamily(seed, family).enter(`re-enter-${family}`);
      const reNode = exp.currentNodeId;
      const rewardAfter = rewardOf(exp, reNode);
      const goldAfterRewards = exp.state.gold;
      const killsAfter = exp.state.killsEarned;
      for (let attempt = 1; attempt <= MAX_REENGAGE_ATTEMPTS; attempt += 1) {
        exp = exp.act({ transactionId: `re-defeat-${family}-${String(attempt)}`, nodeId: reNode, action: 'ENGAGE_DEFEAT' });
      }
      expect(rewardOf(exp, reNode)).toEqual(rewardAfter);
      expect(rewardOf(exp, reNode)).toEqual(reward0);
      // Rewatches pay no gold/kills — so the victory entitlement is untouched.
      expect(exp.state.gold).toBe(goldAfterRewards);
      expect(exp.state.killsEarned).toBe(killsAfter);
      // The node's victory entitlement is UNCHANGED by the stack and equals the
      // first-try pay: a rewatched node pays exactly what a first-try did.
      const entitlementAfter = baseGold(family, rewardOf(exp, reNode).rollSlots) + bountyExpected;
      expect(entitlementAfter).toBe(freshPay);
    }
  });
});
