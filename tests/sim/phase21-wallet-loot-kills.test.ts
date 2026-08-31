/**
 * Phase 21 §9 wallet audit — LOOT + KILLS alongside gold. The bounty wallet
 * audit pinned the GOLD grant (`base(snapshot) + bountyForKinds(kinds)`), but a
 * victory ENGAGE moves THREE ledgers, not one: gold, unsecured loot (a battle's
 * 35% chance, decided once by the persisted `loot` roll slot) and kills
 * (deterministic from the persisted `gold` roll slot). This audit drives the
 * REAL runner and checks all three against an independent clean-room oracle:
 *
 *   gold  = base(snapshot) + bountyForKinds(kinds)          [king; already pinned]
 *   loot  = battle && (loot slot < 350 permille)  → grants reward:nodeId:loot
 *   kills = (battle ? 3 : 5) + (gold slot % (battle ? 4 : 8))
 *
 * A replay of the same transaction grants NOTHING again — gold, loot and kills
 * all stay frozen; a second ENGAGE is rejected. Elite/boss battles never grant
 * the loot roll (only battle carries the 35% chance).
 */
import { describe, expect, it } from 'vitest';
import { createExpedition } from '../../src/game/expedition/expedition-runner.js';
import { generateMap } from '../../src/game/expedition/map-generator.js';
import type { ExpeditionMap, MapProfile } from '../../src/game/expedition/types.js';
import { bountyForKinds } from '../../src/game/expedition/nodes/handlers/combat.js';
import type { RewardSnapshot } from '../../src/game/expedition/nodes/types.js';

const PROFILE: MapProfile = {
  id: 'exp-loot-kills.v1',
  logicalLevels: 6,
  targetVisited: [5, 8] as const,
  mandatoryRoles: ['anchor', 'preparation', 'boss'],
  attemptCap: 50,
  fallbackTemplateId: 'fallback.v1',
};

function mapFor(seed: number): ExpeditionMap {
  return generateMap({ seed, profileId: 'exp-loot-kills.v1', contentRevision: '32.0' }, PROFILE);
}

function walkToType(seed: number, predicate: (type: string) => boolean): { exp: ReturnType<typeof createExpedition>; nodeId: string; type: string } {
  let exp = createExpedition(mapFor(seed), { startGold: 300 });
  let guard = 0;
  while (!predicate(exp.definition.type)) {
    const next = exp.reachableNodes[0];
    if (next === undefined) throw new Error(`dead-end ${exp.currentNodeId} seed ${String(seed)}`);
    exp = exp.enter(`lk-walk-${String(guard)}`).resolve().advance(next);
    guard += 1;
    if (guard > 150) throw new Error('walk diverged');
  }
  return { exp, nodeId: exp.currentNodeId, type: exp.definition.type };
}

function aCombatNode(seed: number, family: 'battle' | 'eliteboss'): { exp: ReturnType<typeof createExpedition>; nodeId: string; type: string } {
  return walkToType(seed, (t) => family === 'battle' ? t === 'battle' : t === 'elite' || t === 'boss');
}

/** Clean-room oracle: the kills a victory ENGAGE grants, from the persisted gold slot. */
function oracleKills(type: string, rollSlots: Readonly<Record<string, number>>): number {
  const two = type === 'battle';
  return (two ? 3 : 5) + ((rollSlots['gold'] ?? 0) % (two ? 4 : 8));
}

/** Clean-room oracle: does this battle grant the unsecured loot roll? */
function oracleLootGranted(type: string, rollSlots: Readonly<Record<string, number>>): boolean {
  return type === 'battle' && (rollSlots['loot'] ?? 0) < 350;
}

function oracleBaseGold(type: string, rollSlots: Readonly<Record<string, number>>): number {
  const gold = rollSlots['gold'] ?? 0;
  if (type === 'battle') return 45 + (gold % 26);
  if (type === 'elite') return 90 + (gold % 51);
  return 0;
}

function committedReward(node: { exp: ReturnType<typeof createExpedition>; nodeId: string; type: string }): RewardSnapshot {
  const snap = node.exp.state.snapshots[node.nodeId];
  if (snap === undefined || snap.kind !== 'REWARD') throw new Error('no REWARD snapshot');
  return snap;
}

