/**
 * Phase 21 §9.5 RELOAD AFTER A COMMITTED VICTORY. The mid-battle reload test
 * proved a reload DURING a fight never re-litigates the outcome; this test
 * proves a reload AFTER the victory ENGAGE is committed keeps the reward
 * intact and the run progressing:
 *
 *   1. GOLD/KILLS INTACT — the committed grant survives encode → restore
 *      byte-identically (never re-granted, never lost);
 *   2. BOUNTY DERIVABLE — the persisted ENGAGE record's completedKinds are
 *      there, and the reward screens' exact derivation reproduces the bounty;
 *   3. REPLAY IDEMPOTENT — replaying the same victory ENGAGE transaction on
 *      the restored run grants nothing (the exactly-once contract holds
 *      across the save boundary);
 *   4. CLAIM PATH — a claimed loot reward survives the reload, and neither a
 *      replay nor a second claim double-grants;
 *   5. PROGRESSION — the restored visit resolves and advances to the next
 *      node like a no-reload victory.
 */
import { describe, expect, it } from 'vitest';
import { createExpedition } from '../../src/game/expedition/expedition-runner.js';
import { generateMap } from '../../src/game/expedition/map-generator.js';
import type { ExpeditionMap, MapProfile } from '../../src/game/expedition/types.js';
import { bountyForKinds } from '../../src/game/expedition/nodes/handlers/combat.js';
import { encodeExpeditionSave, restoreExpeditionSave } from '../../src/game/expedition/expedition-save.js';

const PROFILE: MapProfile = {
  id: 'exp-vicreload.v1',
  logicalLevels: 6,
  targetVisited: [5, 8] as const,
  mandatoryRoles: ['anchor', 'preparation', 'boss'],
  attemptCap: 50,
  fallbackTemplateId: 'fallback.v1',
};

function mapFor(seed: number): ExpeditionMap {
  return generateMap({ seed, profileId: 'exp-vicreload.v1', contentRevision: '32.0' }, PROFILE);
}

/** Walks to the first combat node (unentered). */
function walkToCombat(seed: number): ReturnType<typeof createExpedition> {
  let exp = createExpedition(mapFor(seed), { startGold: 300 });
  let guard = 0;
  while (!['battle', 'elite', 'boss'].includes(exp.definition.type)) {
    const next = exp.reachableNodes[0];
    if (next === undefined) throw new Error(`dead-end at ${exp.currentNodeId}`);
    exp = exp.enter(`vr-walk-${String(guard)}`).resolve().advance(next);
    guard += 1;
    if (guard > 150) throw new Error('walk diverged');
  }
  return exp;
}

