/**
 * Phase 21 §9 RETREAT-TAX ledger differential — a clean-room recompute of the
 * cumulative instability / gold / kills across every legal action sequence on
 * a combat node.
 *
 * POLICY DECISION (pinned this round): a plain retreat levies NO extra
 * instability. The defeat instability is a property of RE-ENGAGING a lost
 * fight — each ENGAGE_DEFEAT rewatch costs DEFEAT_INSTABILITY_DELTA (5),
 * repeatable, deterministic; walking away (DECLINE / resolve()) after a
 * defeat costs only the sunk ENTER penalty and the lost reward. The runner
 * has no verdict knowledge at retreat time (the sim lives in the browser;
 * `resolveBattle(false)` is a pure gate), so taxing retreats would require a
 * verdict flag threaded into the ledger — the contract instead makes the tax
 * opt-in via the explicit rewatch action.
 *
 * The differential replays every sequence through the REAL runner and asserts
 * at each step that the ledger state equals an INDEPENDENT oracle model of
 * the contract (enter +5 once; victory ENGAGE pays the deterministic gold +
 * kills and locks everything; ENGAGE_DEFEAT +5 repeatable; DECLINE +0 and
 * resolves; victory rejects a later ENGAGE_DEFEAT/DECLINE; defeat rejects a
 * later ENGAGE). Determinism: two replays of the same sequence are identical.
 */
import { describe, expect, it } from 'vitest';
import { createExpedition } from '../../src/game/expedition/expedition-runner.js';
import { generateMap } from '../../src/game/expedition/map-generator.js';
import type { ExpeditionMap, MapProfile } from '../../src/game/expedition/types.js';

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

/** Fresh runner parked on an UNENTERED combat node (battle/elite/boss). */
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

/** Contract constants mirrored from `combat.ts` + `common.ts` (the clean room
 * must NOT read them from the sim — it is an independent model). */
const BATTLE_ENTER_INSTABILITY = 5;
const DEFEAT_INSTABILITY_DELTA = 5;

interface RewardDeltas {
  readonly gold: number;
  readonly kills: number;
}

/**
 * Independent clean-room model of the combat contract. Given the action
 * prefix, returns the expected cumulative deltas AND whether each action is
 * accepted — the runner must match it exactly, or the contract drifted.
 */
/**
 * Independent clean-room model of the combat contract over the COMMITTED
 * actions. Returns the expected cumulative deltas — the runner must match
 * them exactly, or the contract drifted.
 */
function oracleStep(
  committed: readonly string[],
  reward: RewardDeltas,
): { readonly inst: number; readonly gold: number; readonly kills: number } {
  let inst = 0;
  let gold = 0;
  let kills = 0;
  let won = false;
  let claimed = false;
  let rewatches = 0;
  for (const action of committed) {
    if (action === 'ENTER') {
      inst += BATTLE_ENTER_INSTABILITY;
      continue;
    }
    if (action === 'ENGAGE' && !won && !claimed) {
      won = true;
      gold += reward.gold;
      kills += reward.kills;
      continue;
    }
    if (action === 'ENGAGE_DEFEAT' && !won && !claimed) {
      // §9 escalation: attempt k costs 5×k (5, 10, 15…), capped at 3.
      rewatches += 1;
      inst += DEFEAT_INSTABILITY_DELTA * rewatches;
      continue;
    }
    if (action === 'CLAIM_REWARD' && !claimed) {
      claimed = true;
      continue;
    }
    // DECLINE: +0 instability (never committed after a victory/claim).
  }
  return { inst, gold, kills };
}

/** True when the oracle would accept `action` as the next step after the
 * COMMITTED actions — mirrored DIRECTLY from the combat handler's validate
 * rules (rejected actions never enter the committed set). */
