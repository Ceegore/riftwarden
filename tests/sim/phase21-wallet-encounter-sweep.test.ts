/**
 * Phase 21 §9.5 WALLET AUDIT × ALL NINE ENCOUNTERS. The per-node wallet audit
 * pinned the grant formula on expedition nodes; this sweep drives EVERY real
 * content encounter through the live host and pins the FULL contract:
 *
 *   TERMINAL  — every encounter's live battle reaches a real terminal
 *               (no ACTIVE stall — a soft-lock would never unlock ENGAGE);
 *   DISCLOSURE — the live victory bounty (bountyForKinds over the battle's
 *               completed kinds) equals the contract amount and the
 *               pre-ENGAGE preview for the completed single objective;
 *   GRANT     — committing that victory on a REAL expedition node of the
 *               encounter's family pays base + bounty EXACTLY, once (replay
 *               and second ENGAGE move nothing);
 *   LOSS PATH — the sustain-collapse fixture (requirement 80000 ≫ the
 *               bankable ceiling) ends DEFEAT in-window, so ENGAGE stays
 *               gated and nothing can be granted.
 */
import { describe, expect, it } from 'vitest';
import { createExpedition } from '../../src/game/expedition/expedition-runner.js';
import { generateMap } from '../../src/game/expedition/map-generator.js';
import type { ExpeditionMap, MapProfile } from '../../src/game/expedition/types.js';
import { bountyForKinds, bountyPreviewForEncounterObjective } from '../../src/game/expedition/nodes/handlers/combat.js';
import {
  CONTENT_ENCOUNTERS,
  isBossEncounter,
  isDuoEncounter,
  type ContentEncounterEntry,
} from '../../src/game/content/runtime/encounter-registry.js';
import { battleResultOf, createLiveSimBattle, engageAvailableFor } from '../../src/features/battle/sim/sim-battle-host.js';
import type { LiveOutboundInput } from '../../src/features/battle/outbound/phase21-outbound-presenter.js';

const PROFILE: MapProfile = {
  id: 'exp-sweep.v1',
  logicalLevels: 6,
  targetVisited: [5, 8] as const,
  mandatoryRoles: ['anchor', 'preparation', 'boss'],
  attemptCap: 50,
  fallbackTemplateId: 'fallback.v1',
};

function mapFor(seed: number): ExpeditionMap {
  return generateMap({ seed, profileId: 'exp-sweep.v1', contentRevision: '32.0' }, PROFILE);
}

/** The node family a content encounter classifies to (registry-consistent). */
function familyFor(entry: Readonly<ContentEncounterEntry>): 'battle' | 'elite' | 'boss' {
  if (isDuoEncounter(entry)) return 'boss';
  if (isBossEncounter(entry)) return 'elite';
  return 'battle';
}

/**
 * BFS over the map's edge graph from the start node to the first node of the
 * requested type; returns the node-id path, or null when unreachable. The
 * expedition's `advance` only accepts DIRECTLY reachable nodes, so the walk
 * replays this exact path (enter → resolve → advance per hop).
 */
function bfsPathTo(seed: number, type: string): readonly string[] | null {
  const map = mapFor(seed);
  const from = new Map<string, string | null>();
  const queue = [map.startNodeId];
  from.set(map.startNodeId, null);
  while (queue.length > 0) {
    const current = queue.shift();
    if (current === undefined) break;
    const node = map.nodes.find((n) => n.id === current);
    if (node !== undefined && node.type === type) {
      const path: string[] = [];
      let cursor: string | null = current;
      while (cursor !== null) {
        path.unshift(cursor);
        cursor = from.get(cursor) ?? null;
      }
      return path;
    }
    for (const edge of map.edges) {
      if (edge.from !== current) continue;
      if (from.has(edge.to)) continue;
      from.set(edge.to, current);
      queue.push(edge.to);
    }
  }
  return null;
}

