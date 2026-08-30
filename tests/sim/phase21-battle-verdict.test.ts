/**
 * Phase 21 §9 battle-verdict wiring: the live battle's terminal outcome must
 * decide whether a combat node clears or gates. `resolveBattle(won)` is the
 * seam — a WON fight marks the visit RESOLVED so advancement works; a LOST
 * fight leaves the visit COMMITTED, so `advance` throws until the player
 * retreats. `battleResultOf` maps the live outbound sense to the UI verdict.
 */
import { describe, expect, it } from 'vitest';
import { createExpedition } from '../../src/game/expedition/expedition-runner.js';
import { generateMap } from '../../src/game/expedition/map-generator.js';
import type { ExpeditionMap, MapProfile } from '../../src/game/expedition/types.js';
import { battleResultOf } from '../../src/features/battle/sim/sim-battle-host.js';
import type { LiveOutboundInput } from '../../src/features/battle/outbound/phase21-outbound-presenter.js';
import { battleHandler, bountyForKinds } from '../../src/game/expedition/nodes/handlers/combat.js';
import { createNodeRunState, openVisit } from '../../src/game/expedition/nodes/run-state.js';
import type { NodeDefinition, NodeRunState } from '../../src/game/expedition/nodes/types.js';

const FALLBACK_PROFILE: MapProfile = {
  id: 'exp-verdict.v1',
  logicalLevels: 6,
  targetVisited: [5, 8] as const,
  mandatoryRoles: ['anchor', 'preparation', 'boss'],
  attemptCap: 50,
  fallbackTemplateId: 'fallback.v1',
};

function mapFor(seed: number): ExpeditionMap {
  return generateMap({ seed, profileId: 'exp-verdict.v1', contentRevision: '32.0' }, FALLBACK_PROFILE);
}

/** Walks enter→resolve→advance along the first edge until a combat node is reached (unentered). */
function advanceToCombat(seed: number): ReturnType<typeof createExpedition> {
  let exp = createExpedition(mapFor(seed), { startGold: 200 });
  let guard = 0;
  while (!['battle', 'elite', 'boss'].includes(exp.handler.type) && guard < 60) {
    const next = exp.reachableNodes[0];
    if (next === undefined) throw new Error(`dead-end at ${exp.currentNodeId}`);
    exp = exp.enter(`tx-combat-walk-${String(guard)}`).resolve().advance(next);
    guard += 1;
  }
  if (!['battle', 'elite', 'boss'].includes(exp.handler.type)) {
    throw new Error(`no combat node reached for seed ${String(seed)}`);
  }
  return exp;
}

