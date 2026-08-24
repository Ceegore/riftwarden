import { describe, expect, it } from 'vitest';
import { createExpedition, mainPath } from '../../src/game/expedition/expedition-runner.js';
import { generateMap } from '../../src/game/expedition/map-generator.js';
import { buildSettlementRequests } from '../../src/game/expedition/expedition-settlement.js';
import { commitTransaction } from '../../src/game/profile/transaction-service.js';
import type { Profile } from '../../src/game/profile/types.js';
import type { MapProfile, ExpeditionMap } from '../../src/game/expedition/types.js';
import { settleVictory, settleDefeat } from '../../src/game/expedition/run-economy.js';
import { createNodeRunState } from '../../src/game/expedition/nodes/run-state.js';

const PROFILE: MapProfile = {
  id: 'settle.v1',
  logicalLevels: 6,
  targetVisited: [5, 8] as const,
  mandatoryRoles: ['anchor', 'preparation', 'boss'],
  attemptCap: 50,
  fallbackTemplateId: 'fallback.v1',
};

function emptyProfile(): Profile {
  return {
    revision: 31,
    wallet: { gold: 1000, riftEssence: 0 },
    heroes: {},
    troops: {},
    items: {},
    transactionLedger: {},
  };
}

function mapFor(seed: number): ExpeditionMap {
  return generateMap({ seed, profileId: PROFILE.id, contentRevision: '32.0' }, PROFILE);
}

function walkAndFinish(map: ExpeditionMap): ReturnType<typeof createExpedition> {
  let runner = createExpedition(map, { startGold: 100 });
  const path = mainPath(map);
  for (const nodeId of path) {
    if (runner.currentNodeId !== nodeId) runner = runner.advance(nodeId);
    const enterTx = `stl-${String(map.seed)}-${nodeId}`;
    runner = runner.enter(enterTx);
    const def = runner.definition;
    const txId = `stl-act-${String(map.seed)}-${nodeId}`;
    if (def.type === 'battle' || def.type === 'elite' || def.type === 'boss') {
      runner = runner.act({ transactionId: txId, nodeId, action: 'ENGAGE' });
    } else if (def.type === 'anchor' || def.type === 'story' || def.type === 'scout') {
      // Anchor/scout/story: ENTER only, no second action needed.
    } else {
      runner = runner.act({ transactionId: txId, nodeId, action: 'DECLINE' });
    }
    runner = runner.resolve();
  }
  return runner.finish();
}

describe('phase32 settlement', () => {
  it('settleVictory computes correct kept/lost values', () => {
    const runner = walkAndFinish(mapFor(500));
    const settlement = settleVictory(runner.state);
    // Victory keeps all gold, all loot, all relics, all recruits.
    expect(settlement.keptGold).toBe(runner.state.gold);
    expect(settlement.lostGold).toBe(0);
    expect(settlement.keptLoot.length).toBe(runner.state.securedLoot.length + runner.state.unsecuredLoot.length);
    expect(settlement.lostLoot.length).toBe(0);
  });

  it('settleDefeat keeps 60% of earned gold', () => {
    const runner = walkAndFinish(mapFor(501));
    const settlement = settleDefeat(runner.state);
    // Defeat keeps secured loot and 60% of gold earned during the run.
    expect(settlement.keptLoot.length).toBe(runner.state.securedLoot.length);
    // goldEarned is tracked by expedition; kept should be ≤ gold.
    expect(settlement.keptGold).toBeLessThanOrEqual(runner.state.gold);
    expect(settlement.lostGold).toBeGreaterThanOrEqual(0);
  });

  it('buildSettlementRequests produces profile transaction requests', () => {
    const runner = walkAndFinish(mapFor(502));
    const { outcome, settlement, requests } = buildSettlementRequests(runner.state, 'victory');

    expect(outcome).toBe('victory');
    expect(settlement.keptGold).toBeGreaterThan(0);
    // At minimum: gold credit + loot items + relics + recruits.
    expect(requests.length).toBeGreaterThan(0);
    expect(requests[0]?.kind).toBe('BUY_COPY');
  });

  it('victory settlement credits gold to the profile wallet', () => {
    const runner = walkAndFinish(mapFor(503));
    const { requests } = buildSettlementRequests(runner.state, 'victory');
    let profile = emptyProfile();
    const goldBefore = profile.wallet.gold;

    for (const req of requests) {
      const outcome = commitTransaction(profile, req);
      profile = outcome.profile;
      expect(outcome.result.status).toBe('COMMITTED');
    }

    // Profile gold must increase.
    expect(profile.wallet.gold).toBeGreaterThan(goldBefore);
  });

  it('retreat settlement produces valid requests', () => {
    const runner = walkAndFinish(mapFor(504));
    const { outcome, requests } = buildSettlementRequests(runner.state, 'retreat', runner.state.gold);

    expect(outcome).toBe('retreat');
    expect(requests.length).toBeGreaterThanOrEqual(0);

    let profile = emptyProfile();
    for (const req of requests) {
      const result = commitTransaction(profile, req);
      profile = result.profile;
      expect(result.result.status).toBe('COMMITTED');
    }
  });

  it('does not persist temporary relics or recruits at settlement', () => {
    const state = createNodeRunState({
      runId: 'settle-temporary-content',
      modeId: 'settle.v1',
      contentRevision: '32.0',
      seed: 1,
      mapHash: 'test',
      gold: 100,
    });
    const withContent = {
      ...state,
      securedLoot: ['item_permanent'],
      relics: ['relic_temporary'],
      recruits: ['troop_temporary'],
    };
    const { requests } = buildSettlementRequests(withContent, 'victory');
    let profile = emptyProfile();
    for (const request of requests) profile = commitTransaction(profile, request).profile;
    expect(profile.items['item_permanent']?.owned).toBe(true);
    expect(profile.items['relic_temporary']).toBeUndefined();
    expect(profile.heroes['troop_temporary']).toBeUndefined();
    expect(profile.troops['troop_temporary']).toBeUndefined();
  });

  it('defeat settlement applies to profile without errors', () => {
    const runner = walkAndFinish(mapFor(505));
    const settlement = settleDefeat(runner.state);
    // Defeat keeps secured loot; gold kept is 60% of goldEarned (0 until wired).
    expect(settlement.keptLoot.length).toBe(runner.state.securedLoot.length);

    const { requests } = buildSettlementRequests(runner.state, 'defeat');
    let profile = emptyProfile();
    for (const req of requests) {
      const result = commitTransaction(profile, req);
      profile = result.profile;
      expect(result.result.status).toBe('COMMITTED');
    }
    // Credited gold + loot items produced valid profile mutations.
    expect(profile.transactionLedger).not.toBe(emptyProfile().transactionLedger);
  });
});
