/**
 * Treasure node handler (S45, CHOICE_NODE_CONTRACT): one visible loot
 * category with a visible protection condition. TAKE grants the shown loot
 * as unsecured (new permanent finds are unsecured until anchored, GDD
 * §23.3); DECLINE ends the node. Consequences are fully visible — no hidden
 * loss, no hidden cost.
 */
import { ExpeditionError, type NodeRejectionCode } from '../../expedition-error.js';
import { applyOutcomeCommands } from '../../outcome-commands.js';
import type { NodeHandler } from '../registry.js';
import type { NodeDefinition, NodePreviewData } from '../types.js';
import { assertVisitOpen, enterCommands, hasCommittedAction, previewOf } from './common.js';

export const TREASURE_REWARD_ID = 'treasure';

function nodePreview(definition: NodeDefinition, actions: readonly string[], consequences: readonly string[]): NodePreviewData {
  return previewOf(definition, actions, 'reward.category.choice', consequences);
}

export const treasureHandler: NodeHandler = {
  type: 'treasure',
  allowedActions: ['ENTER', 'TAKE', 'DECLINE'],
  requiredData: ['payloadKey'],
  commitPhase: 'ATOMIC',
  prepare(definition, state) {
    return {
      state,
      preview: nodePreview(definition, ['ENTER', 'TAKE', 'DECLINE'], ['treasure.condition.unsecured', 'treasure.secure.path.anchor']),
    };
  },
  validate(definition, request, state): NodeRejectionCode | null {
    assertVisitOpen(state, definition.nodeId);
    if (hasCommittedAction(state, definition.nodeId, ['TAKE', 'DECLINE'])) return 'ACTION_LIMIT';
    if (request.action === 'ENTER' || request.action === 'TAKE' || request.action === 'DECLINE') return null;
    throw new ExpeditionError('UNKNOWN_ACTION', { nodeId: definition.nodeId, action: request.action });
  },
  commit(definition, request, state) {
    if (request.action === 'ENTER') return applyOutcomeCommands(state, enterCommands(definition));
    if (request.action === 'TAKE') {
      return applyOutcomeCommands(state, [{ kind: 'GRANT_UNSECURED_LOOT', rewardId: `${TREASURE_REWARD_ID}:${definition.nodeId}` }]);
    }
    return { state, outcomeIds: [] };
  },
};
