/**
 * Scout post handler (S48, CHOICE_NODE_CONTRACT): an information choice —
 * REVEAL_PATH reveals the next levels, REVEAL_REWARD reveals boss/reward
 * information; both are stored as run knowledge, exactly once. DECLINE ends
 * the node without information and without cost. Nothing is hidden.
 */
import { ExpeditionError, type NodeRejectionCode } from '../../expedition-error.js';
import { applyOutcomeCommands } from '../../outcome-commands.js';
import type { NodeHandler } from '../registry.js';
import type { NodeDefinition, NodePreviewData } from '../types.js';
import { assertVisitOpen, enterCommands, hasCommittedAction, previewOf } from './common.js';

function nodePreview(definition: NodeDefinition, actions: readonly string[], consequences: readonly string[]): NodePreviewData {
  return previewOf(definition, actions, 'reward.category.choice', consequences);
}

export const scoutHandler: NodeHandler = {
  type: 'scout',
  allowedActions: ['ENTER', 'REVEAL_PATH', 'REVEAL_REWARD', 'DECLINE'],
  requiredData: [],
  commitPhase: 'ATOMIC',
  prepare(definition, state) {
    return {
      state,
      preview: nodePreview(definition, ['ENTER', 'REVEAL_PATH', 'REVEAL_REWARD', 'DECLINE'], ['scout.reveals.next.levels', 'scout.reveals.boss.info']),
    };
  },
  validate(definition, request, state): NodeRejectionCode | null {
    assertVisitOpen(state, definition.nodeId);
    if (hasCommittedAction(state, definition.nodeId, ['REVEAL_PATH', 'REVEAL_REWARD', 'DECLINE'])) return 'ACTION_LIMIT';
    if (request.action === 'ENTER' || request.action === 'REVEAL_PATH' || request.action === 'REVEAL_REWARD' || request.action === 'DECLINE') return null;
    throw new ExpeditionError('UNKNOWN_ACTION', { nodeId: definition.nodeId, action: request.action });
  },
  commit(definition, request, state) {
    if (request.action === 'ENTER') return applyOutcomeCommands(state, enterCommands(definition));
    if (request.action === 'REVEAL_PATH') {
      return applyOutcomeCommands(state, [{ kind: 'GRANT_KNOWLEDGE', knowledgeId: `scout.path:${definition.nodeId}` }]);
    }
    if (request.action === 'REVEAL_REWARD') {
      return applyOutcomeCommands(state, [{ kind: 'GRANT_KNOWLEDGE', knowledgeId: `scout.reward:${definition.nodeId}` }]);
    }
    return { state, outcomeIds: [] };
  },
};
