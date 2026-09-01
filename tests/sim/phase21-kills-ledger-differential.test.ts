/**
 * Phase 21 §9 KILL-TOTAL LEDGER DIFFERENTIAL. The wallet audit pinned the
 * per-battle kills grant; this differential proves the RUN's total is a pure
 * fold of the PERSISTED data at every step. `state.killsEarned` must equal a
 * clean-room recomputation over the ledger + snapshots:
 *
 *   killsEarned === Σ over COMMITTED ENGAGE records of
 *                   (battle ? 3 : 5) + (snapshot.goldSlot % (battle ? 4 : 8))
 *
 * across a full map walk (victories, defeats, retreats, services, claims).
 * A defeat (ENGAGE_DEFEAT) adds nothing; a replay of the same ENGAGE grants
 * nothing again; the total is monotone. If the runtime ever granted kills it
 * did not record, or the ledger stopped being a complete record of kills, the
 * fold would drift.
 */
import { describe, expect, it } from 'vitest';
import { createExpedition, mainPath, restoreExpedition } from '../../src/game/expedition/expedition-runner.js';
import { generateMap } from '../../src/game/expedition/map-generator.js';
import { decodeExpeditionSave, encodeExpeditionSave, restoreExpeditionSave } from '../../src/game/expedition/expedition-save.js';
import type { NodeRunState } from '../../src/game/expedition/nodes/types.js';
import type { ExpeditionMap, MapProfile } from '../../src/game/expedition/types.js';

const PROFILE: MapProfile = {
  id: 'exp-kills.v1',
  logicalLevels: 6,
  targetVisited: [5, 8] as const,
  mandatoryRoles: ['anchor', 'preparation', 'boss'],
  attemptCap: 50,
  fallbackTemplateId: 'fallback.v1',
};

function mapFor(seed: number): ExpeditionMap {
  return generateMap({ seed, profileId: 'exp-kills.v1', contentRevision: '32.0' }, PROFILE);
}

/** Clean-room kills amount for one victory on a node family (contract oracle). */
function oracleKills(type: string, goldSlot: number): number {
  const battle = type === 'battle';
  return (battle ? 3 : 5) + (goldSlot % (battle ? 4 : 8));
}

/**
 * Clean-room fold: recompute the run's kills total from the persisted ledger +
 * snapshots alone. Every COMMITTED victory ENGAGE contributes its family's
 * deterministic amount from the node's persisted REWARD gold slot; defeats,
 * retreats, services and claims contribute nothing.
 */
function oracleKillsFold(state: NodeRunState, nodeTypes: Readonly<Map<string, string>>): number {
  let total = 0;
  for (const entry of Object.values(state.ledger)) {
    if (entry.action !== 'ENGAGE' || entry.status !== 'COMMITTED') continue;
    const type = nodeTypes.get(entry.nodeId);
    if (type === undefined || !['battle', 'elite', 'boss'].includes(type)) continue;
    const snap = state.snapshots[entry.nodeId];
    if (snap === undefined || snap.kind !== 'REWARD') continue;
    total += oracleKills(type, snap.rollSlots['gold'] ?? 0);
  }
  return total;
}

/**
 * A MAIN-PATH walk (start → … → boss, the guaranteed forward chain) that
 * asserts the oracle fold at EVERY step (enter, act, resolve). The map's
 * first-edge branch can dead-end early, so the walk follows `mainPath` — the
 * deterministic forward chain that always reaches the boss.
 */
