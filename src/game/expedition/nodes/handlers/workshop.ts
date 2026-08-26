/**
 * Dungeon workshop handler (S46, CHOICE_NODE_CONTRACT): exactly one action
 * per visit unless an explicitly typed reward extends this. POLISH and
 * REPAIR charge their visible costs and emit typed profile commands; the
 * profile application itself runs through the Phase 31 transaction
 * framework. A second workshop action is rejected with a visible reason.
 */
import { ExpeditionError, type NodeRejectionCode } from '../../expedition-error.js';
import { applyOutcomeCommands } from '../../outcome-commands.js';
import type { NodeHandler } from '../registry.js';
import type { NodeDefinition, NodePreviewData, OutcomeCommand } from '../types.js';
import { assertVisitOpen, enterCommands, hasCommittedAction, previewOf } from './common.js';

export const POLISH_COST_GOLD = 220;
export const REPAIR_COST_GOLD = 150;

function nodePreview(definition: NodeDefinition, actions: readonly string[], consequences: readonly string[]): NodePreviewData {
  return previewOf(definition, actions, 'reward.category.choice', consequences);
}

export const workshopHandler: NodeHandler = {
  type: 'workshop',
  allowedActions: ['ENTER', 'POLISH', 'REPAIR', 'DECLINE'],
  requiredData: ['payloadKey'],
  commitPhase: 'ATOMIC',
  prepare(definition, state) {
    return {
      state,
      preview: nodePreview(definition, ['ENTER', 'POLISH', 'REPAIR', 'DECLINE'], ['workshop.max.one.action', `workshop.item.${definition.payloadKey}`]),
    };
  },
  validate(definition, request, state): NodeRejectionCode | null {
    assertVisitOpen(state, definition.nodeId);
    if (request.action === 'ENTER' || request.action === 'DECLINE') return null;
    if (request.action === 'POLISH' || request.action === 'REPAIR') {
      if (hasCommittedAction(state, definition.nodeId, ['POLISH', 'REPAIR'])) return 'ACTION_LIMIT';
      const cost = request.action === 'POLISH' ? POLISH_COST_GOLD : REPAIR_COST_GOLD;
      return state.gold < cost ? 'INSUFFICIENT_GOLD' : null;
    }
    throw new ExpeditionError('UNKNOWN_ACTION', { nodeId: definition.nodeId, action: request.action });
  },
  commit(definition, request, state) {
    if (request.action === 'ENTER') return applyOutcomeCommands(state, enterCommands(definition, state));
    if (request.action === 'DECLINE') return { state, outcomeIds: [] };
    const cost = request.action === 'POLISH' ? POLISH_COST_GOLD : REPAIR_COST_GOLD;
    const effect: OutcomeCommand = request.action === 'POLISH'
      ? { kind: 'POLISH_ITEM', itemId: definition.payloadKey }
      : { kind: 'REPAIR_ITEM', itemId: definition.payloadKey };
    return applyOutcomeCommands(state, [{ kind: 'GOLD_DELTA', amount: -cost }, effect]);
  },
};
