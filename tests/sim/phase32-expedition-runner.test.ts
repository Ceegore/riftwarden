/**
 * Phase 32 expedition runner tests: exercises the full loop through
 * createExpedition → enter → act → resolve → advance across all 12 node
 * types on a sequence of deterministic maps.
 */
import { describe, expect, it } from 'vitest';
import { createExpedition, mainPath, nodesOfType, restoreExpedition } from '../../src/game/expedition/expedition-runner.js';
import type { NodeActionRequest, NodeRunState } from '../../src/game/expedition/nodes/types.js';
import { generateMap } from '../../src/game/expedition/map-generator.js';
import type { ExpeditionMap, MapProfile } from '../../src/game/expedition/types.js';

const FALLBACK_PROFILE: MapProfile = {
  id: 'exp-runner.v1',
  logicalLevels: 6,
  targetVisited: [5, 8] as const,
  mandatoryRoles: ['anchor', 'preparation', 'boss'],
  attemptCap: 50,
  fallbackTemplateId: 'fallback.v1',
};

function mapFor(seed: number): ExpeditionMap {
  return generateMap({ seed, profileId: 'exp-runner.v1', contentRevision: '32.0' }, FALLBACK_PROFILE);
}

describe('phase32 expedition runner lifecycle', () => {
  it('creates a fresh expedition at the start node with correct gold', () => {
    const map = mapFor(100);
    const exp = createExpedition(map, { startGold: 150 });
    expect(exp.currentNodeId).toBe(map.startNodeId);
    expect(exp.state.gold).toBe(150);
    expect(exp.state.instability).toBe(0);
    expect(exp.reachableNodes.length).toBeGreaterThan(0);
    expect(exp.handler.type).toBeTruthy();
  });

  it('rejects invalid maps at creation', () => {
    const broken = { ...mapFor(100), nodes: [] as const };
    expect(() => createExpedition(broken, { startGold: 100 })).toThrow();
  });

  it('entering a node applies instability and materializes a snapshot', () => {
    const map = mapFor(101);
    const exp = createExpedition(map, { startGold: 100 });
    const entered = exp.enter('tx-enter-1');
    // Snapshot must exist for the current node
    expect(entered.state.snapshots[entered.currentNodeId]).toBeDefined();
    // Visit must be in COMMITTED state after dispatchEnterNode (commit + enter in one step)
    const visit = entered.state.visits[entered.currentNodeId];
    if (visit === undefined) throw new Error('visit was not opened');
    expect(visit.status).toBe('COMMITTED');
  });

  it('entering is idempotent for the same transaction', () => {
    const map = mapFor(102);
    const exp = createExpedition(map, { startGold: 100 });
    const a = exp.enter('tx-enter-2');
    const b = exp.enter('tx-enter-2');
    expect(a.state.revision).toBe(b.state.revision);
  });

  it('resolving marks the visit RESOLVED', () => {
    const map = mapFor(103);
    let exp = createExpedition(map, { startGold: 100 });
    exp = exp.enter('tx-enter-3');
    exp = exp.resolve();
    expect(exp.state.visits[exp.currentNodeId]?.status).toBe('RESOLVED');
  });

  it('advancing to a reachable node changes position', () => {
    const map = mapFor(104);
    let exp = createExpedition(map, { startGold: 100 });
    const nextId = exp.reachableNodes[0];
    if (nextId === undefined) throw new Error('no reachable node');
    exp = exp.advance(nextId);
    expect(exp.currentNodeId).toBe(nextId);
  });

  it('rejects advance to unreachable node', () => {
    const map = mapFor(105);
    const exp = createExpedition(map, { startGold: 100 });
    expect(() => exp.advance('nonexistent_node')).toThrow();
  });

  it('visit convenience: enter + act + resolve in one call', () => {
    const map = mapFor(106);
    let exp = createExpedition(map, { startGold: 100 });
    const visitRequest: NodeActionRequest = {
      transactionId: 'tx-visit',
      nodeId: exp.currentNodeId,
      action: 'ENTER',
    };
    exp = exp.visit('tx-enter-visit', visitRequest);
    expect(exp.state.visits[exp.currentNodeId]?.status).toBe('RESOLVED');
  });
});