function walkWithKillsOracle(seed: number): { readonly steps: number; readonly victories: number; readonly defeats: number } {
  const map = mapFor(seed);
  const path = mainPath(map);
  let exp = createExpedition(map, { startGold: 300 });
  const nodeTypes = new Map<string, string>();
  let lastKills = 0;
  let victories = 0;
  let defeats = 0;
  const assertFold = (label: string): void => {
    expect(exp.state.killsEarned, `${label} killsEarned === oracle fold`).toBe(oracleKillsFold(exp.state, nodeTypes));
    expect(exp.state.killsEarned).toBeGreaterThanOrEqual(lastKills);
    lastKills = exp.state.killsEarned;
  };
  for (let guard = 0; guard < path.length; guard += 1) {
    const type = exp.definition.type;
    const nodeId = exp.currentNodeId;
    nodeTypes.set(nodeId, type);
    exp = exp.enter(`kl-${String(seed)}-e-${String(guard)}`);
    assertFold(`after ENTER ${nodeId}`);
    if (type === 'battle' || type === 'elite' || type === 'boss') {
      // Mix victories and defeats; both must keep the fold exact.
      const victory = guard % 3 !== 0;
      exp = exp.act({
        transactionId: `kl-${String(seed)}-a-${String(guard)}`,
        nodeId,
        action: victory ? 'ENGAGE' : 'ENGAGE_DEFEAT',
        ...(victory ? { completedKinds: ['kill_regulars'] } : {}),
      });
      assertFold(`after ${victory ? 'ENGAGE' : 'ENGAGE_DEFEAT'} ${nodeId}`);
      if (victory) {
        victories += 1;
        // Replaying the victory transaction grants NOTHING again (fold unchanged).
        exp = exp.act({
          transactionId: `kl-${String(seed)}-a-${String(guard)}`,
          nodeId,
          action: 'ENGAGE',
          completedKinds: ['kill_regulars'],
        });
        assertFold(`after ENGAGE replay ${nodeId}`);
      } else {
        defeats += 1;
        // A defeat keeps the node open; retreat clears it (no kills either way).
        exp = exp.act({ transactionId: `kl-${String(seed)}-d-${String(guard)}`, nodeId, action: 'DECLINE' });
        assertFold(`after retreat ${nodeId}`);
      }
    } else {
      exp = exp.act({ transactionId: `kl-${String(seed)}-a-${String(guard)}`, nodeId, action: 'DECLINE' });
      assertFold(`after DECLINE ${nodeId}`);
    }
    exp = exp.resolve();
    assertFold(`after resolve ${nodeId}`);
    const next = path[guard + 1];
    if (next === undefined) break;
    exp = exp.advance(next);
  }
  // The final total is exactly the fold of the finished run.
  expect(exp.state.killsEarned).toBe(oracleKillsFold(exp.state, nodeTypes));
  return { steps: path.length, victories, defeats };
}

