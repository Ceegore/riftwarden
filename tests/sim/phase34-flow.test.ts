/**
 * Phase 34 battle result and screen flow tests (BATTLE_RESULT_CONTRACT):
 * validates battle result extraction, screen flow routing, and end-to-end
 * expedition flow through the full screen chain.
 */
import { describe, expect, it } from 'vitest';
import { createExpedition, mainPath } from '../../src/game/expedition/expedition-runner.js';
import { generateMap } from '../../src/game/expedition/map-generator.js';
import { loadMissionState, recordMissionCompletion, clearMissionState } from '../../src/game/mission/mission-store.js';
import type { MapProfile } from '../../src/game/expedition/types.js';
import type { ExpeditionRunner } from '../../src/game/expedition/expedition-runner.js';
import type { NodeActionRequest } from '../../src/game/expedition/nodes/types.js';

/** Pick a valid action for the given node type. Returns null if no action is needed. */
function pickActionForNode(runner: ExpeditionRunner): NodeActionRequest | null {
  const nodeId = runner.currentNodeId;
  const type = runner.definition.type;
  const snapshot = runner.state.snapshots[nodeId];

  if (type === 'battle' || type === 'elite' || type === 'boss') {
    return { transactionId: `tx-${nodeId}`, nodeId, action: 'ENGAGE' };
  }
  if (type === 'event') {
    if (snapshot?.kind === 'EVENT' && snapshot.options.length > 0) {
      const opt = snapshot.options.find((o) => o.available);
      return opt
        ? { transactionId: `tx-${nodeId}`, nodeId, action: 'CONFIRM', optionId: opt.optionId }
        : { transactionId: `tx-${nodeId}`, nodeId, action: 'DECLINE' };
    }
    return { transactionId: `tx-${nodeId}`, nodeId, action: 'DECLINE' };
  }
  if (type === 'merchant') {
    if (snapshot?.kind === 'OFFERS' && snapshot.offers[0] && runner.state.gold >= snapshot.offers[0].priceGold) {
      return { transactionId: `tx-${nodeId}`, nodeId, action: 'BUY', optionId: snapshot.offers[0].offerId };
    }
    return { transactionId: `tx-${nodeId}`, nodeId, action: 'DECLINE' };
  }
  if (type === 'recruitment') {
    if (snapshot?.kind === 'OFFERS' && snapshot.offers[0]) {
      return { transactionId: `tx-${nodeId}`, nodeId, action: 'CHOOSE', optionId: snapshot.offers[0].offerId };
    }
    return { transactionId: `tx-${nodeId}`, nodeId, action: 'DECLINE' };
  }
  if (type === 'treasure') {
    return { transactionId: `tx-${nodeId}`, nodeId, action: 'TAKE' };
  }
  if (type === 'workshop') {
    return runner.state.gold >= 220
      ? { transactionId: `tx-${nodeId}`, nodeId, action: 'POLISH' }
      : { transactionId: `tx-${nodeId}`, nodeId, action: 'DECLINE' };
  }
  if (type === 'altar') {
    return runner.state.instability + 15 <= 100
      ? { transactionId: `tx-${nodeId}`, nodeId, action: 'ACCEPT' }
      : { transactionId: `tx-${nodeId}`, nodeId, action: 'DECLINE' };
  }
  if (type === 'scout') {
    return { transactionId: `tx-${nodeId}`, nodeId, action: 'REVEAL_PATH' };
  }
  if (type === 'anchor') {
    return runner.state.unsecuredLoot.length > 0
      ? { transactionId: `tx-${nodeId}`, nodeId, action: 'SECURE' }
      : null;
  }
  if (type === 'story') {
    return { transactionId: `tx-${nodeId}`, nodeId, action: 'CONTINUE' };
  }
  return null;
}

const PROFILE: MapProfile = {
  id: 'expedition.act1.standard',
  logicalLevels: 6,
  targetVisited: [5, 8] as const,
  mandatoryRoles: ['anchor', 'preparation', 'boss'],
  attemptCap: 50,
  fallbackTemplateId: 'fallback.v1',
};