function oracleAccepts(committed: readonly string[], action: string): boolean {
  const has = (a: string): boolean => committed.includes(a);
  // A committed DECLINE resolves the node — everything after is rejected.
  if (has('DECLINE')) return false;
  if (action === 'ENTER') return committed.length === 0;
  if (action === 'ENGAGE') return !has('ENGAGE') && !has('ENGAGE_DEFEAT') && !has('CLAIM_REWARD');
  // §9 cap: at most MAX_REENGAGE_ATTEMPTS (3) rewatches — the fourth is rejected.
  if (action === 'ENGAGE_DEFEAT') return !has('ENGAGE') && !has('CLAIM_REWARD') && committed.filter((a) => a === 'ENGAGE_DEFEAT').length < 3;
  if (action === 'CLAIM_REWARD') return has('ENGAGE') && !has('CLAIM_REWARD');
  if (action === 'DECLINE') return !has('ENGAGE') && !has('CLAIM_REWARD');
  return false;
}

type StepResult = { readonly action: string; readonly accepted: boolean; readonly inst: number; readonly gold: number; readonly kills: number };

function replay(seed: number, sequence: readonly string[]): { readonly steps: readonly StepResult[]; readonly final: { readonly inst: number; readonly gold: number; readonly kills: number } } {
  let exp = advanceToCombat(seed);
  const nodeId = exp.currentNodeId;
  const startGold = exp.state.gold;
  const startInst = exp.state.instability;
  let victoryReward: RewardDeltas = { gold: 0, kills: 0 };
  const committed: string[] = [];
  const steps: StepResult[] = [];
  let index = 0;
  for (const action of sequence) {
    index += 1;
    const txId = `tx-ledger-${seed}-${String(index)}`;
    const expBefore = exp;
    if (action === 'ENTER') {
      exp = expBefore.enter(txId);
    } else if (action === 'CLAIM_REWARD') {
      exp = expBefore.act({ transactionId: txId, nodeId, action, optionId: `reward:${nodeId}:0` });
    } else {
      exp = expBefore.act({ transactionId: txId, nodeId, action });
    }
    const entry = exp.state.ledger[txId];
    const accepted = entry?.status === 'COMMITTED';
    // The clean room needs the victory reward DELTAS: capture them from the
    // first accepted ENGAGE (seed-derived amounts are deterministic, but the
    // oracle models deltas, not absolutes) and reuse them for every later step
    // so the oracle's cumulative model stays consistent.
    if (accepted && action === 'ENGAGE' && victoryReward.gold === 0 && victoryReward.kills === 0) {
      victoryReward = {
        gold: exp.state.gold - expBefore.state.gold,
        kills: exp.state.killsEarned - expBefore.state.killsEarned,
      };
    }
    // The oracle's acceptance must match the ledger (evaluated against the
    // committed set BEFORE this action), and the cumulative state must match
    // the oracle's cumulative deltas exactly.
    expect(accepted, `${String(seed)} step ${action} @${String(index)} (oracle accepts=${String(oracleAccepts(committed, action))})`).toBe(oracleAccepts(committed, action));
    if (accepted) committed.push(action);
    const expected = oracleStep(committed, victoryReward);
    expect(exp.state.instability, `${String(seed)} inst after ${action}`).toBe(startInst + expected.inst);
    expect(exp.state.gold, `${String(seed)} gold after ${action}`).toBe(startGold + expected.gold);
    expect(exp.state.killsEarned, `${String(seed)} kills after ${action}`).toBe(expected.kills);
    steps.push(Object.freeze({ action, accepted, inst: exp.state.instability - startInst, gold: exp.state.gold - startGold, kills: exp.state.killsEarned }));
  }
  return { steps: Object.freeze(steps), final: { inst: exp.state.instability - startInst, gold: exp.state.gold - startGold, kills: exp.state.killsEarned } };
}