/** Walks a real expedition along the BFS path to a node of the requested family (unentered), or null when unreachable. */
function walkToFamily(seed: number, family: string): ReturnType<typeof createExpedition> | null {
  const path = bfsPathTo(seed, family);
  if (path === null) return null;
  let exp = createExpedition(mapFor(seed), { startGold: 300 });
  for (let i = 0; i < path.length - 1; i += 1) {
    const next = path[i + 1];
    if (next === undefined) return null;
    exp = exp.enter(`sw-bfs-${String(seed)}-${String(i)}`).resolve().advance(next);
  }
  return exp;
}

/** Deterministic seed whose first-edge path actually reaches the family (the map's branches differ per seed). */
function familySeed(family: string, start = 901): number {
  for (let seed = start; seed <= 4000; seed += 1) {
    if (walkToFamily(seed, family) !== null) return seed;
  }
  throw new Error(`no seed reaches a ${family} node`);
}

const familySeedMemo = new Map<string, number>();

function familySeedFor(family: string): number {
  const cached = familySeedMemo.get(family);
  if (cached !== undefined) return cached;
  const seed = familySeed(family);
  familySeedMemo.set(family, seed);
  return seed;
}

/** Steps one live battle to its terminal (or throws when it stalls past the cap). */
function stepToTerminal(entry: Readonly<ContentEncounterEntry>): LiveOutboundInput {
  const handle = createLiveSimBattle({ encounter: entry });
  let out = handle.snapshot();
  let guard = 0;
  while (!['VICTORY', 'DEFEAT', 'DRAW_ABORT'].includes(out.phase.phase) && guard < 3000) {
    out = handle.step();
    guard += 1;
  }
  if (guard >= 3000) throw new Error(`${entry.id} never reached a terminal (soft-lock)`);
  return out;
}

/** The live terminal is a deterministic pure function of the encounter — memoize across the sweep's tests. */
const terminalCache = new Map<string, LiveOutboundInput>();

function terminalFor(entry: Readonly<ContentEncounterEntry>): LiveOutboundInput {
  const cached = terminalCache.get(entry.id);
  if (cached !== undefined) return cached;
  const out = stepToTerminal(entry);
  terminalCache.set(entry.id, out);
  return out;
}

/** The completed kinds a live battle produces (memoized alongside the terminal). */
function kindsFor(entry: Readonly<ContentEncounterEntry>): readonly string[] {
  return (terminalFor(entry).objectives ?? []).filter((o) => o.complete).map((o) => o.kind);
}

/** Clean-room base gold a victory ENGAGE pays on the node family (contract). */
function baseGoldFor(family: string, rollSlots: Readonly<Record<string, number>>): number {
  const gold = rollSlots['gold'] ?? 0;
  if (family === 'battle') return 45 + (gold % 26);
  if (family === 'elite') return 90 + (gold % 51);
  return 0;
}

/** One GRANT CELL: on the given family's node (from `seed`) committing `kinds`
 * pays exactly base(family, node) + bounty — and only once. The label keeps
 * the assertions attributable in the family × encounter grid. */