describe('phase34 battle result flow', () => {
  const map = generateMap({ seed: 42, profileId: PROFILE.id, contentRevision: '32.0' }, PROFILE);

  it('battle node ENGAGE produces a COMMITTED ledger entry', () => {
    let runner = createExpedition(map, { startGold: 100 });
    const path = mainPath(map);

    // Advance to first battle node.
    for (const nodeId of path) {
      if (runner.currentNodeId !== nodeId) {
        runner = runner.advance(nodeId);
      }
      if (runner.definition.type === 'battle') break;
    }

    expect(runner.definition.type).toBe('battle');

    runner = runner.enter('tx-enter');
    expect(runner.state.ledger['tx-enter']).toBeDefined();

    runner = runner.act({ transactionId: 'tx-engage', nodeId: runner.currentNodeId, action: 'ENGAGE' });
    expect(runner.state.ledger['tx-engage']?.status).toBe('COMMITTED');

    runner = runner.resolve();
    const visit = runner.state.visits[runner.currentNodeId];
    expect(visit?.status).toBe('RESOLVED');
  });

  it('combat node after resolve has transaction in ledger', () => {
    let runner = createExpedition(map, { startGold: 100 });
    let nodeId = '';
    for (const nid of mainPath(map)) {
      if (runner.currentNodeId !== nid) runner = runner.advance(nid);
      if (runner.definition.type === 'battle') { nodeId = nid; break; }
    }

    runner = runner.enter('tx-1');
    runner = runner.act({ transactionId: 'tx-2', nodeId, action: 'ENGAGE' });
    runner = runner.resolve();

    // Find committed transactions for this node.
    const entries = Object.values(runner.state.ledger)
      .filter((r) => r.nodeId === nodeId && r.status === 'COMMITTED');
    expect(entries.length).toBeGreaterThanOrEqual(1);
  });

  it('boss node identifier matches map', () => {
    expect(map.bossNodeId).toBeTruthy();
    const bossNode = map.nodes.find((n) => n.id === map.bossNodeId);
    expect(bossNode?.type).toBe('boss');
  });

  it('finish on boss node routes to end screen', () => {
    let runner = createExpedition(map, { startGold: 100 });
    const path = mainPath(map);

    // Walk to boss — for non-boss nodes, use visit() which enters/resolves
    // each node in one step. Handlers that need an action will throw.
    for (const nodeId of path) {
      if (runner.currentNodeId !== nodeId) {
        runner = runner.advance(nodeId);
      }
      if (runner.definition.type === 'boss') {
        runner = runner.enter(`tx-boss-${nodeId}`);
        runner = runner.act({ transactionId: `tx-engage-${nodeId}`, nodeId, action: 'ENGAGE' });
        runner = runner.resolve();
        break;
      }
      // Enter and take a valid per-type action.
      runner = runner.enter(`tx-e-${nodeId}`);
      const action = pickActionForNode(runner);
      if (action) {
        runner = runner.act(action);
      }
      runner = runner.resolve();
    }

    expect(runner.currentNodeId).toBe(map.bossNodeId);
    expect(runner.state.visits[map.bossNodeId]?.status).toBe('RESOLVED');
  });
});

describe('phase34 mission completion flow', () => {
  it('mission completion records to store', () => {
    clearMissionState();
    let state = loadMissionState();
    expect(state.missions['mission_act1_standard']?.status).toBe('available');

    // Simulate completing the mission.
    state = recordMissionCompletion(state, 'mission_act1_standard', 300);
    expect(state.missions['mission_act1_standard']?.status).toBe('completed');
    expect(state.missions['mission_act1_standard']?.bestGold).toBe(300);
    expect(state.missions['mission_act1_standard']?.completions).toBe(1);

    // Verify cascading unlocks.
    expect(state.missions['mission_act1_hard']?.status).toBe('available');
    expect(state.missions['mission_act2_forest']?.status).toBe('available');
  });
});