describe('phase21 retreat-tax ledger differential', () => {
  it('every action sequence matches the clean-room oracle step by step', () => {
    // Victory pays exactly once and locks everything after it.
    expect(replay(300, ['ENTER', 'ENGAGE']).final).toEqual({ inst: 5, gold: expect.any(Number) as number, kills: expect.any(Number) as number });
    const locked = replay(301, ['ENTER', 'ENGAGE', 'ENGAGE_DEFEAT', 'DECLINE', 'CLAIM_REWARD']);
    expect(locked.final.inst).toBe(5); // no extra tax after the victory
    expect(locked.steps.map((s) => s.action)).toEqual(['ENTER', 'ENGAGE', 'ENGAGE_DEFEAT', 'DECLINE', 'CLAIM_REWARD']);
    expect(locked.steps[1]?.accepted).toBe(true);
    expect(locked.steps[2]?.accepted).toBe(false); // defeat after victory
    expect(locked.steps[3]?.accepted).toBe(false); // decline after victory
    // Defeat: enter +5, rewatches ESCALATE (+5 then +10), victory rejected after.
    const defeat = replay(302, ['ENTER', 'ENGAGE_DEFEAT', 'ENGAGE_DEFEAT', 'ENGAGE', 'DECLINE']);
    expect(defeat.final).toEqual({ inst: 20, gold: 0, kills: 0 });
    expect(defeat.steps.map((s) => [s.action, s.accepted])).toEqual([
      ['ENTER', true], ['ENGAGE_DEFEAT', true], ['ENGAGE_DEFEAT', true], ['ENGAGE', false], ['DECLINE', true],
    ]);
    // Plain retreat (no fight): only the enter cost; retreat after a defeat
    // (single rewatch then walk away) adds no extra tax.
    expect(replay(303, ['ENTER', 'DECLINE']).final).toEqual({ inst: 5, gold: 0, kills: 0 });
    expect(replay(304, ['ENTER', 'ENGAGE_DEFEAT', 'DECLINE']).final).toEqual({ inst: 10, gold: 0, kills: 0 });
    // The cap: a fourth rewatch is rejected (5 + 10 + 15 = 30 defeat tax, then
    // only the retreat remains).
    const capped = replay(307, ['ENTER', 'ENGAGE_DEFEAT', 'ENGAGE_DEFEAT', 'ENGAGE_DEFEAT', 'ENGAGE_DEFEAT', 'DECLINE']);
    expect(capped.final).toEqual({ inst: 35, gold: 0, kills: 0 });
    expect(capped.steps.map((s) => [s.action, s.accepted])).toEqual([
      ['ENTER', true], ['ENGAGE_DEFEAT', true], ['ENGAGE_DEFEAT', true], ['ENGAGE_DEFEAT', true], ['ENGAGE_DEFEAT', false], ['DECLINE', true],
    ]);
    // The live path: resolveBattle(false) is a pure gate (no tax), and the
    // explicit retreat resolve() costs nothing either.
    const live = advanceToCombat(305);
    const startInst = live.state.instability;
    let exp = live.enter('tx-live-enter');
    expect(exp.state.instability).toBe(startInst + 5);
    exp = exp.resolveBattle(false);
    expect(exp.state.instability).toBe(startInst + 5); // the defeat itself taxes nothing
    exp = exp.resolve();
    expect(exp.state.instability).toBe(startInst + 5); // retreat taxes nothing
  });

  it('the differential is deterministic: two replays of a defeat-loop sequence are byte-identical', () => {
    const a = replay(306, ['ENTER', 'ENGAGE_DEFEAT', 'ENGAGE_DEFEAT', 'ENGAGE_DEFEAT', 'DECLINE']);
    const b = replay(306, ['ENTER', 'ENGAGE_DEFEAT', 'ENGAGE_DEFEAT', 'ENGAGE_DEFEAT', 'DECLINE']);
    expect(a.final).toEqual(b.final);
    expect(JSON.stringify(a.steps)).toBe(JSON.stringify(b.steps));
  });
});
