/**
 * Phase 21 §9.5 MISSION-KIND MATRIX — ELITE / BOSS PROJECTION. A combat
 * node's pre-ENGAGE disclosure (`bountyPreviewForEncounterObjective` over the
 * node's resolved content encounter) announces exactly the per-kind bounty the
 * victory is contractually owed. This matrix cross-checks the mapping across
 * the three node families and proves disclosure == GRANT end-to-end:
 *
 *   battle → encounter_fixture_first      (defeat_all → kill_regulars,  5)
 *   elite  → encounter_fixture_boss_object(defeat_boss → kill_boss,    15)
 *   boss   → encounter_fixture_boss_duo   (defeat_boss → kill_boss,    15)
 *
 * For each cell:  disclosed == bountyForKinds(mapped kind) == the LIVE battle's
 * completion bounty == the gold the victory ENGAGE actually grants (over the
 * family's base). The elite and boss (single- and duo-boss) projections are
 * the focus — a multi-objective or unknown-kind cell must never pay more than
 * it discloses.
 */
import { describe, expect, it } from 'vitest';
import { createExpedition } from '../../src/game/expedition/expedition-runner.js';
import { generateMap } from '../../src/game/expedition/map-generator.js';
import type { ExpeditionMap, MapProfile } from '../../src/game/expedition/types.js';
import { createLiveSimBattle, resolveExpeditionEncounter } from '../../src/features/battle/sim/sim-battle-host.js';
import { bountyForKinds, bountyPreviewForEncounterObjective } from '../../src/game/expedition/nodes/handlers/combat.js';

const PROFILE: MapProfile = {
  id: 'exp-kind-matrix.v1',
  logicalLevels: 6,
  targetVisited: [5, 8] as const,
  mandatoryRoles: ['anchor', 'preparation', 'boss'],
  attemptCap: 50,
  fallbackTemplateId: 'fallback.v1',
};

function mapFor(seed: number): ExpeditionMap {
  return generateMap({ seed, profileId: 'exp-kind-matrix.v1', contentRevision: '32.0' }, PROFILE);
}

function walkToFamily(seed: number, family: 'battle' | 'elite' | 'boss'): ReturnType<typeof createExpedition> {
  let exp = createExpedition(mapFor(seed), { startGold: 300 });
  let guard = 0;
  while (exp.definition.type !== family) {
    const next = exp.reachableNodes[0];
    if (next === undefined) throw new Error(`dead-end ${exp.currentNodeId} seed ${String(seed)}`);
    exp = exp.enter(`km-walk-${String(guard)}`).resolve().advance(next);
    guard += 1;
    if (guard > 180) throw new Error('walk diverged');
  }
  return exp;
}

/** Runs one family's resolved live battle and returns { disclosed, kinds, bounty, terminalPhase }. */
function liveCell(family: 'battle' | 'elite' | 'boss'): { disclosed: number; kind: string; kinds: readonly string[]; bounty: number; phase: string; encounterId: string } {
  const node = familySeed(family).exp;
  const encounter = resolveExpeditionEncounter(family, node.definition.payloadKey);
  if (encounter === null) throw new Error(`family ${family} resolved no encounter`);
  const disclosed = bountyPreviewForEncounterObjective(encounter.objective);
  const kind = encounter.objective === 'defeat_boss' ? 'kill_boss' : encounter.objective === 'defeat_all' ? 'kill_regulars' : 'unknown';
  const handle = createLiveSimBattle({ encounter });
  let out = handle.snapshot();
  let guard = 0;
  while (!['VICTORY', 'DEFEAT', 'DRAW_ABORT'].includes(out.phase.phase) && guard < 2500) {
    out = handle.step();
    guard += 1;
  }
  const kinds = (out.objectives ?? []).filter((o) => o.complete).map((o) => o.kind);
  return { disclosed, kind, kinds, bounty: out.bounty ?? 0, phase: out.phase.phase, encounterId: encounter.id };
}

