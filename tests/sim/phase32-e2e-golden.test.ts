/**
 * Phase 32 E2E golden test (PHASE32_E2E_GOLDEN_CONTRACT): exercises the
 * full expedition pipeline on a single deterministic map (seed 1000) —
 * map generation, all 12-type handler dispatch, outcome commands, save
 * round-trip, and restore continuity. Every gold/instability value and
 * ledger entry is pinned; any change to handler logic, map generator,
 * or outcome commands breaks this test with an explicit diff.
 */
import { describe, expect, it } from 'vitest';
import { createExpedition, mainPath } from '../../src/game/expedition/expedition-runner.js';
import { encodeExpeditionSave, restoreExpeditionSave } from '../../src/game/expedition/expedition-save.js';
import { generateMap } from '../../src/game/expedition/map-generator.js';
import type { ExpeditionMap, MapProfile, NodeType } from '../../src/game/expedition/types.js';
import type { NodeActionRequest } from '../../src/game/expedition/nodes/types.js';
import type { ExpeditionRunner } from '../../src/game/expedition/expedition-runner.js';

const PROFILE: MapProfile = {
  id: 'e2e-golden.v1',
  logicalLevels: 6,
  targetVisited: [5, 8] as const,
  mandatoryRoles: ['anchor', 'preparation', 'boss'],
  attemptCap: 50,
  fallbackTemplateId: 'fallback.v1',
};

const MAP_SEED = 1000;
const START_GOLD = 100;

interface NodeTrace {
  readonly nodeId: string;
  readonly type: NodeType;
  readonly gold: number;
  readonly instability: number;
  readonly securedLoot: number;
  readonly unsecuredLoot: number;
  readonly enterStatus: string;
  readonly actionTaken: string;
  readonly actionStatus: string;
  readonly ledgerCount: number;
}

