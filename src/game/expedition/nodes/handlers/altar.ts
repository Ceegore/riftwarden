/**
 * Rift altar handler (S47, CHOICE_NODE_CONTRACT): a strong benefit against a
 * clear downside, shown in parallel and always declinable. ACCEPT is the
 * explicit confirmation and applies benefit + downside in one committed
 * command batch; DECLINE ends the node for free. Full relic capacity and
 * duplicate relics are rejected with visible reasons.
 */
import { ExpeditionError, type NodeRejectionCode } from '../../expedition-error.js';
import { applyOutcomeCommands } from '../../outcome-commands.js';
import { relicGrantVerdict } from '../../run-economy.js';
import type { NodeHandler } from '../registry.js';
import type { NodeDefinition, NodePreviewData } from '../types.js';
import { assertVisitOpen, enterCommands, hasCommittedAction, previewOf } from './common.js';

export const ALTAR_DOWNSIDE_INSTABILITY = 10;

function nodePreview(definition: NodeDefinition, actions: readonly string[], consequences: readonly string[]): NodePreviewData {
  return previewOf(definition, actions, 'reward.category.choice', consequences);
}

export const altarHandler: NodeHandler = {
  type: 'altar',
  allowedActions: ['ENTER', 'ACCEPT', 'DECLINE'],
  requiredData: ['payloadKey'],
  commitPhase: 'ATOMIC',
  prepare(definition, state) {
    return {
      state,
      preview: nodePreview(definition, ['ENTER', 'ACCEPT', 'DECLINE'], ['altar.benefit', 'altar.downside.instability', 'altar.always.declinable']),
    };
  },
  validate(definition, request, state): NodeRejectionCode | null {
    assertVisitOpen(state, definition.nodeId);
    if (hasCommittedAction(state, definition.nodeId, ['ACCEPT', 'DECLINE'])) return 'ACTION_LIMIT';
    if (request.action === 'ENTER' || request.action === 'DECLINE') return null;
    if (request.action !== 'ACCEPT') {
      throw new ExpeditionError('UNKNOWN_ACTION', { nodeId: definition.nodeId, action: request.action });
    }
    if (relicGrantVerdict(state, definition.payloadKey, state.modeId) === 'RELIC_CAP') return 'RELIC_CAP';
    if (relicGrantVerdict(state, definition.payloadKey, state.modeId) === 'DUPLICATE') return 'REWARD_DUPLICATE';
    if (state.instability + ALTAR_DOWNSIDE_INSTABILITY > 100) return 'OPTION_UNAVAILABLE';
    return null;
  },
  commit(definition, request, state) {
    if (request.action === 'ENTER') return applyOutcomeCommands(state, enterCommands(definition));
    if (request.action === 'ACCEPT') {
      // Benefit and downside are applied in parallel: one visible confirmation.
      return applyOutcomeCommands(state, [
        { kind: 'GRANT_RELIC', relicId: definition.payloadKey },
        { kind: 'INSTABILITY_DELTA', amount: ALTAR_DOWNSIDE_INSTABILITY },
      ]);
    }
    return { state, outcomeIds: [] };
  },
};