/** Deterministically locates a node of the family and returns the runner positioned there (unentered). */
function familySeed(family: 'battle' | 'elite' | 'boss'): { exp: ReturnType<typeof createExpedition>; nodeId: string } {
  for (let seed = 1; seed <= 700; seed += 1) {
    try {
      const node = walkToFamily(seed, family);
      return { exp: node, nodeId: node.currentNodeId };
    } catch {
      // try next seed
    }
  }
  throw new Error(`no seed routes to a ${family} node`);
}

function baseGold(type: string, rollSlots: Readonly<Record<string, number>>): number {
  const gold = rollSlots['gold'] ?? 0;
  if (type === 'battle') return 45 + (gold % 26);
  if (type === 'elite') return 90 + (gold % 51);
  return 0;
}

describe('P21 §9.5 elite/boss mission-kind matrix', () => {
  it('the family projection maps each node encounter to the disclosed kind + amount (contract)', () => {
    // Pure projection matrix — no battle needed.
    const cells = Object.freeze<{ family: 'battle' | 'elite' | 'boss'; id: string; obj: string; kind: string; amount: number }[]>([
      { family: 'battle', id: 'encounter_fixture_first', obj: 'defeat_all', kind: 'kill_regulars', amount: 5 },
      { family: 'elite', id: 'encounter_fixture_boss_object', obj: 'defeat_boss', kind: 'kill_boss', amount: 15 },
      { family: 'boss', id: 'encounter_fixture_boss_duo', obj: 'defeat_boss', kind: 'kill_boss', amount: 15 },
    ]);
    for (const cell of cells) {
      const encounter = resolveExpeditionEncounter(cell.family, 'enemy_fixture_echo');
      expect(encounter?.id).toBe(cell.id);
      expect(encounter?.objective).toBe(cell.obj);
      // disclosed == the per-kind contract amount == bountyForKinds over it.
      expect(bountyPreviewForEncounterObjective(cell.obj)).toBe(cell.amount);
      expect(bountyForKinds([cell.kind])).toBe(cell.amount);
      expect(bountyPreviewForEncounterObjective(cell.obj)).toBe(bountyForKinds([cell.kind]));
    }
    // Covered cells: the kind names are real kinds — the matrix is a cross
    // product of {node family} × {mapped kind}, pinned above for all three.
    expect(cells.length).toBe(3);
  });

  it('each live elite/boss victory grants EXACTLY what the disclosure announced (kind × projection)', { timeout: 120_000 }, () => {
    for (const family of ['battle', 'elite', 'boss'] as const) {
      const cell = liveCell(family);
      expect(cell.phase).toBe('VICTORY');
      // The completion bounty equals the disclosure, and the completed kinds
      // themselves fold to the same disclosed amount — never more.
      expect(cell.bounty).toBe(cell.disclosed);
      expect(bountyForKinds(cell.kinds)).toBe(cell.disclosed);
      // The live projection actually completed the mapped kind.
      expect(cell.kinds.includes(cell.kind)).toBe(true);
    }
  });

  it('committing ENGAGE with the live-completed kinds on the real runner pays disclosure + base, and only once', { timeout: 120_000 }, () => {
    for (const family of ['elite', 'boss'] as const) {
      const cell = liveCell(family);
      const { exp: walked, nodeId } = familySeed(family);
      const entered = walked.enter(`km-enter-${family}`);
      const snap = entered.state.snapshots[nodeId];
      const rollSlots = snap !== undefined && snap.kind === 'REWARD' ? snap.rollSlots : {};
      const goldBefore = entered.state.gold;
      const committed = entered.act({ transactionId: `km-engage-${family}`, nodeId, action: 'ENGAGE', completedKinds: cell.kinds });
      // Elite has a base reward; boss pays no base — the bounty leg is always
      // exactly the disclosed amount on top.
      expect(committed.state.gold - goldBefore).toBe(baseGold(family, rollSlots) + cell.disclosed);
      // Replaying the identical ENGAGE pays nothing again.
      const replay = committed.act({ transactionId: `km-engage-${family}`, nodeId, action: 'ENGAGE', completedKinds: cell.kinds });
      expect(replay.state.revision).toBe(committed.state.revision);
      expect(replay.state.gold).toBe(committed.state.gold);
    }
  });
});