describe('P21 §9.5 reload after a committed victory', () => {
  it('a committed victory survives the boundary: gold/kills intact, bounty derivable, replay pays nothing, node progresses', () => {
    const seed = 701;
    const kinds: readonly string[] = ['kill_regulars', 'heal_sustain'];
    const bounty = bountyForKinds(kinds);
    expect(bounty).toBe(15); // 5 + 10

    const walked = walkToCombat(seed);
    const nodeId = walked.currentNodeId;
    const tx = 'vr-engage';
    const committed = walked.enter('vr-enter').act({ transactionId: tx, nodeId, action: 'ENGAGE', completedKinds: kinds });
    expect(committed.state.ledger[tx]?.status).toBe('COMMITTED');
    // The victory keeps the node open (reward pending) — visit COMMITTED with
    // the durable last-commit marker set to the ENGAGE record.
    expect(committed.state.visits[nodeId]?.status).toBe('COMMITTED');
    expect(committed.state.visits[nodeId]?.transactionId).toBe(tx);
    const goldAfter = committed.state.gold;
    const killsAfter = committed.state.killsEarned;

    // RELOAD: encode → restore.
    const restored = restoreExpeditionSave(encodeExpeditionSave(committed), mapFor(seed));
    expect(restored.currentNodeId).toBe(nodeId);
    expect(restored.state.visits[nodeId]?.transactionId).toBe(tx);
    // 1. The committed grant survived exactly.
    expect(restored.state.gold).toBe(goldAfter);
    expect(restored.state.killsEarned).toBe(killsAfter);
    // 2. The persisted record still carries the kinds; the reward screens'
    //    derivation reproduces the bounty.
    const record = restored.state.ledger[tx];
    expect(record?.completedKinds).toEqual(kinds);
    expect(bountyForKinds(record?.completedKinds ?? [])).toBe(bounty);
    // 3. Replaying the same transaction on the restored run grants nothing.
    const replay = restored.act({ transactionId: tx, nodeId, action: 'ENGAGE', completedKinds: kinds });
    expect(replay.state.revision).toBe(restored.state.revision);
    expect(replay.state.gold).toBe(goldAfter);
    expect(replay.state.killsEarned).toBe(killsAfter);
    // 4. The restored visit resolves and the run advances past the node.
    const resolved = replay.resolve();
    expect(resolved.state.visits[nodeId]?.status).toBe('RESOLVED');
    const next = resolved.reachableNodes[0];
    if (next === undefined) throw new Error('no next node after victory');
    const advanced = resolved.advance(next);
    expect(advanced.currentNodeId).toBe(next);
    expect(advanced.state.gold).toBe(goldAfter);
  });

  it('a claimed victory reward survives the reload and never double-grants', () => {
    const seed = 702;
    const walked = walkToCombat(seed);
    const nodeId = walked.currentNodeId;
    const engaged = walked.enter('vr-claim-enter').act({ transactionId: 'vr-claim-engage', nodeId, action: 'ENGAGE', completedKinds: ['kill_regulars'] });
    const snap = engaged.state.snapshots[nodeId];
    if (snap === undefined || snap.kind !== 'REWARD') throw new Error('no reward snapshot');
    const optionId = snap.rewardIds[0];
    if (optionId === undefined) throw new Error('empty reward ids');
    const claimed = engaged.act({ transactionId: 'vr-claim', nodeId, action: 'CLAIM_REWARD', optionId });
    expect(claimed.state.ledger['vr-claim']?.status).toBe('COMMITTED');
    const lootAfter = claimed.state.unsecuredLoot;
    const goldAfter = claimed.state.gold;

    const restored = restoreExpeditionSave(encodeExpeditionSave(claimed), mapFor(seed));
    expect(restored.state.unsecuredLoot).toEqual(lootAfter);
    expect(restored.state.gold).toBe(goldAfter);
    // The claimed reward is not granted again — neither by replaying the same
    // claim nor by a second claim on the restored run.
    const replay = restored.act({ transactionId: 'vr-claim', nodeId, action: 'CLAIM_REWARD', optionId });
    expect(replay.state.unsecuredLoot).toEqual(lootAfter);
    const second = restored.act({ transactionId: 'vr-claim-2', nodeId, action: 'CLAIM_REWARD', optionId });
    expect(second.state.ledger['vr-claim-2']?.status).toBe('REJECTED');
    expect(second.state.unsecuredLoot).toEqual(lootAfter);
    expect(second.state.gold).toBe(goldAfter);
  });

  it('a DEFEAT record persisted before the reload never turns into a reward', () => {
    const seed = 703;
    const walked = walkToCombat(seed);
    const nodeId = walked.currentNodeId;
    const defeated = walked.enter('vr-defeat-enter').act({ transactionId: 'vr-defeat', nodeId, action: 'ENGAGE_DEFEAT' });
    expect(defeated.state.ledger['vr-defeat']?.status).toBe('COMMITTED');
    // §9.5 the codec only persists completedKinds on a victory ENGAGE — a
    // defeat record must carry none (the ledger would lie about a lost fight).
    expect(defeated.state.ledger['vr-defeat']?.completedKinds).toBeUndefined();
    const restored = restoreExpeditionSave(encodeExpeditionSave(defeated), mapFor(seed));
    expect(restored.state.ledger['vr-defeat']?.completedKinds).toBeUndefined();
    expect(restored.state.gold).toBe(defeated.state.gold);
    expect(restored.state.killsEarned).toBe(defeated.state.killsEarned);
  });
});