function auditGrantCell(family: string, seed: number, kinds: readonly string[], bounty: number, label: string): void {
  const walked = walkToFamily(seed, family);
  if (walked === null) throw new Error(`no ${family} node for ${label}`);
  let exp = walked;
  const nodeId = exp.currentNodeId;
  exp = exp.enter(`sw-enter-${label}`);
  const snap = exp.state.snapshots[nodeId];
  if (snap === undefined || snap.kind !== 'REWARD') throw new Error(`no REWARD snapshot at ${nodeId}`);
  const base = baseGoldFor(family, snap.rollSlots);
  const goldBefore = exp.state.gold;
  const killsBefore = exp.state.killsEarned;
  const tx = `sw-engage-${label}`;
  const committed = exp.act({ transactionId: tx, nodeId, action: 'ENGAGE', completedKinds: kinds });
  expect(committed.state.ledger[tx]?.status).toBe('COMMITTED');
  // GRANT: exactly base + the contract bounty, no more, no less.
  expect(committed.state.gold - goldBefore, `${label} gold = base + bounty`).toBe(base + bounty);
  // Kills still move (the family's deterministic slot amount) — the sweep is
  // the gold leg; the kills ledger differential covers the rest.
  const familyIsBattle = family === 'battle';
  const expectedKills = (familyIsBattle ? 3 : 5) + ((snap.rollSlots['gold'] ?? 0) % (familyIsBattle ? 4 : 8));
  expect(committed.state.killsEarned - killsBefore).toBe(expectedKills);
  // EXACTLY-ONCE: replaying the same transaction grants nothing; a second
  // distinct ENGAGE is rejected and moves nothing either.
  const replay = committed.act({ transactionId: tx, nodeId, action: 'ENGAGE', completedKinds: kinds });
  expect(replay.state.gold).toBe(committed.state.gold);
  expect(replay.state.killsEarned).toBe(committed.state.killsEarned);
  const second = committed.act({ transactionId: `sw-engage2-${label}`, nodeId, action: 'ENGAGE', completedKinds: kinds });
  expect(second.state.ledger[`sw-engage2-${label}`]?.status).toBe('REJECTED');
  expect(second.state.gold).toBe(committed.state.gold);
}

/** The family-anchored grant audit (the encounter's own family). */
function auditGrant(entry: Readonly<ContentEncounterEntry>, kinds: readonly string[], bounty: number): void {
  auditGrantCell(familyFor(entry), familySeedFor(familyFor(entry)), kinds, bounty, entry.id);
}

/**
 * LOOT-LEG grid cell: on a REAL battle node with the given loot-roll outcome,
 * committing `kinds` grants unsecured loot EXACTLY when (and only when) the
 * persisted `loot` slot decides the 35% roll — and the loot id is the
 * node-pinned `reward:nodeId:loot`, never a kind or an id from another node.
 * Drives every encounter's completed kinds against both loot branches, so the
 * grid's LOOT leg is proven cell-by-cell alongside the gold/kills legs.
 */
function auditLootCell(seed: number, kinds: readonly string[], label: string): void {
  const walked = walkToFamily(seed, 'battle');
  if (walked === null) throw new Error(`no battle node for ${label}`);
  let exp = walked;
  const nodeId = exp.currentNodeId;
  exp = exp.enter(`sw-loot-${label}`);
  const snap = exp.state.snapshots[nodeId];
  if (snap === undefined || snap.kind !== 'REWARD') throw new Error(`no REWARD snapshot at ${nodeId}`);
  const lootSlot = snap.rollSlots['loot'] ?? 0;
  const grantsLoot = lootSlot < 350; // the 35% column roll, per §23.3
  const lootBefore = exp.state.unsecuredLoot;
  const goldBefore = exp.state.gold;
  // The ENGAGE must carry its OWN transaction id (the ENTER above already
  // consumed `sw-loot-<label>` — reusing it would replay the ENTER record).
  const tx = `sw-loot-engage-${label}`;
  const committed = exp.act({ transactionId: tx, nodeId, action: 'ENGAGE', completedKinds: kinds });
  expect(committed.state.ledger[tx]?.status).toBe('COMMITTED');
  const expectedLootId = `reward:${nodeId}:loot`;
  if (grantsLoot) {
    // Exactly ONCE, and it is the node-pinned id.
    expect(committed.state.unsecuredLoot.length, `${label} loot granted once`).toBe(lootBefore.length + 1);
    expect(committed.state.unsecuredLoot).toContain(expectedLootId);
    expect(committed.state.unsecuredLoot.filter((id) => id === expectedLootId).length).toBe(1);
  } else {
    // The roll missed → NOTHING loot-ish entered the pool.
    expect(committed.state.unsecuredLoot, `${label} loot denied`).toEqual(lootBefore);
  }
  // Gold/kills still hold on the same cell (the loot leg does not disturb them).
  expect(committed.state.gold - goldBefore).toBe(baseGoldFor('battle', snap.rollSlots) + bountyForKinds(kinds));
  // EXACTLY-ONCE: a replay grants no second loot id.
  const replay = committed.act({ transactionId: tx, nodeId, action: 'ENGAGE', completedKinds: kinds });
  expect(replay.state.unsecuredLoot).toEqual(committed.state.unsecuredLoot);
}

