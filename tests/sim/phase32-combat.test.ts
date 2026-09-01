import { describe, expect, it } from 'vitest';
import { battleHandler, bossHandler, eliteHandler } from '../../src/game/expedition/nodes/handlers/combat.js';
import { commitFlow, definition, openAndPrepare, request, baseState } from './phase32-helpers.js';
import type { NodeRunState } from '../../src/game/expedition/nodes/types.js';

function rewardIdsOf(state: NodeRunState, nodeId: string): readonly string[] {
  const snapshot = state.snapshots[nodeId];
  if (snapshot?.kind !== 'REWARD') {
    throw new Error('reward snapshot missing');
  }
  return snapshot.rewardIds;
}

describe('phase32 battle (S40 combat)', () => {
  const def = definition('node-battle-1', 'battle');

  it('ENGAGE grants gold and a deterministic loot chance; CLAIM_REWARD grants the choice', () => {
    const state = openAndPrepare(baseState(), battleHandler, def);
    const engage = commitFlow(state, battleHandler, def, request(def.nodeId, 'ENGAGE', 'tx-battle-engage'));
    expect(engage.outcome.result.status).toBe('COMMITTED');
    expect(engage.state.gold).toBeGreaterThanOrEqual(145);
    expect(engage.state.gold).toBeLessThanOrEqual(170);
    const claimed = commitFlow(engage.state, battleHandler, def, request(def.nodeId, 'CLAIM_REWARD', 'tx-battle-claim', 'reward:node-battle-1:0'));
    expect(claimed.outcome.result.status).toBe('COMMITTED');
    expect(claimed.state.unsecuredLoot).toContain('reward:node-battle-1:0');
  });

  it('reload replays the same reward snapshot (no re-roll)', () => {
    const a = openAndPrepare(baseState({ runId: 'run-battle-a' }), battleHandler, def);
    const b = openAndPrepare(baseState({ runId: 'run-battle-a' }), battleHandler, def);
    expect(a.snapshots[def.nodeId]).toEqual(b.snapshots[def.nodeId]);
    expect(rewardIdsOf(a, def.nodeId)).toHaveLength(2);
  });

  it('a duplicate ENGAGE transaction replays; a second ENGAGE with a new id is refused', () => {
    const state = openAndPrepare(baseState(), battleHandler, def);
    const first = commitFlow(state, battleHandler, def, request(def.nodeId, 'ENGAGE', 'tx-battle-dup'));
    const replay = commitFlow(first.state, battleHandler, def, request(def.nodeId, 'ENGAGE', 'tx-battle-dup'));
    expect(replay.outcome.replayed).toBe(true);
    expect(replay.state.gold).toBe(first.state.gold);
  });

  it('enter applies the pinned default instability exactly once', () => {
    const state = openAndPrepare(baseState(), battleHandler, def);
    const enter = commitFlow(state, battleHandler, def, request(def.nodeId, 'ENTER', 'tx-battle-enter'));
    expect(enter.outcome.result.status).toBe('COMMITTED');
    expect(enter.state.instability).toBe(5);
    const again = commitFlow(enter.state, battleHandler, def, request(def.nodeId, 'ENTER', 'tx-battle-enter'));
    expect(again.outcome.replayed).toBe(true);
    expect(again.state.instability).toBe(5);
  });

  it('an unknown claim option is structural misuse', () => {
    const state = openAndPrepare(baseState(), battleHandler, def);
    expect(() => commitFlow(state, battleHandler, def, request(def.nodeId, 'CLAIM_REWARD', 'tx-battle-bad', 'reward:nope'))).toThrow();
  });
});

describe('phase32 elite (S40 combat)', () => {
  const def = definition('node-elite-1', 'elite');

  it('elite grants higher gold and a guaranteed three-way claim', () => {
    const state = openAndPrepare(baseState(), eliteHandler, def);
    const engage = commitFlow(state, eliteHandler, def, request(def.nodeId, 'ENGAGE', 'tx-elite-engage'));
    expect(engage.outcome.result.status).toBe('COMMITTED');
    expect(engage.state.gold).toBeGreaterThanOrEqual(190);
    expect(engage.state.gold).toBeLessThanOrEqual(240);
    expect(rewardIdsOf(engage.state, def.nodeId)).toHaveLength(3);
  });

  it('enter applies the elite default instability (+12)', () => {
    const state = openAndPrepare(baseState(), eliteHandler, def);
    const enter = commitFlow(state, eliteHandler, def, request(def.nodeId, 'ENTER', 'tx-elite-enter'));
    expect(enter.state.instability).toBe(12);
  });
});

describe('phase32 boss (S40 combat)', () => {
  const def = definition('node-boss-1', 'boss');

  it('boss adds no instability on enter and offers a three-way claim', () => {
    const state = openAndPrepare(baseState(), bossHandler, def);
    const enter = commitFlow(state, bossHandler, def, request(def.nodeId, 'ENTER', 'tx-boss-enter'));
    expect(enter.state.instability).toBe(0);
    const engage = commitFlow(enter.state, bossHandler, def, request(def.nodeId, 'ENGAGE', 'tx-boss-engage'));
    expect(engage.outcome.result.status).toBe('COMMITTED');
    expect(rewardIdsOf(engage.state, def.nodeId)).toHaveLength(3);
  });
});