describe('P21 §9 kill-total ledger differential', () => {
  it('killsEarned equals the clean-room oracle fold at every step of a full main-path run', () => {
    // The main path always runs start → boss; a mixed victory/defeat pattern
    // (guard % 3) guarantees both legs while the fold must hold at every step.
    for (const seed of [601, 602, 603]) {
      const stats = walkWithKillsOracle(seed);
      expect(stats.steps).toBeGreaterThanOrEqual(5);
      expect(stats.victories).toBeGreaterThanOrEqual(1);
      expect(stats.defeats).toBeGreaterThanOrEqual(1);
    }
  });

  it('a dedicated victory grants exactly the family amount, once, from the persisted gold slot', () => {
    // Pin the per-family oracle on real nodes: battle 3 + (gold%4), elite/boss
    // 5 + (gold%8), and a replay of the SAME transaction adds zero.
    for (const seed of [604, 605]) {
      let exp = createExpedition(mapFor(seed), { startGold: 300 });
      let guard = 0;
      while (!['battle', 'elite', 'boss'].includes(exp.definition.type)) {
        const next = exp.reachableNodes[0];
        if (next === undefined) throw new Error('dead-end');
        exp = exp.enter(`kl-walk-${String(guard)}`).resolve().advance(next);
        guard += 1;
      }
      const type = exp.definition.type;
      const nodeId = exp.currentNodeId;
      exp = exp.enter(`kl-pin-enter-${String(seed)}`);
      const snap = exp.state.snapshots[nodeId];
      if (snap === undefined || snap.kind !== 'REWARD') throw new Error('no reward snapshot');
      const goldSlot = snap.rollSlots['gold'] ?? 0;
      const expected = oracleKills(type, goldSlot);
      const before = exp.state.killsEarned;
      const committed = exp.act({ transactionId: `kl-pin-engage-${String(seed)}`, nodeId, action: 'ENGAGE', completedKinds: [] });
      expect(committed.state.killsEarned - before).toBe(expected);
      const replay = committed.act({ transactionId: `kl-pin-engage-${String(seed)}`, nodeId, action: 'ENGAGE', completedKinds: [] });
      expect(replay.state.killsEarned).toBe(committed.state.killsEarned);
    }
  });

  it('a FULL-GRAPH multi-fight walk (side branches included — battle/elite/boss mixed) keeps the kills fold exact at every step', () => {
    // The main-path walk proves the fold on the guaranteed chain; this walk
    // covers EVERY node of the map. The greedy-last rule (take the LAST
    // unvisited reachable node) threads every side branch (ids sort after the
    // main-path ids), so elite nodes — which only spawn as side-branch normal
    // slots — genuinely appear alongside battle and the level-5 boss. Victories
    // and defeats are mixed per step; the clean-room fold over ALL committed
    // ENGAGEs must equal `killsEarned` after every enter/act/resolve/advance.
    for (const seed of [500, 503, 508]) {
      const map = mapFor(seed);
      let exp = createExpedition(map, { startGold: 300 });
      const nodeTypes = new Map<string, string>();
      const visited = new Set<string>();
      let victories = 0;
      let defeats = 0;
      let eliteFights = 0;
      let guard = 0;
      const assertFold = (label: string): void => {
        expect(exp.state.killsEarned, `${label} killsEarned === oracle fold (seed ${String(seed)})`).toBe(oracleKillsFold(exp.state, nodeTypes));
      };
      while (guard < 200) {
        const type = exp.definition.type;
        const nodeId = exp.currentNodeId;
        visited.add(nodeId);
        nodeTypes.set(nodeId, type);
        exp = exp.enter(`kg-${String(seed)}-e-${String(guard)}`);
        assertFold(`after ENTER ${nodeId}`);
        if (type === 'battle' || type === 'elite' || type === 'boss') {
          if (type === 'elite') eliteFights += 1;
          const victory = guard % 3 !== 0;
          exp = exp.act({
            transactionId: `kg-${String(seed)}-a-${String(guard)}`,
            nodeId,
            action: victory ? 'ENGAGE' : 'ENGAGE_DEFEAT',
            ...(victory ? { completedKinds: ['kill_regulars'] } : {}),
          });
          assertFold(`after ${victory ? 'ENGAGE' : 'ENGAGE_DEFEAT'} ${nodeId}`);
          if (victory) victories += 1;
          else defeats += 1;
          // Replay the verdict (idempotent — nothing may move) and, for a
          // defeat, retreat (also nothing).
          exp = exp.act({
            transactionId: `kg-${String(seed)}-a-${String(guard)}`,
            nodeId,
            action: victory ? 'ENGAGE' : 'ENGAGE_DEFEAT',
            ...(victory ? { completedKinds: ['kill_regulars'] } : {}),
          });
          assertFold(`after verdict replay ${nodeId}`);
          if (!victory) {
            exp = exp.act({ transactionId: `kg-${String(seed)}-d-${String(guard)}`, nodeId, action: 'DECLINE' });
            assertFold(`after retreat ${nodeId}`);
          }
        } else {
          exp = exp.act({ transactionId: `kg-${String(seed)}-a-${String(guard)}`, nodeId, action: 'DECLINE' });
          assertFold(`after DECLINE ${nodeId}`);
        }
        exp = exp.resolve();
        assertFold(`after resolve ${nodeId}`);
        // Greedy-last: take the LAST unvisited reachable node (side-branch ids
        // sort after main-path ids) so every branch is threaded; when nothing
        // is reachable the full graph is exhausted.
        const candidates = exp.reachableNodes.filter((id) => !visited.has(id));
        const next = candidates[candidates.length - 1];
        if (next === undefined) break;
        exp = exp.advance(next);
        guard += 1;
      }
      // The walk genuinely covered the map: multiple fights, at least one
      // elite side-branch fight and at least one defeat, all families mixed.
      expect(visited.size).toBeGreaterThanOrEqual(7);
      expect(victories).toBeGreaterThanOrEqual(2);
      expect(eliteFights).toBeGreaterThanOrEqual(1);
      expect(defeats).toBeGreaterThanOrEqual(1);
      expect(exp.state.killsEarned).toBe(oracleKillsFold(exp.state, nodeTypes));
    }
  });

  it('a RESTORED full-graph walk keeps the kills fold exact: save/restore at EVERY hop (all node kinds included) reproduces the uninterrupted timeline', () => {
    // The strongest reload × kills parity: the full-graph walk above is
    // uninterrupted; this cut is is save/restore at EVERY hop — after every
    // enter/act/resolve/advance the run is encoded, decoded and restored, and
    // the RESTORED run's next actions keep `killsEarned ===` the clean-room
    // fold. A reload must never re-grant kills (the ledger is the complete
    // record) nor lose them (the fold is over the persisted ledger alone).
    for (const seed of [500, 503]) {
      const map = mapFor(seed);
      let exp = createExpedition(map, { startGold: 300 });
      const nodeTypes = new Map<string, string>();
      const visited = new Set<string>();
      let guard = 0;
      let cuts = 0;
      const assertFold = (label: string): void => {
        expect(exp.state.killsEarned, `${label} killsEarned === oracle fold (seed ${String(seed)})`).toBe(oracleKillsFold(exp.state, nodeTypes));
      };
      while (guard < 200) {
        const type = exp.definition.type;
        const nodeId = exp.currentNodeId;
        visited.add(nodeId);
        nodeTypes.set(nodeId, type);
        exp = exp.enter(`kr-${String(seed)}-e-${String(guard)}`);
        assertFold(`after ENTER ${nodeId}`);
        if (type === 'battle' || type === 'elite' || type === 'boss') {
          const victory = guard % 2 === 0;
          exp = exp.act({
            transactionId: `kr-${String(seed)}-a-${String(guard)}`,
            nodeId,
            action: victory ? 'ENGAGE' : 'ENGAGE_DEFEAT',
            ...(victory ? { completedKinds: ['kill_regulars'] } : {}),
          });
          assertFold(`after ${victory ? 'ENGAGE' : 'ENGAGE_DEFEAT'} ${nodeId}`);
          if (!victory) {
            exp = exp.act({ transactionId: `kr-${String(seed)}-d-${String(guard)}`, nodeId, action: 'DECLINE' });
            assertFold(`after retreat ${nodeId}`);
          }
        } else {
          exp = exp.act({ transactionId: `kr-${String(seed)}-a-${String(guard)}`, nodeId, action: 'DECLINE' });
          assertFold(`after DECLINE ${nodeId}`);
        }
        exp = exp.resolve();
        assertFold(`after resolve ${nodeId}`);
        // CUT AT EVERY HOP: encode → decode → restore (both the codec path and
        // the runner path) — the restored run's kills must equal the fold of
        // the persisted ledger, byte-identical to the pre-cut state.
        const serialized = encodeExpeditionSave(exp);
        const decoded = decodeExpeditionSave(JSON.parse(serialized));
        const restoredRunner = restoreExpeditionSave(serialized, map);
        expect(restoredRunner.state.killsEarned).toBe(exp.state.killsEarned);
        expect(restoredRunner.state.killsEarned).toBe(oracleKillsFold(restoredRunner.state, nodeTypes));
        const runnerRestore = restoreExpedition(decoded.state, map, decoded.currentNodeId);
        expect(runnerRestore.state.killsEarned).toBe(exp.state.killsEarned);
        exp = restoredRunner;
        cuts += 1;
        // Greedy-last: thread the next unvisited branch.
        const candidates = exp.reachableNodes.filter((id) => !visited.has(id));
        const next = candidates[candidates.length - 1];
        if (next === undefined) break;
        exp = exp.advance(next);
        assertFold(`after advance ${nodeId}`);
        guard += 1;
      }
      // Every hop was a real cut and the walk covered the graph.
      expect(cuts).toBeGreaterThanOrEqual(7);
      expect(visited.size).toBeGreaterThanOrEqual(8);
      expect(exp.state.killsEarned).toBe(oracleKillsFold(exp.state, nodeTypes));
    }
  });

  it('a defeat and a retreat add ZERO kills (the fold counts only victory ENGAGEs)', () => {
    let exp = createExpedition(mapFor(610), { startGold: 300 });
    let guard = 0;
    while (!['battle', 'elite', 'boss'].includes(exp.definition.type)) {
      const next = exp.reachableNodes[0];
      if (next === undefined) throw new Error('dead-end');
      exp = exp.enter(`kl-walk2-${String(guard)}`).resolve().advance(next);
      guard += 1;
    }
    const nodeId = exp.currentNodeId;
    exp = exp.enter('kl-defeat-enter');
    const killsBefore = exp.state.killsEarned;
    exp = exp.act({ transactionId: 'kl-defeat-engage', nodeId, action: 'ENGAGE_DEFEAT' });
    expect(exp.state.killsEarned).toBe(killsBefore);
    exp = exp.act({ transactionId: 'kl-defeat-decline', nodeId, action: 'DECLINE' });
    expect(exp.state.killsEarned).toBe(killsBefore);
    // A second ENGAGE on the same node is rejected — no kills move.
    exp = exp.act({ transactionId: 'kl-defeat-engage2', nodeId, action: 'ENGAGE', completedKinds: [] });
    expect(exp.state.ledger['kl-defeat-engage2']?.status).toBe('REJECTED');
    expect(exp.state.killsEarned).toBe(killsBefore);
  });
});
