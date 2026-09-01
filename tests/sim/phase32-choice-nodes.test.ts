import { describe, expect, it } from 'vitest';
import { treasureHandler } from '../../src/game/expedition/nodes/handlers/treasure.js';
import { workshopHandler, POLISH_COST_GOLD, REPAIR_COST_GOLD } from '../../src/game/expedition/nodes/handlers/workshop.js';
import { altarHandler } from '../../src/game/expedition/nodes/handlers/altar.js';
import { scoutHandler } from '../../src/game/expedition/nodes/handlers/scout.js';
import { commitFlow, definition, openAndPrepare, request, baseState } from './phase32-helpers.js';

describe('phase32 treasure (S45)', () => {
  const def = definition('node-treasure-1', 'treasure', 'gear_main_sword');

  it('TAKE grants unsecured loot with the protection condition visible', () => {
    const state = openAndPrepare(baseState(), treasureHandler, def);
    const take = commitFlow(state, treasureHandler, def, request(def.nodeId, 'TAKE', 'tx-treasure-take'));
    expect(take.outcome.result.status).toBe('COMMITTED');
    expect(take.state.unsecuredLoot).toContain('treasure:node-treasure-1');
    expect(take.state.securedLoot).toHaveLength(0);
  });

  it('DECLINE ends the node with no reward and no hidden cost', () => {
    const state = openAndPrepare(baseState(), treasureHandler, def);
    const decline = commitFlow(state, treasureHandler, def, request(def.nodeId, 'DECLINE', 'tx-treasure-decline'));
    expect(decline.outcome.result.status).toBe('COMMITTED');
    expect(decline.state.unsecuredLoot).toHaveLength(0);
    expect(decline.state.gold).toBe(100);
  });

  it('a second TAKE on the same transaction replays, never double-grants', () => {
    const state = openAndPrepare(baseState(), treasureHandler, def);
    const first = commitFlow(state, treasureHandler, def, request(def.nodeId, 'TAKE', 'tx-treasure-dup'));
    const second = commitFlow(first.state, treasureHandler, def, request(def.nodeId, 'TAKE', 'tx-treasure-dup'));
    expect(second.outcome.replayed).toBe(true);
    expect(second.state.unsecuredLoot).toHaveLength(1);
  });
});

describe('phase32 dungeon workshop (S46)', () => {
  const def = definition('node-workshop-1', 'workshop', 'gear_main_sword');

  it('allows exactly one action unless a typed reward extends it', () => {
    const state = openAndPrepare(baseState({ gold: 500 }), workshopHandler, def);
    const polish = commitFlow(state, workshopHandler, def, request(def.nodeId, 'POLISH', 'tx-ws-polish'));
    expect(polish.outcome.result.status).toBe('COMMITTED');
    expect(polish.state.gold).toBe(500 - POLISH_COST_GOLD);
    const second = commitFlow(polish.state, workshopHandler, def, request(def.nodeId, 'REPAIR', 'tx-ws-repair'));
    expect(second.outcome.result.status).toBe('REJECTED');
    expect(second.outcome.result.reason).toBe('ACTION_LIMIT');
  });

  it('polish and repair charge their visible costs', () => {
    const state = openAndPrepare(baseState({ gold: 500 }), workshopHandler, def);
    const repair = commitFlow(state, workshopHandler, def, request(def.nodeId, 'REPAIR', 'tx-ws-repair'));
    expect(repair.outcome.result.status).toBe('COMMITTED');
    expect(repair.state.gold).toBe(500 - REPAIR_COST_GOLD);
  });

  it('rejects with insufficient gold without mutating anything', () => {
    const state = openAndPrepare(baseState({ gold: 10 }), workshopHandler, def);
    const polish = commitFlow(state, workshopHandler, def, request(def.nodeId, 'POLISH', 'tx-ws-poor'));
    expect(polish.outcome.result.status).toBe('REJECTED');
    expect(polish.outcome.result.reason).toBe('INSUFFICIENT_GOLD');
    expect(polish.state.gold).toBe(10);
  });
});