describe('phase21 battle verdict gating', () => {
  it('maps the live outbound phase to the four UI verdicts', () => {
    const phase = (p: string): LiveOutboundInput => Object.freeze({
      encounterId: 'e',
      objective: 'defeat_all',
      tick: 100,
      phase: Object.freeze({ phase: p, endReason: null }),
      bossPhase: null,
      modifierHookLog: Object.freeze([]),
      events: Object.freeze([]),
    });
    expect(battleResultOf(phase('ACTIVE'))).toBe('active');
    expect(battleResultOf(phase('VICTORY'))).toBe('victory');
    expect(battleResultOf(phase('DEFEAT'))).toBe('defeat');
    expect(battleResultOf(phase('DRAW_ABORT'))).toBe('abort');
  });

  it('a WON battle resolves the node so advancement works', () => {
    let exp = advanceToCombat(203);
    const nodeId = exp.currentNodeId;
    exp = exp.enter('tx-verdict-win-enter');
    expect(exp.state.visits[nodeId]?.status).toBe('COMMITTED');
    exp = exp.resolveBattle(true);
    expect(exp.state.visits[nodeId]?.status).toBe('RESOLVED');
    const next = exp.reachableNodes[0];
    if (next !== undefined) {
      const advanced = exp.advance(next);
      expect(advanced.currentNodeId).toBe(next);
    }
  });

  it('a LOST battle leaves the node unresolved so advancement is gated', () => {
    let exp = advanceToCombat(204);
    const nodeId = exp.currentNodeId;
    exp = exp.enter('tx-verdict-lose-enter');
    exp = exp.resolveBattle(false);
    // The visit stays COMMITTED — the node is cleared only by an explicit retreat.
    expect(exp.state.visits[nodeId]?.status).toBe('COMMITTED');
    const next = exp.reachableNodes[0];
    if (next !== undefined) {
      expect(() => exp.advance(next)).toThrow('expedition.VISIT_STATE_INVALID');
    }
    // Retreat (resolve) clears the node and unlocks advancement.
    exp = exp.resolve();
    expect(exp.state.visits[nodeId]?.status).toBe('RESOLVED');
    if (next !== undefined) {
      expect(exp.advance(next).currentNodeId).toBe(next);
    }
  });

  it('resolveBattle is a no-op on an already-resolved node (won)', () => {
    let exp = advanceToCombat(205);
    const nodeId = exp.currentNodeId;
    exp = exp.enter('tx-verdict-re-enter').resolve();
    expect(exp.state.visits[nodeId]?.status).toBe('RESOLVED');
    const revision = exp.state.revision;
    const again = exp.resolveBattle(true);
    expect(again.state.revision).toBe(revision);
  });

  it('a VICTORY ENGAGE pays the reward exactly once and locks re-engagement', () => {
    let exp = advanceToCombat(206);
    const nodeId = exp.currentNodeId;
    const goldBefore = exp.state.gold;
    const killsBefore = exp.state.killsEarned;
    exp = exp.enter('tx-victory-enter');
    // Enter leaves gold/kills untouched (instability +5 only).
    expect(exp.state.gold).toBe(goldBefore);
    exp = exp.act({ transactionId: 'tx-victory-engage', nodeId, action: 'ENGAGE' });
    expect(exp.state.ledger['tx-victory-engage']?.status).toBe('COMMITTED');
    expect(exp.state.gold).toBeGreaterThan(goldBefore);
    expect(exp.state.killsEarned).toBeGreaterThan(killsBefore);
    // A victory is terminal: neither a second ENGAGE nor an ENGAGE_DEFEAT is
    // allowed after it, and DECLINE is locked too.
    exp = exp.act({ transactionId: 'tx-victory-2', nodeId, action: 'ENGAGE' });
    expect(exp.state.ledger['tx-victory-2']?.status).toBe('REJECTED');
    exp = exp.act({ transactionId: 'tx-victory-defeat', nodeId, action: 'ENGAGE_DEFEAT' });
    expect(exp.state.ledger['tx-victory-defeat']?.status).toBe('REJECTED');
    exp = exp.act({ transactionId: 'tx-victory-decline', nodeId, action: 'DECLINE' });
    expect(exp.state.ledger['tx-victory-decline']?.status).toBe('REJECTED');
  });

  it('a DEFEAT ENGAGE pays nothing, levies escalating instability, re-engages as a deterministic rewatch and retreats', () => {
    let exp = advanceToCombat(207);
    const nodeId = exp.currentNodeId;
    const goldBefore = exp.state.gold;
    const instBefore = exp.state.instability;
    exp = exp.enter('tx-defeat-enter');
    expect(exp.state.instability).toBe(instBefore + 5); // battle enter penalty
    // First defeat: committed, NO reward, +5 instability (the defeat penalty).
    exp = exp.act({ transactionId: 'tx-defeat-1', nodeId, action: 'ENGAGE_DEFEAT' });
    expect(exp.state.ledger['tx-defeat-1']?.status).toBe('COMMITTED');
    expect((exp.state.ledger['tx-defeat-1']?.outcomeIds ?? []).length).toBeGreaterThan(0);
    expect(exp.state.gold).toBe(goldBefore);
    expect(exp.state.killsEarned).toBe(0);
    expect(exp.state.instability).toBe(instBefore + 5 + 5);
    // RE-ENGAGE: a lost fight is a deterministic rewatch of the same seed —
    // repeatable up to the cap, pays nothing again, and the sim verdict is
    // unchanged (a defeat can never flip into a win at the contract level).
    // The penalty ESCALATES: attempt 2 costs +10, attempt 3 costs +15.
    exp = exp.act({ transactionId: 'tx-defeat-2', nodeId, action: 'ENGAGE_DEFEAT' });
    expect(exp.state.ledger['tx-defeat-2']?.status).toBe('COMMITTED');
    expect(exp.state.gold).toBe(goldBefore);
    expect(exp.state.killsEarned).toBe(0);
    expect(exp.state.instability).toBe(instBefore + 5 + 5 + 10);
    exp = exp.act({ transactionId: 'tx-defeat-3', nodeId, action: 'ENGAGE_DEFEAT' });
    expect(exp.state.ledger['tx-defeat-3']?.status).toBe('COMMITTED');
    expect(exp.state.instability).toBe(instBefore + 5 + 5 + 10 + 15);
    // The CAP: a fourth rewatch is rejected (only the retreat remains).
    exp = exp.act({ transactionId: 'tx-defeat-4', nodeId, action: 'ENGAGE_DEFEAT' });
    expect(exp.state.ledger['tx-defeat-4']?.status).toBe('REJECTED');
    expect(exp.state.instability).toBe(instBefore + 5 + 5 + 10 + 15);
    // A victory ENGAGE is rejected after the defeat (no flipping a loss).
    exp = exp.act({ transactionId: 'tx-defeat-victory', nodeId, action: 'ENGAGE' });
    expect(exp.state.ledger['tx-defeat-victory']?.status).toBe('REJECTED');
    // RETREAT: DECLINE is allowed after a defeat and clears the node.
    exp = exp.act({ transactionId: 'tx-defeat-retreat', nodeId, action: 'DECLINE' }).resolve();
    expect(exp.state.visits[nodeId]?.status).toBe('RESOLVED');
    const next = exp.reachableNodes[0];
    if (next !== undefined) {
      expect(exp.advance(next).currentNodeId).toBe(next);
    }
  });

  it('the bounty is FLAT per completed kind — correct because the fold clamps at required (completion is binary)', () => {
    // §9.5 decision (pinned): the objective bounty is a per-kind mission-
    // COMPLETION reward, not a throughput meter scaled by HP. That is exactly
    // right for heal_sustain because applyProgress clamps the counter at
    // `required`: a mission is either incomplete (pays nothing) or has banked
    // >= required (pays the flat kind amount) — a "partial-heal completion"
    // always lands exactly at required, so a scaled bounty would be identical.
    expect(bountyForKinds(['heal_sustain'])).toBe(10); // flat, regardless of the final heal size
    // A partial mission (progress < required) is NOT complete → its kind never
    // enters the list → it pays nothing.
    const partial = Object.freeze({ id: 'o', kind: 'heal_sustain', targetId: null, required: 100, progress: 72, complete: false });
    expect(partial.complete).toBe(false);
    expect(bountyForKinds(partial.complete ? [partial.kind] : [])).toBe(0);
    // A clipped completion (the last heal banks exactly the remaining need)
    // IS complete and pays the same flat amount as a full over-bank.
    const clipped = Object.freeze({ id: 'o', kind: 'heal_sustain', targetId: null, required: 100, progress: 100, complete: true });
    expect(bountyForKinds([clipped.kind])).toBe(bountyForKinds(['heal_sustain']));
  });

  it('a mission victory ENGAGE persists the completed kinds so the result screen can derive the bounty', () => {
    // §9.5 the post-ENGAGE result screen reads the last committed ledger record
    // to derive the bounty durably (across reloads) — the completed kinds must
    // ride the committed ENGAGE transaction, and bountyForKinds must recover the
    // contract sum from them.
    let exp = advanceToCombat(211);
    const nodeId = exp.currentNodeId;
    exp = exp.enter('tx-persist-enter').act({ transactionId: 'tx-persist-engage', nodeId, action: 'ENGAGE', completedKinds: ['heal_sustain', 'survive_until'] });
    const record = exp.state.ledger['tx-persist-engage'] as { status: string; completedKinds?: readonly string[] };
    expect(record.status).toBe('COMMITTED');
    expect(record.completedKinds).toEqual(['heal_sustain', 'survive_until']);
    expect(bountyForKinds(record.completedKinds ?? [])).toBe(20);
  });

  it('a re-engage is rejected at the instability ceiling', () => {
    const DEF: NodeDefinition = Object.freeze({ nodeId: 'n1', type: 'battle', contentRevision: '32.0', payloadKey: 'e' });
    const defeatState = (instability: number, rewatches = 0): NodeRunState => {
      let state = openVisit(createNodeRunState({ runId: 'r1', modeId: 'm', contentRevision: '32.0', seed: 1, mapHash: 'h', gold: 500 }), 'n1', 0);
      state = { ...state, instability };
      for (let i = 0; i < rewatches; i += 1) {
        state = {
          ...state,
          ledger: {
            ...state.ledger,
            [`tx-pre-${String(i)}`]: Object.freeze({
              transactionId: `tx-pre-${String(i)}`, nodeId: 'n1', action: 'ENGAGE_DEFEAT', status: 'COMMITTED', outcomeIds: Object.freeze([]),
            }),
          },
        };
      }
      return state;
    };
    const validateDefeat = (state: NodeRunState): string | null =>
      battleHandler.validate(DEF, Object.freeze({ transactionId: 'tx-now', nodeId: 'n1', action: 'ENGAGE_DEFEAT' }), state);
    // Fresh: 90 + 5 = 95 ≤ 100 → accepted.
    expect(validateDefeat(defeatState(90))).toBeNull();
    // 96 + 5 = 101 > 100 → rejected at the ceiling.
    expect(validateDefeat(defeatState(96))).toBe('OPTION_UNAVAILABLE');
    // After one rewatch (instability already 95) the NEXT tax is +10: 95 + 10 =
    // 105 > 100 → the ceiling binds before the attempt cap (3 rewatches).
    expect(validateDefeat(defeatState(95, 1))).toBe('OPTION_UNAVAILABLE');
    // Below the ceiling the escalation is unaffected by it.
    expect(validateDefeat(defeatState(85, 1))).toBeNull(); // 85 + 10 = 95 ≤ 100
  });

  it('a mission-completed victory ENGAGE pays the per-kind objective bounty on top of the base reward', () => {
    // §9.5 objective-to-reward linkage: the deterministic sim completed the
    // mission (the UI reports the completed kinds from the live objective
    // projection), so the victory pays the base reward PLUS the per-kind
    // bounty. The same node without completed kinds pays the base reward only.
    const withBonus = advanceToCombat(208);
    const nodeId = withBonus.currentNodeId;
    const goldBefore = withBonus.state.gold;
    let exp = withBonus.enter('tx-bonus-enter').act({ transactionId: 'tx-bonus-engage', nodeId, action: 'ENGAGE', completedKinds: ['heal_sustain'] });
    const bonusGold = exp.state.gold - goldBefore;
    expect(bonusGold).toBeGreaterThanOrEqual(11); // base (45..71) + 10 bounty
    expect(exp.state.ledger['tx-bonus-engage']?.status).toBe('COMMITTED');
    // Without the kinds on the SAME seed (identical base reward): exactly 10
    // gold less — the bounty is isolated from the seed-derived base.
    const noBonus = advanceToCombat(208);
    const nId = noBonus.currentNodeId;
    const nBefore = noBonus.state.gold;
    const plain = noBonus.enter('tx-plain-enter').act({ transactionId: 'tx-plain-engage', nodeId: nId, action: 'ENGAGE' });
    expect(plain.state.gold - nBefore).toBe(bonusGold - 10);
    // A per-kind sum: a multi-kind mission pays each completed kind (kill_boss
    // 15 + survive_until 10 = 25 over the same base) — unknown kinds pay 0.
    const multi = advanceToCombat(209);
    const mId = multi.currentNodeId;
    const mBefore = multi.state.gold;
    const multiPaid = multi.enter('tx-multi-enter').act({ transactionId: 'tx-multi-engage', nodeId: mId, action: 'ENGAGE', completedKinds: ['kill_boss', 'survive_until', 'not_a_kind'] });
    expect(multiPaid.state.gold - mBefore).toBeGreaterThanOrEqual(45 + 25);
    // A defeat ENGAGE never pays the bounty (it pays nothing at all).
    const defeat = advanceToCombat(210);
    const dId = defeat.currentNodeId;
    const dBefore = defeat.state.gold;
    const lost = defeat.enter('tx-lost-enter').act({ transactionId: 'tx-lost-engage', nodeId: dId, action: 'ENGAGE_DEFEAT', completedKinds: ['heal_sustain'] });
    expect(lost.state.gold).toBe(dBefore);
  });
});
