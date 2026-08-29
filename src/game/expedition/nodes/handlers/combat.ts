/**
 * Combat node family (battle / elite / boss): ENGAGE resolves the
 * deterministic reward snapshot (claim options + roll slots stored once),
 * CLAIM_REWARD grants the chosen reward exactly once. Battle grants gold plus
 * a 35% loot chance (GDD §23.3), elite higher gold plus a guaranteed
 * three-way choice, boss a three-way choice — all from the persisted seed,
 * never re-rolled.
 */
import { ExpeditionError } from '../../expedition-error.js';
import { applyOutcomeCommands } from '../../outcome-commands.js';
import { fnv1a32, nextU32 } from '../../stable.js';
import type { NodeHandler } from '../registry.js';
import type { NodeDefinition, NodeRunState, OutcomeCommand, RewardSnapshot } from '../types.js';
import { assertVisitOpen, enterCommands, hasCommittedAction, previewOf, requireRewardSnapshot } from './common.js';

const BATTLE_GOLD_MIN = 45;
const BATTLE_GOLD_SPAN = 26;
const ELITE_GOLD_MIN = 90;
const ELITE_GOLD_SPAN = 51;
const LOOT_CHANCE_PERMILLE = 350;
/** §9: instability a DEFEAT costs (a lost fight pays nothing and hurts). */
const DEFEAT_INSTABILITY_DELTA = 5;

function rewardSeed(state: NodeRunState, nodeId: string): number {
  return fnv1a32([state.runId, nodeId, state.contentRevision, 'reward']);
}

function buildRewardSnapshot(state: NodeRunState, definition: NodeDefinition, count: number): RewardSnapshot {
  const seed = rewardSeed(state, definition.nodeId);
  const ids: string[] = [];
  let cursor = seed;
  for (let index = 0; index < count; index += 1) {
    cursor = nextU32(cursor);
    ids.push(`reward:${definition.nodeId}:${String(index)}`);
  }
  return {
    kind: 'REWARD',
    snapshotId: `${state.runId}:${definition.nodeId}`,
    nodeId: definition.nodeId,
    seed,
    rewardIds: ids,
    rollSlots: { loot: nextU32(cursor) % 10000, gold: nextU32(nextU32(cursor)) % 10000 },
  };
}

function materializeReward(state: NodeRunState, definition: NodeDefinition, count: number): RewardSnapshot {
  const existing = state.snapshots[definition.nodeId];
  if (existing !== undefined) {
    if (existing.kind !== 'REWARD') {
      throw new ExpeditionError('SNAPSHOT_MISMATCH', { nodeId: definition.nodeId, kind: existing.kind });
    }
    return existing;
  }
  return buildRewardSnapshot(state, definition, count);
}

function attachReward(state: NodeRunState, snapshot: RewardSnapshot): NodeRunState {
  if (state.snapshots[snapshot.nodeId] !== undefined) return state;
  return { ...state, revision: state.revision + 1, snapshots: { ...state.snapshots, [snapshot.nodeId]: snapshot } };
}

function goldAmount(snapshot: RewardSnapshot, min: number, span: number): number {
  return min + ((snapshot.rollSlots['gold'] ?? 0) % span);
}