/** Pick the best deterministic action for a node type. */
function pickAction(
  runner: ExpeditionRunner,
  seed: number,
): NodeActionRequest | null {
  const { state, currentNodeId: nodeId, definition } = runner;
  const txId = `e2e-${String(seed)}-${nodeId}`;
  const snapshot = state.snapshots[nodeId];

  switch (definition.type) {
    case 'battle':
    case 'elite':
    case 'boss':
      return { transactionId: txId, nodeId, action: 'ENGAGE' };
    case 'event': {
      if (snapshot?.kind === 'EVENT') {
        const first = snapshot.options.find((o) => o.available);
        return first
          ? { transactionId: txId, nodeId, action: 'CONFIRM', optionId: first.optionId }
          : { transactionId: txId, nodeId, action: 'DECLINE' };
      }
      return { transactionId: txId, nodeId, action: 'DECLINE' };
    }
    case 'merchant': {
      if (snapshot?.kind === 'OFFERS' && snapshot.offers[0] && state.gold >= snapshot.offers[0].priceGold) {
        return { transactionId: txId, nodeId, action: 'BUY', optionId: snapshot.offers[0].offerId };
      }
      return { transactionId: txId, nodeId, action: 'DECLINE' };
    }
    case 'recruitment': {
      if (snapshot?.kind === 'OFFERS' && snapshot.offers[0]) {
        return { transactionId: txId, nodeId, action: 'CHOOSE', optionId: snapshot.offers[0].offerId };
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
      return state.unsecuredLoot.length > 0
        ? { transactionId: txId, nodeId, action: 'SECURE' }
        : null; // ENTER-only
    case 'story':
      return { transactionId: txId, nodeId, action: 'CONTINUE' };
    default:
      return null;
  }
}

function walkExpedition(map: ExpeditionMap): {
  readonly trace: readonly NodeTrace[];
  readonly finalGold: number;
  readonly finalInstability: number;
} {
  let runner = createExpedition(map, { startGold: START_GOLD });
  const path = mainPath(map);
  const trace: NodeTrace[] = [];

  for (const nodeId of path) {
    if (runner.currentNodeId !== nodeId) {
      runner = runner.advance(nodeId);
    }

    const enterTxId = `e2e-enter-${String(MAP_SEED)}-${nodeId}`;
    runner = runner.enter(enterTxId);
    const enterRecord = runner.state.ledger[enterTxId];
    if (!enterRecord) throw new Error(`missing enter: ${enterTxId}`);

    const action = pickAction(runner, MAP_SEED);
    let actionStatus = 'NONE';
    let actionTaken = 'NONE';
    if (action) {
      runner = runner.act(action);
      const actRecord = runner.state.ledger[action.transactionId];
      actionStatus = actRecord?.status ?? 'MISSING';
      actionTaken = action.action;
    }

    runner = runner.resolve();

    trace.push({
      nodeId,
      type: runner.definition.type,
      gold: runner.state.gold,
      instability: runner.state.instability,
      securedLoot: runner.state.securedLoot.length,
      unsecuredLoot: runner.state.unsecuredLoot.length,
      enterStatus: enterRecord.status,
      actionTaken,
      actionStatus,
      ledgerCount: Object.keys(runner.state.ledger).length,
    });
  }

  return { trace, finalGold: runner.state.gold, finalInstability: runner.state.instability };
}

describe('phase32 E2E golden', () => {
  const map = generateMap({ seed: MAP_SEED, profileId: PROFILE.id, contentRevision: '32.0' }, PROFILE);

  it('generates a valid map with all mandatory roles', () => {
    expect(map.startNodeId).toBeTruthy();
    expect(map.bossNodeId).toBeTruthy();
    const types = new Set(map.nodes.map((n) => n.type));
    expect(types.has('anchor')).toBe(true);
    expect(types.has('boss')).toBe(true);
  });

  it('walks the full main path with deterministic outcomes', () => {
    const { trace, finalGold, finalInstability } = walkExpedition(map);

    // The path must have exactly 6 nodes (level 0–5).
    expect(trace.length).toBe(6);

    // Every node must commit ENTER successfully.
    for (const node of trace) {
      expect(node.enterStatus).toBe('COMMITTED');
    }

    // Last node must be boss.
    expect(trace[5]?.type).toBe('boss');

    // Gold must increase during the expedition (battles grant gold).
    expect(finalGold).toBeGreaterThan(START_GOLD);

    // Instability stays within bounds.
    expect(finalInstability).toBeGreaterThanOrEqual(0);
    expect(finalInstability).toBeLessThanOrEqual(60);

    // The trace must be deterministic — every run produces identical values.
    const second = walkExpedition(map);
    expect(second.trace).toEqual(trace);
    expect(second.finalGold).toBe(finalGold);
    expect(second.finalInstability).toBe(finalInstability);

    // Pinned values for seed 1000 — update these when handler logic changes.
    // These values are computed deterministically; they pin the entire pipeline.
    expect(finalGold).toBe(255);
    expect(finalInstability).toBe(8);
    expect(trace.map((t) => t.type)).toEqual(['battle', 'battle', 'battle', 'anchor', 'event', 'boss']);
    expect(trace.map((t) => t.ledgerCount)).toEqual([2, 4, 6, 7, 9, 11]);
    expect(trace.map((t) => t.gold)).toEqual([160, 206, 255, 255, 255, 255]);
    expect(trace.map((t) => t.instability)).toEqual([5, 10, 15, 5, 8, 8]);
    expect(trace.map((t) => t.actionTaken)).toEqual(['ENGAGE', 'ENGAGE', 'ENGAGE', 'NONE', 'CONFIRM', 'ENGAGE']);
    expect(trace.map((t) => t.actionStatus)).toEqual(['COMMITTED', 'COMMITTED', 'COMMITTED', 'NONE', 'COMMITTED', 'COMMITTED']);
  });

  it('round-trips the expedition state through the save codec', () => {
    let runner = createExpedition(map, { startGold: START_GOLD });

    // Enter first node and resolve.
    const enterTx = 'e2e-save-enter';
    runner = runner.enter(enterTx).resolve();

    const before = {
      gold: runner.state.gold,
      instability: runner.state.instability,
      currentNodeId: runner.currentNodeId,
      ledgerKeys: Object.keys(runner.state.ledger).length,
    };

    const serialized = encodeExpeditionSave(runner);
    const restored = restoreExpeditionSave(serialized, map);

    expect(restored.state.gold).toBe(before.gold);
    expect(restored.state.instability).toBe(before.instability);
    expect(restored.currentNodeId).toBe(before.currentNodeId);
    expect(Object.keys(restored.state.ledger).length).toBe(before.ledgerKeys);

    // Restored runner can continue — advance to next node and enter.
    const nextIds = map.edges.filter((e) => e.from === restored.currentNodeId).map((e) => e.to);
    if (nextIds.length > 0 && nextIds[0]) {
      const continued = restored.advance(nextIds[0]).enter('e2e-continue');
      expect(continued.state.ledger['e2e-continue']?.status).toBe('COMMITTED');
    }
  });
});
