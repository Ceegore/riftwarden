/**
 * Anchor and story handlers: the anchor secures unsecured loot (GDD §23.3),
 * offers a guaranteed service (instability reduction), allows voluntary
 * retreat (GDD §23.4 settlement via run-economy) and formation reorder; the
 * story node only presents narrative and continues. Every action is
 * validated and committed exactly once — nothing is hidden and a retreat is
 * always explicit.
 */
import { ExpeditionError, type NodeRejectionCode } from '../../expedition-error.js';
import { applyOutcomeCommands } from '../../outcome-commands.js';
import { secureCommands } from '../../run-economy.js';
import { MERCHANT_SERVICE_PRICE_GOLD } from '../../offers/offer-service.js';
import type { NodeHandler } from '../registry.js';
import { assertVisitOpen, enterCommands, hasCommittedAction, previewOf } from './common.js';

export const ANCHOR_SERVICE_INSTABILITY_REDUCTION = 8;
export const ANCHOR_SERVICE_COST_GOLD = MERCHANT_SERVICE_PRICE_GOLD;

const anchorHandler: NodeHandler = {
  type: 'anchor',
  allowedActions: ['ENTER', 'SECURE', 'SERVICE', 'RETREAT', 'REORDER', 'DECLINE'],
  requiredData: [],
  commitPhase: 'ATOMIC',
  prepare(definition, state) {
    return {
      state,
      preview: previewOf(definition, ['ENTER', 'SECURE', 'SERVICE', 'RETREAT', 'REORDER', 'DECLINE'], 'reward.category.anchor', [
        'anchor.secure.loot',
        'anchor.retreat.keeps.secured',
        'anchor.service.instability',
      ]),
    };
  },
  validate(definition, request, state): NodeRejectionCode | null {
    assertVisitOpen(state, definition.nodeId);
    if (hasCommittedAction(state, definition.nodeId, ['RETREAT', 'DECLINE'])) return 'ACTION_LIMIT';
    if (request.action === 'ENTER' || request.action === 'SECURE' || request.action === 'RETREAT' || request.action === 'REORDER' || request.action === 'DECLINE') {
      return null;
    }
    if (request.action === 'SERVICE') {
      return state.gold < ANCHOR_SERVICE_COST_GOLD ? 'INSUFFICIENT_GOLD' : null;
    }
    throw new ExpeditionError('UNKNOWN_ACTION', { nodeId: definition.nodeId, action: request.action });
  },
  commit(definition, request, state) {
    if (request.action === 'ENTER') return applyOutcomeCommands(state, enterCommands(definition));
    if (request.action === 'SECURE') {
      const commands = secureCommands(state);
      return commands.length === 0 ? { state, outcomeIds: [] } : applyOutcomeCommands(state, commands);
    }
    if (request.action === 'SERVICE') {
      return applyOutcomeCommands(state, [
        { kind: 'GOLD_DELTA', amount: -ANCHOR_SERVICE_COST_GOLD },
        { kind: 'INSTABILITY_DELTA', amount: -ANCHOR_SERVICE_INSTABILITY_REDUCTION },
      ]);
    }
    // RETREAT/REORDER/DECLINE: validated; the settlement itself is computed
    // by the flow layer through run-economy after the node resolves.
    return { state, outcomeIds: [] };
  },
};

const storyHandler: NodeHandler = {
  type: 'story',
  allowedActions: ['ENTER', 'CONTINUE'],
  requiredData: ['payloadKey'],
  commitPhase: 'ATOMIC',
  prepare(definition, state) {
    return {
      state,
      preview: previewOf(definition, ['ENTER', 'CONTINUE'], 'reward.category.story', [`story.text.${definition.payloadKey}`]),
    };
  },
  validate(definition, request, state): NodeRejectionCode | null {
    assertVisitOpen(state, definition.nodeId);
    if (hasCommittedAction(state, definition.nodeId, ['CONTINUE'])) return 'ACTION_LIMIT';
    if (request.action === 'ENTER' || request.action === 'CONTINUE') return null;
    throw new ExpeditionError('UNKNOWN_ACTION', { nodeId: definition.nodeId, action: request.action });
  },
  commit(definition, request, state) {
    if (request.action === 'ENTER') return applyOutcomeCommands(state, enterCommands(definition));
    return { state, outcomeIds: [] };
  },
};

export const anchorStoryHandlers: readonly NodeHandler[] = [anchorHandler, storyHandler];
