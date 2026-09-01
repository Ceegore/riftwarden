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
import { battleResultOf, engageAvailableFor, engageGateReason } from '../../src/features/battle/sim/sim-battle-host.js';
import type { LiveOutboundInput } from '../../src/features/battle/outbound/phase21-outbound-presenter.js';
import { battleHandler, bountyBreakdownForKinds, bountyForKinds } from '../../src/game/expedition/nodes/handlers/combat.js';
import { decodeExpeditionSave, encodeExpeditionSave, restoreExpeditionSave } from '../../src/game/expedition/expedition-save.js';
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

  it('the victory ENGAGE is gated on a terminal live VICTORY (never mid-battle)', () => {
    // §9 the win path may only be committed once the live battle actually won
    // — a mid-battle (active) or lost/aborted fight must not pay the reward.
    expect(engageAvailableFor('victory')).toBe(true);
    expect(engageAvailableFor('active')).toBe(false);
    expect(engageAvailableFor('defeat')).toBe(false);
    expect(engageAvailableFor('abort')).toBe(false);
  });

  it('the ENGAGE gate UX reason explains each blocked verdict (never a silent lockout)', () => {
    // The disabled ENGAGE button renders the reason — each non-victory verdict
    // maps to an explicit, actionable message; a terminal VICTORY unlocks it.
    expect(engageGateReason('victory')).toBeNull();
    expect(engageGateReason('active')).toBe('Battle in progress — ENGAGE unlocks on victory');
    expect(engageGateReason('defeat')).toBe('The battle was lost — re-engage or retreat');
    expect(engageGateReason('abort')).toBe('The battle aborted — retreat to continue');
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
    // §9.5 per-kind breakdown: exactly one entry per paying kind, in input
    // order, with the contract amount — unknown kinds are omitted entirely.
    expect(bountyBreakdownForKinds(['kill_boss', 'survive_until', 'not_a_kind'])).toEqual([
      Object.freeze({ kind: 'kill_boss', amount: 15 }),
      Object.freeze({ kind: 'survive_until', amount: 10 }),
    ]);
    expect(bountyBreakdownForKinds([])).toEqual([]);
    expect(bountyBreakdownForKinds(['unknown_kind'])).toEqual([]);
  });

  it('the reward-screen bounty survives a save → reload round trip (reload continuity)', () => {
    // The reward screen derives the bounty from the committed ENGAGE's
    // completed kinds on the ledger. A RELOAD must preserve that: the save
    // codec used to REJECT ledger records carrying completedKinds (UNKNOWN_FIELD),
    // which crashed the restore of any victory-ENGAGE run — the codec now
    // round-trips them, so the reward screen shows the same bounty before and
    // after the reload.
    let exp = advanceToCombat(212);
    const nodeId = exp.currentNodeId;
    exp = exp.enter('tx-reload-enter').act({
      transactionId: 'tx-reload-engage',
      nodeId,
      action: 'ENGAGE',
      completedKinds: ['heal_sustain', 'survive_until'],
    });
    const goldBefore = exp.state.gold;
    // The reward screen's derivation (same expression RewardChoiceScreen uses).
    const engage = Object.values(exp.state.ledger).find(
      (entry) => entry.nodeId === exp.currentNodeId && entry.action === 'ENGAGE' && entry.status === 'COMMITTED',
    );
    expect(engage).toBeDefined();
    const bountyBefore = bountyForKinds(engage?.completedKinds ?? []);
    expect(bountyBefore).toBe(20);

    // Serialize → decode (the codec previously threw UNKNOWN_FIELD here) →
    // restore against the same deterministic map.
    const serialized = encodeExpeditionSave(exp);
    const decoded = decodeExpeditionSave(JSON.parse(serialized));
    const reloadedTx = decoded.state.ledger['tx-reload-engage'];
    expect(reloadedTx?.status).toBe('COMMITTED');
    expect(reloadedTx?.completedKinds).toEqual(['heal_sustain', 'survive_until']);
    expect(bountyForKinds(reloadedTx?.completedKinds ?? [])).toBe(bountyBefore);
    const restored = restoreExpeditionSave(serialized, mapFor(212));
    expect(restored.state.ledger['tx-reload-engage']?.completedKinds).toEqual(['heal_sustain', 'survive_until']);
    expect(restored.state.gold).toBe(goldBefore);
    expect(restored.currentNodeId).toBe(nodeId);
    // The derived bounty after the reload is byte-identical to before it.
    const after = Object.values(restored.state.ledger).find(
      (entry) => entry.nodeId === restored.currentNodeId && entry.action === 'ENGAGE' && entry.status === 'COMMITTED',
    );
    expect(bountyForKinds(after?.completedKinds ?? [])).toBe(bountyBefore);
  });

  it('the save codec CONTRACT: ledger completedKinds round-trips valid values and rejects malformed shapes', () => {
    // §9.5 codec contract: the ledger record's completedKinds must be a STRING
    // LIST — the codec round-trips valid values (including empty and
    // forward-compatible unknown kinds, which pay 0) and rejects every
    // malformed shape with INVALID_FIELD instead of silently dropping or
    // crashing the restore.
    const commitWith = (completedKinds: readonly string[]): { serialized: string; decoded: NodeRunState } => {
      let exp = advanceToCombat(213);
      const nodeId = exp.currentNodeId;
      exp = exp.enter('tx-codec-enter').act({
        transactionId: 'tx-codec-engage',
        nodeId,
        action: 'ENGAGE',
        completedKinds,
      });
      const serialized = encodeExpeditionSave(exp);
      return { serialized, decoded: decodeExpeditionSave(JSON.parse(serialized)).state };
    };
    // Empty list: round-trips as present-empty.
    expect(commitWith([]).decoded.ledger['tx-codec-engage']?.completedKinds).toEqual([]);
    // Unknown kinds (forward compatibility): preserved, pay 0 — never dropped.
    expect(commitWith(['future_kind']).decoded.ledger['tx-codec-engage']?.completedKinds).toEqual(['future_kind']);
    // The ENCODE side must also carry them through canonicalJson byte-identically.
    const mixed = commitWith(['kill_boss', 'survive_until']);
    expect(mixed.decoded.ledger['tx-codec-engage']?.completedKinds).toEqual(['kill_boss', 'survive_until']);
    expect(mixed.serialized).toContain('"completedKinds":["kill_boss","survive_until"]');

    // Malformed shapes: decode a save whose ledger record carries a NON-ARRAY
    // completedKinds or non-string entries — both must throw INVALID_FIELD.
    const poke = (completedKinds: unknown): void => {
      const value = JSON.parse(mixed.serialized) as Record<string, unknown>;
      const state = value['state'] as Record<string, unknown>;
      const ledger = state['ledger'] as Record<string, unknown>;
      const record = ledger['tx-codec-engage'] as Record<string, unknown>;
      record['completedKinds'] = completedKinds;
      expect(() => decodeExpeditionSave(value)).toThrow('INVALID_FIELD');
    };
    poke([1, 2]);
    poke('heal_sustain');
    poke(42);
  });

  it('the VISIT transactionId is the durable last-committed action — even after a codec reorder', () => {
    // §9 audit: the battle screen's "last committed action" must come from the
    // VISIT's transactionId (set on every commit), never from an
    // insertion-order scan of the ledger map — the save codec canonicalizes
    // (sorts) map keys, so the ledger's insertion order is NOT a contract.
    let exp = advanceToCombat(215);
    const nodeId = exp.currentNodeId;
    exp = exp.enter('tx-last-enter');
    // The REWARD snapshot is materialized at ENTER — read the first reward id.
    const rewardIds = exp.state.snapshots[nodeId]?.kind === 'REWARD'
      ? (exp.state.snapshots[nodeId] as { rewardIds: readonly string[] }).rewardIds
      : [];
    const optionId = rewardIds[0];
    if (optionId === undefined) throw new Error('no reward ids materialized');
    exp = exp.act({ transactionId: 'tx-last-engage', nodeId, action: 'ENGAGE', completedKinds: ['heal_sustain'] });
    exp = exp.act({ transactionId: 'tx-last-claim', nodeId, action: 'CLAIM_REWARD', optionId });
    expect(exp.state.visits[nodeId]?.transactionId).toBe('tx-last-claim');
    const last = exp.state.ledger[exp.state.visits[nodeId]?.transactionId ?? ''];
    expect(last?.action).toBe('CLAIM_REWARD');
    // After a save → decode (which SORTS the ledger keys), the visit marker
    // still names the same last-committed record.
    const decoded = decodeExpeditionSave(JSON.parse(encodeExpeditionSave(exp))).state;
    const decodedLast = decoded.ledger[decoded.visits[nodeId]?.transactionId ?? ''];
    expect(decodedLast?.action).toBe('CLAIM_REWARD');
    expect(decodedLast).toEqual(exp.state.ledger['tx-last-claim']);
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
    // A defeat ENGAGE never pays the bounty (it pays nothing at all) and its
    // ledger record NEVER claims completed kinds (a lost fight cannot report
    // completed objectives — the ledger would lie about it).
    const defeat = advanceToCombat(210);
    const dId = defeat.currentNodeId;
    const dBefore = defeat.state.gold;
    const lost = defeat.enter('tx-lost-enter').act({ transactionId: 'tx-lost-engage', nodeId: dId, action: 'ENGAGE_DEFEAT', completedKinds: ['heal_sustain'] });
    expect(lost.state.gold).toBe(dBefore);
    expect((lost.state.ledger['tx-lost-engage'] as { completedKinds?: readonly string[] }).completedKinds).toBeUndefined();
  });
});