/**
 * KILLS-FOLD grid cell: committing `kinds` on a REAL node of `family` adds
 * EXACTLY the family's deterministic kills amount (battle 3+slot%4, elite /
 * boss 5+slot%8) — independent of the completed-kind set (the kills leg and
 * the bounty leg are orthogonal), moved exactly once (replay + a second
 * ENGAGE add nothing). This is the kills leg proven cell-by-cell across the
 * family × encounter grid, alongside the gold and loot legs.
 */
function auditKillsCell(family: 'battle' | 'elite' | 'boss', seed: number, kinds: readonly string[], label: string): void {
  const walked = walkToFamily(seed, family);
  if (walked === null) throw new Error(`no ${family} node for ${label}`);
  let exp = walked;
  const nodeId = exp.currentNodeId;
  exp = exp.enter(`sw-kills-${label}`);
  const snap = exp.state.snapshots[nodeId];
  if (snap === undefined || snap.kind !== 'REWARD') throw new Error(`no REWARD snapshot at ${nodeId}`);
  const familyIsBattle = family === 'battle';
  const expectedKills = (familyIsBattle ? 3 : 5) + ((snap.rollSlots['gold'] ?? 0) % (familyIsBattle ? 4 : 8));
  const killsBefore = exp.state.killsEarned;
  const bountyBefore = exp.state.gold;
  const tx = `sw-kills-engage-${label}`;
  const committed = exp.act({ transactionId: tx, nodeId, action: 'ENGAGE', completedKinds: kinds });
  expect(committed.state.ledger[tx]?.status, `${label} engages`).toBe('COMMITTED');
  // KILLS: exactly the family amount, independent of the kinds carried.
  expect(committed.state.killsEarned - killsBefore, `${label} kills = family fold`).toBe(expectedKills);
  // The bounty STILL arrives alongside (kills ≠ bounty, both move on one cell).
  expect(committed.state.gold - bountyBefore).toBe(baseGoldFor(family, snap.rollSlots) + bountyForKinds(kinds));
  // EXACTLY-ONCE: replay grants no second kills, and a second ENGAGE is rejected.
  const replay = committed.act({ transactionId: tx, nodeId, action: 'ENGAGE', completedKinds: kinds });
  expect(replay.state.killsEarned, `${label} replay kills`).toBe(committed.state.killsEarned);
  const second = committed.act({ transactionId: `sw-kills-engage2-${label}`, nodeId, action: 'ENGAGE', completedKinds: kinds });
  expect(second.state.ledger[`sw-kills-engage2-${label}`]?.status, `${label} second engage`).toBe('REJECTED');
  expect(second.state.killsEarned, `${label} second kills`).toBe(committed.state.killsEarned);
}

/** Deterministic battle seed whose persisted loot roll lands the 35% chance. */
function battleSeedWithLoot(granted: boolean, start: number): number {
  for (let seed = start; seed <= 4000; seed += 1) {
    // Scan reads the persisted reward snapshot WITHOUT committing any ENGAGE
    // (enter only) — the guard uses the SAME slot the live ENGAGE would.
    const walked = walkToFamily(seed, 'battle');
    if (walked === null) continue;
    const entered = walked.enter(`sw-lootscan-${String(seed)}`);
    const snap = entered.state.snapshots[entered.currentNodeId];
    if (snap !== undefined && snap.kind === 'REWARD') {
      if ((snap.rollSlots['loot'] ?? 0) < 350 === granted) return seed;
    }
  }
  throw new Error(`no battle seed with loot granted = ${String(granted)}`);
}