/** Commits one victory ENGAGE on a combat node and audits gold + loot + kills against the oracle. */
function auditCombatNode(seed: number, family: 'battle' | 'eliteboss', kinds: readonly string[]): void {
  const node = aCombatNode(seed, family);
  const { exp: walked, nodeId, type } = node;
  const entered = walked.enter(`lk-enter-${String(seed)}`);
  const snapshot = committedReward({ exp: entered, nodeId, type });
  const rollSlots = snapshot.rollSlots;
  const goldBefore = entered.state.gold;
  const killsBefore = entered.state.killsEarned;
  const lootBefore = entered.state.unsecuredLoot;
  const expectedKills = oracleKills(type, rollSlots);
  const expectedLoot = oracleLootGranted(type, rollSlots);
  const lootId = `reward:${nodeId}:loot`;

  const committed = entered.act({ transactionId: `lk-engage-${String(seed)}`, nodeId, action: 'ENGAGE', completedKinds: kinds });
  const s = committed.state;
  // Gold: exactly base + bounty (isolates the loot/kills legs).
  expect(s.gold - goldBefore).toBe(oracleBaseGold(type, rollSlots) + bountyForKinds(kinds));
  // Loot: if the roll slots grant it, exactly reward:nodeId:loot lands in the
  // unsecured pool; otherwise NOTHING loot-related changes.
  if (expectedLoot) {
    expect(s.unsecuredLoot.length).toBe(lootBefore.length + 1);
    expect(s.unsecuredLoot).toContain(lootId);
  } else {
    expect(s.unsecuredLoot).toEqual(lootBefore);
  }
  // Kills: the deterministic gold-slot amount, no more, no less.
  expect(s.killsEarned - killsBefore).toBe(expectedKills);

  // EXACTLY-ONCE: replaying the same transaction grants nothing again.
  const replay = committed.act({ transactionId: `lk-engage-${String(seed)}`, nodeId, action: 'ENGAGE', completedKinds: kinds });
  expect(replay.state.revision).toBe(committed.state.revision);
  expect(replay.state.gold).toBe(committed.state.gold);
  expect(replay.state.killsEarned).toBe(committed.state.killsEarned);
  expect(replay.state.unsecuredLoot).toEqual(committed.state.unsecuredLoot);
  // A second distinct ENGAGE is rejected and moves nothing.
  const second = committed.act({ transactionId: `lk-engage2-${String(seed)}`, nodeId, action: 'ENGAGE', completedKinds: kinds });
  expect(second.state.ledger[`lk-engage2-${String(seed)}`]?.status).toBe('REJECTED');
  expect(second.state.gold).toBe(committed.state.gold);
  expect(second.state.killsEarned).toBe(committed.state.killsEarned);
  expect(second.state.unsecuredLoot).toEqual(committed.state.unsecuredLoot);
}

/** Deterministically finds a battle-node seed whose 35% loot roll grants loot. */
function battleSeedWhere(granted: boolean, lowerBound: number): number {
  for (let seed = lowerBound; seed <= 900; seed += 1) {
    try {
      const node = aCombatNode(seed, 'battle');
      const entered = node.exp.enter(`lk-scan-${String(seed)}`);
      const snap = committedReward({ exp: entered, nodeId: node.nodeId, type: node.type });
      if (oracleLootGranted('battle', snap.rollSlots) === granted) return seed;
    } catch {
      // try next seed
    }
  }
  throw new Error(`no battle seed with lootGranted=${String(granted)}`);
}

describe('P21 §9 wallet audit: loot + kills beside gold', () => {
  it('a battle victory grants exactly base gold + kills, plus the loot roll only when the slot lands it', () => {
    // Both loot branches, pinned from real seeds (loot is seed-deterministic).
    const grantedSeed = battleSeedWhere(true, 1);
    const deniedSeed = battleSeedWhere(false, 900);
    auditCombatNode(grantedSeed, 'battle', ['kill_regulars']);
    auditCombatNode(deniedSeed, 'battle', []);
    // Every seed in a wide sweep holds the oracle for the battle family.
    for (const seed of [900, 901, 902, 903, 904]) {
      auditCombatNode(seed, 'battle', ['kill_regulars']);
    }
  });

  it('an elite / boss victory grants base gold + kills but NEVER the loot roll (only battle carries it)', () => {
    // Elite/boss pass the same wallet audit; the loot oracle is always false.
    auditCombatNode(905, 'eliteboss', ['kill_boss']);
    auditCombatNode(906, 'eliteboss', []);
    auditCombatNode(907, 'eliteboss', ['kill_boss']);
  });
});
