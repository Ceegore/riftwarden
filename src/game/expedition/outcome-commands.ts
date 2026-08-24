/**
 * Outcome command application (handbook §5/§15): every effect is a typed
 * command; the batch is validated fully before anything is applied, so a
 * malformed or unknown command rejects the whole batch — never a partial
 * application. Wallets and loot never go negative; reward ids are granted
 * exactly once (duplicates are replayed, not doubled).
 */
import { ExpeditionError, type NodeRejectionCode } from './expedition-error.js';
import type { CommandBatchResult, NodeRunState, OutcomeCommand } from './nodes/types.js';

function assertId(kind: OutcomeCommand['kind'], value: string): void {
  if (value === '') {
    throw new ExpeditionError('UNKNOWN_OUTCOME_COMMAND', { kind, reason: 'empty id' });
  }
}

function assertBatchValid(state: NodeRunState, commands: readonly OutcomeCommand[]): void {
  for (const command of commands) {
    switch (command.kind) {
      case 'GOLD_DELTA':
      case 'INSTABILITY_DELTA':
      case 'GOLD_EARNED':
        if (!Number.isSafeInteger(command.amount)) {
          throw new ExpeditionError('UNKNOWN_OUTCOME_COMMAND', { kind: command.kind, reason: 'non-integer delta' });
        }
        break;
      case 'GRANT_SECURED_LOOT':
        assertId('GRANT_SECURED_LOOT', command.rewardId);
        break;
      case 'GRANT_UNSECURED_LOOT':
        assertId('GRANT_UNSECURED_LOOT', command.rewardId);
        break;
      case 'REMOVE_UNSECURED_LOOT':
        assertId('REMOVE_UNSECURED_LOOT', command.rewardId);
        break;
      case 'GRANT_RELIC':
        assertId('GRANT_RELIC', command.relicId);
        break;
      case 'GRANT_KNOWLEDGE':
        assertId('GRANT_KNOWLEDGE', command.knowledgeId);
        break;
      case 'RECRUIT_TROOP':
        assertId('RECRUIT_TROOP', command.troopTypeId);
        break;
      case 'KILLS_EARNED':
        if (!Number.isSafeInteger(command.amount) || command.amount <= 0) {
          throw new ExpeditionError('UNKNOWN_OUTCOME_COMMAND', { kind: command.kind, reason: 'non-positive kills' });
        }
        break;
      case 'POLISH_ITEM':
        assertId('POLISH_ITEM', command.itemId);
        break;
      case 'REPAIR_ITEM':
        assertId('REPAIR_ITEM', command.itemId);
        break;
      default:
        throw new ExpeditionError('UNKNOWN_OUTCOME_COMMAND', { kind: (command as { kind: string }).kind });
    }
  }
  let gold = state.gold;
  let instability = state.instability;
  for (const command of commands) {
    if (command.kind === 'GOLD_DELTA') gold += command.amount;
    if (command.kind === 'INSTABILITY_DELTA') instability += command.amount;
    if (gold < 0 || instability < 0) {
      throw new ExpeditionError('NEGATIVE_RESOURCE', { kind: gold < 0 ? 'gold' : 'instability', gold, instability });
    }
  }
}

/**
 * Applies a command batch atomically. Duplicate reward grants are replayed
 * (counted, never doubled); missing unsecured loot for REMOVE is a hard
 * violation (the batch rejects before any mutation). Profile-scoped effects
 * (polish/repair) are validated and recorded as outcome ids — the profile
 * application itself runs through the Phase 31 transaction framework.
 */
export function applyOutcomeCommands(state: NodeRunState, commands: readonly OutcomeCommand[]): CommandBatchResult {
  assertBatchValid(state, commands);
  let next = state;
  const outcomeIds: string[] = [];
  const replayed: string[] = [];
  for (let index = 0; index < commands.length; index += 1) {
    const command = commands[index];
    if (command === undefined) continue;
    const outcomeId = `outcome:${String(next.revision)}:${String(index)}:${command.kind}`;
    switch (command.kind) {
      case 'GOLD_DELTA':
        next = { ...next, revision: next.revision + 1, gold: next.gold + command.amount };
        outcomeIds.push(outcomeId);
        break;
      case 'INSTABILITY_DELTA':
        next = { ...next, revision: next.revision + 1, instability: next.instability + command.amount };
        outcomeIds.push(outcomeId);
        break;
      case 'GRANT_SECURED_LOOT':
        if (next.securedLoot.includes(command.rewardId) || next.unsecuredLoot.includes(command.rewardId)) {
          replayed.push(command.rewardId);
        } else {
          next = { ...next, revision: next.revision + 1, securedLoot: [...next.securedLoot, command.rewardId] };
        }
        outcomeIds.push(outcomeId);
        break;
      case 'GRANT_UNSECURED_LOOT':
        if (next.unsecuredLoot.includes(command.rewardId) || next.securedLoot.includes(command.rewardId)) {
          replayed.push(command.rewardId);
        } else {
          next = { ...next, revision: next.revision + 1, unsecuredLoot: [...next.unsecuredLoot, command.rewardId] };
        }
        outcomeIds.push(outcomeId);
        break;
      case 'REMOVE_UNSECURED_LOOT':
        if (!next.unsecuredLoot.includes(command.rewardId)) {
          throw new ExpeditionError('LOOT_NOT_AVAILABLE', { rewardId: command.rewardId });
        }
        next = {
          ...next,
          revision: next.revision + 1,
          unsecuredLoot: next.unsecuredLoot.filter((id) => id !== command.rewardId),
        };
        outcomeIds.push(outcomeId);
        break;
      case 'GRANT_RELIC':
        if (next.relics.includes(command.relicId)) {
          replayed.push(command.relicId);
        } else {
          next = { ...next, revision: next.revision + 1, relics: [...next.relics, command.relicId] };
        }
        outcomeIds.push(outcomeId);
        break;
      case 'GRANT_KNOWLEDGE':
        if (!next.knowledge.includes(command.knowledgeId)) {
          next = { ...next, revision: next.revision + 1, knowledge: [...next.knowledge, command.knowledgeId] };
        }
        outcomeIds.push(outcomeId);
        break;
      case 'RECRUIT_TROOP':
        next = { ...next, revision: next.revision + 1, recruits: [...next.recruits, command.troopTypeId] };
        outcomeIds.push(outcomeId);
        break;
      case 'POLISH_ITEM':
      case 'REPAIR_ITEM':
        // Recorded as a typed effect for the operator-side profile wiring.
        outcomeIds.push(outcomeId);
        break;
      case 'GOLD_EARNED':
        next = { ...next, revision: next.revision + 1, goldEarned: next.goldEarned + command.amount };
        outcomeIds.push(outcomeId);
        break;
      case 'KILLS_EARNED':
        next = { ...next, revision: next.revision + 1, killsEarned: next.killsEarned + command.amount };
        outcomeIds.push(outcomeId);
        break;
      default:
        throw new ExpeditionError('UNKNOWN_OUTCOME_COMMAND', { kind: (command as { kind: string }).kind });
    }
  }
  return { state: next, outcomeIds, replayedCount: replayed.length };
}

/**
 * Rule-level rejection helper for handlers: maps a guard failure to a
 * REJECTED ledger reason. Structural misuse still throws ExpeditionError.
 */
export function rejectionOf(reason: NodeRejectionCode, detail?: string): string {
  return detail === undefined ? reason : `${reason}:${detail}`;
}