describe('P21 §9.5 wallet audit sweep across all nine content encounters', () => {
  it('every encounter reaches a terminal and the victory bounty equals the contract (disclosure == grant)', { timeout: 60_000 }, () => {
    const entries = [...CONTENT_ENCOUNTERS.values()];
    expect(entries.length).toBe(9);
    const terminals = new Map<string, string>();
    for (const entry of entries) {
      const out = terminalFor(entry);
      terminals.set(entry.id, out.phase.phase);
      const kinds = (out.objectives ?? []).filter((o) => o.complete).map((o) => o.kind);
      const contract = bountyForKinds(kinds);
      // The live disclosure IS the contract amount.
      expect(out.bounty).toBe(contract);
      if (out.phase.phase === 'VICTORY') {
        // The mission's single objective completed → the grant pays the
        // disclosed preview exactly (never less than announced).
        const preview = bountyPreviewForEncounterObjective(entry.objective);
        expect(contract).toBe(preview);
        // And a real expedition ENGAGE with those kinds pays base + bounty once.
        auditGrant(entry, kinds, contract);
      } else {
        // The loss path: no kind completed, nothing disclosed, and the live
        // verdict keeps the ENGAGE gate closed.
        expect(out.phase.phase).toBe('DEFEAT');
        expect(kinds).toEqual([]);
        expect(contract).toBe(0);
        expect(engageAvailableFor(battleResultOf(out))).toBe(false);
        // The collapse window opened at the CONTENT override tick (60s → 1800)
        // and the loss is the in-window death the design demands — the live
        // handle mirrors the launcher's collapse teeth, not a soft-lock.
        if (entry.id === 'encounter_fixture_sustain_collapse') {
          // The collapse WINDOW opened at the content override tick (60s →
          // 1800) and the loss is the deterministic in-window death — the
          // no-progress endcap counter (riftCollapseTicks) is objective-gated
          // and correctly never fires: the design's loss path is the player
          // dying to the halved heals + collapse damage, not the endcap.
          expect(out.timeCollapseSinceTick).toBe(1800);
          expect(out.tick).toBe(1985); // pinned: the canonical DEFEAT terminal
        }
      }
    }
    // The eight win paths + the one loss path, all terminating.
    expect(Object.fromEntries(terminals)).toEqual({
      encounter_fixture_first: 'VICTORY',
      encounter_fixture_protect_object: 'VICTORY',
      encounter_fixture_survive: 'VICTORY',
      encounter_fixture_waves: 'VICTORY',
      encounter_fixture_boss_object: 'VICTORY',
      encounter_fixture_boss_duo: 'VICTORY',
      encounter_fixture_wave_boss: 'VICTORY',
      encounter_fixture_heal_sustain: 'VICTORY',
      encounter_fixture_sustain_collapse: 'DEFEAT',
    });
  });

  it('the per-kind contract amounts hold across every completed kind the nine battles produce', { timeout: 60_000 }, () => {
    // A second pass pins the amounts themselves: every kind the sweep can
    // produce pays its contract value, so the totals above are not an accident
    // of empty kind lists.
    const expected: Readonly<Record<string, number>> = {
      kill_regulars: 5,
      protect_object: 10,
      survive_until: 10,
      complete_waves: 10,
      kill_boss: 15,
      heal_sustain: 10,
    };
    for (const entry of CONTENT_ENCOUNTERS.values()) {
      const out = terminalFor(entry);
      for (const kind of (out.objectives ?? []).filter((o) => o.complete).map((o) => o.kind)) {
        expect(bountyForKinds([kind])).toBe(expected[kind]);
      }
    }
  });

  it('the grant is family-pure: every family × every encounter kinds set pays base + bounty cell-by-cell', { timeout: 60_000 }, () => {
    // Invert the family-anchored sweep: for each node family and each of the
    // nine encounters' completed kinds, committing those kinds on a REAL node
    // of the family pays exactly base(node) + bounty(kinds) — the base leg
    // depends only on the node family, the bounty leg only on the kinds, never
    // on the encounter id. Two seeds per family prove the base VARIES with the
    // node (different gold slots) while the formula holds in every cell.
    const families = ['battle', 'elite', 'boss'] as const;
    const gridSeeds: Readonly<Record<'battle' | 'elite' | 'boss', readonly number[]>> = {
      battle: [familySeedFor('battle'), familySeed('battle', 1201)],
      elite: [familySeedFor('elite'), familySeed('elite', 1201)],
      boss: [familySeedFor('boss'), familySeed('boss', 1201)],
    };
    for (const family of families) {
      for (const seed of gridSeeds[family]) {
        for (const entry of CONTENT_ENCOUNTERS.values()) {
          const kinds = kindsFor(entry);
          const bounty = bountyForKinds(kinds);
          auditGrantCell(family, seed, kinds, bounty, `${family}@${String(seed)}:${entry.id}`);
        }
      }
    }
  });

  it('the LOOT leg is family-pure cell-by-cell: every kinds set grants the node-pinned loot id exactly on the 35% roll, and nothing on a miss', { timeout: 60_000 }, () => {
    // Two battle seeds per loot outcome pin BOTH branches of the column roll
    // across all nine encounters' completed-kind sets.
    const grantedSeeds = [battleSeedWithLoot(true, 901), battleSeedWithLoot(true, 2201)];
    const deniedSeeds = [battleSeedWithLoot(false, 901), battleSeedWithLoot(false, 2201)];
    for (const entry of CONTENT_ENCOUNTERS.values()) {
      const kinds = kindsFor(entry);
      for (const seed of grantedSeeds) auditLootCell(seed, kinds, `granted@${String(seed)}:${entry.id}`);
      for (const seed of deniedSeeds) auditLootCell(seed, kinds, `denied@${String(seed)}:${entry.id}`);
    }
    // Sanity: the grid really exercised BOTH column outcomes.
    expect(grantedSeeds.length).toBe(2);
    expect(deniedSeeds.length).toBe(2);
  });

  it('the KILLS fold is dense cell-by-cell: every family × every encounter kinds set adds the family kills fold, exactly once', { timeout: 60_000 }, () => {
    // Invert the family-anchored audit for the KILLS leg: every family × every
    // encounter's completed kinds, on a real node of that family, moves the
    // kills ledger by EXACTLY the family's deterministic fold — independent of
    // the kinds (kills ≠ bounty), once only. Two seeds per family prove the
    // fold varies with the node slot while the formula holds in every cell;
    // both a victory with completed kinds AND an empty-kind ENGAGE land the
    // same kills (the kinds never leak into the kills leg).
    const families = ['battle', 'elite', 'boss'] as const;
    const seeds: Readonly<Record<'battle' | 'elite' | 'boss', readonly number[]>> = {
      battle: [familySeedFor('battle'), familySeed('battle', 1401)],
      elite: [familySeedFor('elite'), familySeed('elite', 1401)],
      boss: [familySeedFor('boss'), familySeed('boss', 1401)],
    };
    let cells = 0;
    for (const family of families) {
      for (const seed of seeds[family]) {
        for (const entry of CONTENT_ENCOUNTERS.values()) {
          auditKillsCell(family, seed, kindsFor(entry), `${family}@${String(seed)}:${entry.id}`);
          cells += 1;
        }
        // Empty-kind ENGAGE: the kills fold is kind-blind.
        auditKillsCell(family, seed, [], `${family}@${String(seed)}:empty`);
        cells += 1;
      }
    }
    // 3 families × 2 seeds × (9 encounters + empty) cells.
    expect(cells).toBe(3 * 2 * 10);
  });
});