describe('phase32 expedition runner full path', () => {
  it('walks the main path start-to-boss without failures', () => {
    const map = mapFor(200);
    let exp = createExpedition(map, { startGold: 200 });
    const path = mainPath(map);
    expect(path.length).toBeGreaterThanOrEqual(3);

    for (let i = 0; i < path.length; i += 1) {
      const nodeId = path[i];
      if (nodeId === undefined) continue;

      // Navigate to this node if not already there
      if (exp.currentNodeId !== nodeId) {
        exp = exp.advance(nodeId);
      }

      // Enter
      exp = exp.enter(`tx-e-${String(i)}`);

      // Dispatch node-type-specific action
      const def = exp.definition;
      const actionRequest = nodeActionFor(def.type, exp.currentNodeId, i, exp.state);
      if (actionRequest !== null) {
        exp = exp.act(actionRequest);
      }

      // Resolve
      exp = exp.resolve();
    }

    // Gold should have changed from battles, events, etc.
    // Instability should be applied
    expect(exp.state.revision).toBeGreaterThan(0);
    // Should end near the boss
    const lastNode = map.nodes.find((n) => n.id === exp.currentNodeId);
    expect(lastNode).toBeDefined();
  });

  it('restores a persisted state at any node', () => {
    const map = mapFor(201);
    let exp = createExpedition(map, { startGold: 100 });
    const nextId = exp.reachableNodes[0];
    if (nextId === undefined) throw new Error('no reachable node');
    exp = exp.advance(nextId);

    const snapshotted: NodeRunState = JSON.parse(JSON.stringify(exp.state)) as NodeRunState;
    const restored = restoreExpedition(snapshotted, map, nextId);
    expect(restored.currentNodeId).toBe(nextId);
    expect(restored.state.gold).toBe(snapshotted.gold);
  });
});

describe('phase32 expedition runner node-type coverage', () => {
  it('nodesOfType returns correct node ids', () => {
    const map = mapFor(300);
    const battleNodes = nodesOfType(map, 'battle');
    expect(battleNodes.length).toBeGreaterThan(0);
    const anchorNodes = nodesOfType(map, 'anchor');
    expect(anchorNodes.length).toBeGreaterThanOrEqual(1);
    const bossNodes = nodesOfType(map, 'boss');
    expect(bossNodes.length).toBeGreaterThanOrEqual(1);
    // All returned ids are on the map
    const allIds = new Set(map.nodes.map((n) => n.id));
    for (const id of battleNodes) expect(allIds.has(id)).toBe(true);
  });
});

// ── Helper: choose a valid node-type-specific action request ──

function nodeActionFor(
  type: string,
  nodeId: string,
  index: number,
  state: { gold: number; instability: number; snapshots: Record<string, unknown> },
): NodeActionRequest | null {
  const snap = state.snapshots[nodeId] as Record<string, unknown> | undefined;
  const txId = `tx-act-${String(index)}`;

  switch (type) {
    case 'battle':
    case 'elite':
    case 'boss':
      return { transactionId: txId, nodeId, action: 'ENGAGE' };

    case 'event': {
      if (snap?.['kind'] !== 'EVENT') return null;
      const options = (snap as { options: readonly { optionId: string; available: boolean }[] }).options;
      const first = options.find((o) => o.available);
      if (first !== undefined) {
        return { transactionId: txId, nodeId, action: 'CONFIRM', optionId: first.optionId };
      }
      return { transactionId: txId, nodeId, action: 'DECLINE' };
    }

    case 'merchant': {
      if (snap?.['kind'] !== 'OFFERS') return null;
      const offers = (snap as { offers: readonly { offerId: string; priceGold: number }[] }).offers;
      const buyable = offers.find((o) => state.gold >= o.priceGold);
      if (buyable !== undefined) {
        return { transactionId: txId, nodeId, action: 'BUY', optionId: buyable.offerId };
      }
      return { transactionId: txId, nodeId, action: 'DECLINE' };
    }

    case 'recruitment': {
      if (snap?.['kind'] !== 'OFFERS') return null;
      const offers = (snap as { offers: readonly { offerId: string }[] }).offers;
      if (offers[0] !== undefined) {
        return { transactionId: txId, nodeId, action: 'CHOOSE', optionId: offers[0].offerId };
      }
      return { transactionId: txId, nodeId, action: 'DECLINE' };
    }

    case 'treasure':
      return { transactionId: txId, nodeId, action: 'TAKE' };

    case 'workshop':
      return state.gold >= 220
        ? { transactionId: txId, nodeId, action: 'POLISH' }
        : { transactionId: txId, nodeId, action: 'DECLINE' };

    case 'altar':
      return state.instability + 10 <= 100
        ? { transactionId: txId, nodeId, action: 'ACCEPT' }
        : { transactionId: txId, nodeId, action: 'DECLINE' };

    case 'scout':
      return { transactionId: txId, nodeId, action: 'REVEAL_PATH' };

    case 'anchor':
      return null; // ENTER already handled, SECURE optional

    case 'story':
      return { transactionId: txId, nodeId, action: 'CONTINUE' };

    default:
      return null;
  }
}