describe('phase32 rift altar (S47)', () => {
  const def = definition('node-altar-1', 'altar', 'relic_ash_crown');

  it('shows benefit and downside in parallel and requires confirmation', () => {
    const state = openAndPrepare(baseState(), altarHandler, def);
    const preview = altarHandler.prepare(def, state).preview;
    expect(preview.consequences).toEqual(expect.arrayContaining(['altar.benefit', 'altar.downside.instability', 'altar.always.declinable']));
  });

  it('ACCEPT applies benefit and downside together; DECLINE stays free', () => {
    const state = openAndPrepare(baseState(), altarHandler, def);
    const accept = commitFlow(state, altarHandler, def, request(def.nodeId, 'ACCEPT', 'tx-altar-accept'));
    expect(accept.outcome.result.status).toBe('COMMITTED');
    expect(accept.state.relics).toContain('relic_ash_crown');
    expect(accept.state.instability).toBe(10);
    const declinedState = openAndPrepare(baseState(), altarHandler, def);
    const declined = commitFlow(declinedState, altarHandler, def, request(def.nodeId, 'DECLINE', 'tx-altar-decline'));
    expect(declined.state.relics).toHaveLength(0);
    expect(declined.state.instability).toBe(0);
  });

  it('rejects at full relic capacity and refuses duplicate relics', () => {
    const relics = Array.from({ length: 6 }, (_, i) => `relic-${String(i)}`);
    const full = openAndPrepare(baseState({ relics }), altarHandler, def);
    const accept = commitFlow(full, altarHandler, def, request(def.nodeId, 'ACCEPT', 'tx-altar-full'));
    expect(accept.outcome.result.status).toBe('REJECTED');
    expect(accept.outcome.result.reason).toBe('RELIC_CAP');
    const dup = openAndPrepare(baseState({ relics: ['relic_ash_crown'] }), altarHandler, def);
    const acceptDup = commitFlow(dup, altarHandler, def, request(def.nodeId, 'ACCEPT', 'tx-altar-dup'));
    expect(acceptDup.outcome.result.status).toBe('REJECTED');
    expect(acceptDup.outcome.result.reason).toBe('REWARD_DUPLICATE');
  });
});

describe('phase32 scout post (S48)', () => {
  const def = definition('node-scout-1', 'scout');

  it('stores scout information as run knowledge, exactly once', () => {
    const state = openAndPrepare(baseState(), scoutHandler, def);
    const path = commitFlow(state, scoutHandler, def, request(def.nodeId, 'REVEAL_PATH', 'tx-scout-path'));
    expect(path.outcome.result.status).toBe('COMMITTED');
    expect(path.state.knowledge).toContain('scout.path:node-scout-1');
    // One information choice: a second reveal is rejected with a visible reason.
    const reward = commitFlow(path.state, scoutHandler, def, request(def.nodeId, 'REVEAL_REWARD', 'tx-scout-reward'));
    expect(reward.outcome.result.status).toBe('REJECTED');
    expect(reward.outcome.result.reason).toBe('ACTION_LIMIT');
    const rewardFirst = commitFlow(openAndPrepare(baseState(), scoutHandler, def), scoutHandler, def, request(def.nodeId, 'REVEAL_REWARD', 'tx-scout-reward-first'));
    expect(rewardFirst.state.knowledge).toContain('scout.reward:node-scout-1');
  });

  it('decline provides no information and costs nothing', () => {
    const state = openAndPrepare(baseState(), scoutHandler, def);
    const decline = commitFlow(state, scoutHandler, def, request(def.nodeId, 'DECLINE', 'tx-scout-decline'));
    expect(decline.state.knowledge).toHaveLength(0);
    expect(decline.state.gold).toBe(100);
  });
});