function makeCombatHandler(
  type: 'battle' | 'elite' | 'boss',
  rewardCount: number,
  goldMin: number,
  goldSpan: number,
  rewardCategoryKey: string,
  hasLootChance: boolean,
): NodeHandler {
  const actions = ['ENTER', 'ENGAGE', 'ENGAGE_DEFEAT', 'CLAIM_REWARD', 'DECLINE'];
  return {
    type,
    allowedActions: actions,
    requiredData: [],
    commitPhase: 'ATOMIC',
    prepare(definition, state) {
      const snapshot = materializeReward(state, definition, rewardCount);
      return { state: attachReward(state, snapshot), preview: previewOf(definition, actions, rewardCategoryKey, []) };
    },
    validate(definition, request, state) {
      assertVisitOpen(state, definition.nodeId);
      if (hasCommittedAction(state, definition.nodeId, ['DECLINE'])) return 'ACTION_LIMIT';
      if (request.action === 'ENGAGE') {
        // §9 victory: exactly one, and only before any verdict is recorded — a
        // defeat cannot be turned into a win (the deterministic sim already
        // ruled it).
        if (hasCommittedAction(state, definition.nodeId, ['ENGAGE', 'ENGAGE_DEFEAT', 'CLAIM_REWARD'])) return 'ACTION_LIMIT';
        return null;
      }
      if (request.action === 'ENGAGE_DEFEAT') {
        // §9 defeat: no rewards; RE-ENGAGE is a deterministic rewatch of the
        // same lost sim (repeatable) — never a win.
        if (hasCommittedAction(state, definition.nodeId, ['ENGAGE', 'CLAIM_REWARD'])) return 'ACTION_LIMIT';
        return null;
      }
      if (request.action === 'CLAIM_REWARD') {
        if (request.optionId === undefined) {
          throw new ExpeditionError('UNKNOWN_ACTION', { nodeId: definition.nodeId, action: request.action, reason: 'optionId missing' });
        }
        const snapshot = requireRewardSnapshot(state, definition.nodeId);
        if (!snapshot.rewardIds.includes(request.optionId)) {
          throw new ExpeditionError('UNKNOWN_OFFER', { nodeId: definition.nodeId, offerId: request.optionId });
        }
        if (hasCommittedAction(state, definition.nodeId, ['CLAIM_REWARD'])) return 'ACTION_LIMIT';
        if (!hasCommittedAction(state, definition.nodeId, ['ENGAGE'])) return 'PREREQUISITE_MISSING';
        return null;
      }
      // §9 retreat: allowed after a DEFEAT (ENGAGE_DEFEAT) — a lost fight is
      // cleared by retreating; only a VICTORY (ENGAGE) or a claim locks DECLINE.
      if (request.action === 'DECLINE' && hasCommittedAction(state, definition.nodeId, ['ENGAGE', 'CLAIM_REWARD'])) return 'ACTION_LIMIT';
      if (request.action === 'ENTER' || request.action === 'DECLINE') {
        return null;
      }
      throw new ExpeditionError('UNKNOWN_ACTION', { nodeId: definition.nodeId, action: request.action });
    },
    commit(definition, request, state) {
      if (request.action === 'ENTER') {
        return applyOutcomeCommands(state, enterCommands(definition, state));
      }
      const snapshot = materializeReward(state, definition, rewardCount);
      if (request.action === 'ENGAGE') {
        const commands: OutcomeCommand[] = [];
        if (goldMin > 0) {
          const amount = goldAmount(snapshot, goldMin, goldSpan);
          commands.push({ kind: 'GOLD_DELTA', amount });
          commands.push({ kind: 'GOLD_EARNED', amount });
        }
        if (hasLootChance && (snapshot.rollSlots['loot'] ?? 0) < LOOT_CHANCE_PERMILLE) {
          commands.push({ kind: 'GRANT_UNSECURED_LOOT', rewardId: `reward:${definition.nodeId}:loot` });
        }
        // Kills awarded: deterministic from roll slots
        const killsBase = rewardCount === 2 ? 3 : 5;
        const killsExtra = (snapshot.rollSlots['gold'] ?? 0) % (rewardCount === 2 ? 4 : 8);
        commands.push({ kind: 'KILLS_EARNED', amount: killsBase + killsExtra });
        return applyOutcomeCommands(state, commands);
      }
      if (request.action === 'ENGAGE_DEFEAT') {
        // §9 defeat: the live verdict pays NOTHING (no gold, loot or kills) and
        // levies the instability penalty; the reward snapshot is untouched so a
        // re-fought defeat (deterministic rewatch) behaves identically.
        return applyOutcomeCommands(state, [{ kind: 'INSTABILITY_DELTA', amount: DEFEAT_INSTABILITY_DELTA }]);
      }
      if (request.action === 'CLAIM_REWARD') {
        if (request.optionId === undefined) {
          throw new ExpeditionError('UNKNOWN_ACTION', { nodeId: definition.nodeId, action: request.action });
        }
        return applyOutcomeCommands(state, [{ kind: 'GRANT_UNSECURED_LOOT', rewardId: request.optionId }]);
      }
      return { state, outcomeIds: [] };
    },
  };
}

/** Battle: gold plus a 35% loot chance and a two-way claim (GDD §23.3). */
export const battleHandler = makeCombatHandler('battle', 2, BATTLE_GOLD_MIN, BATTLE_GOLD_SPAN, 'reward.category.battle', true);

/** Elite: higher gold and a guaranteed three-way claim (GDD §23.3). */
export const eliteHandler = makeCombatHandler('elite', 3, ELITE_GOLD_MIN, ELITE_GOLD_SPAN, 'reward.category.elite', false);

/** Boss: a three-way claim (GDD §23.3). */
export const bossHandler = makeCombatHandler('boss', 3, 0, 0, 'reward.category.boss', false);
