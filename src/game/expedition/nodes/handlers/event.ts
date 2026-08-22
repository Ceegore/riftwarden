/**
 * Event node handler (S42, EVENT_SYSTEM_CONTRACT): the event content is
 * resolved by eventId; the snapshot (available options + roll slots) is
 * materialized and persisted at first open. CONFIRM commits the visible
 * costs plus the deterministic outcome; DECLINE ends the node explicitly.
 * Non-fulfillable options stay visible but greyed with a reason key.
 */
import { ExpeditionError, type NodeRejectionCode } from '../../expedition-error.js';
import { applyOutcomeCommands } from '../../outcome-commands.js';
import { attachEventSnapshot, buildEventCommands, materializeEvent, optionAvailability } from '../../events/event-service.js';
import { EVENT_DEFINITIONS } from '../../events/event-content.js';
import type { NodeHandler } from '../registry.js';
import type { NodeDefinition, EventOptionState, NodePreviewData } from '../types.js';
import { assertVisitOpen, enterCommands, hasCommittedAction, previewOf } from './common.js';

function eventFor(definition: NodeDefinition): (typeof EVENT_DEFINITIONS)[number] {
  const event = EVENT_DEFINITIONS.find((candidate) => candidate.eventId === definition.payloadKey);
  if (event === undefined) {
    throw new ExpeditionError('UNKNOWN_EVENT', { nodeId: definition.nodeId, eventId: definition.payloadKey });
  }
  return event;
}

function consequencesOf(availability: readonly EventOptionState[]): readonly string[] {
  return availability.map((option) => (option.available ? `${option.optionId}.consequence` : `${option.optionId}.blocked`));
}

export const eventHandler: NodeHandler = {
  type: 'event',
  allowedActions: ['ENTER', 'CONFIRM', 'DECLINE'],
  requiredData: ['payloadKey'],
  commitPhase: 'ATOMIC',
  prepare(definition, state) {
    const event = eventFor(definition);
    const snapshot = materializeEvent(state, event, definition.nodeId);
    const preview: NodePreviewData = {
      ...previewOf(definition, ['ENTER', 'CONFIRM', 'DECLINE'], 'reward.category.event', consequencesOf(snapshot.options)),
    };
    return { state: attachEventSnapshot(state, snapshot), preview };
  },
  validate(definition, request, state): NodeRejectionCode | null {
    assertVisitOpen(state, definition.nodeId);
    if (hasCommittedAction(state, definition.nodeId, ['CONFIRM', 'DECLINE'])) return 'ACTION_LIMIT';
    if (request.action === 'ENTER' || request.action === 'DECLINE') return null;
    if (request.action !== 'CONFIRM') {
      throw new ExpeditionError('UNKNOWN_ACTION', { nodeId: definition.nodeId, action: request.action });
    }
    if (request.optionId === undefined) {
      throw new ExpeditionError('UNKNOWN_ACTION', { nodeId: definition.nodeId, action: request.action, reason: 'optionId missing' });
    }
    const event = eventFor(definition);
    if (!event.options.some((option) => option.optionId === request.optionId)) {
      throw new ExpeditionError('UNKNOWN_ACTION', { eventId: event.eventId, optionId: request.optionId });
    }
    const availability = optionAvailability(state, event);
    const option = availability.find((candidate) => candidate.optionId === request.optionId);
    if (option !== undefined && !option.available) return 'OPTION_UNAVAILABLE';
    return null;
  },
  commit(definition, request, state) {
    if (request.action === 'ENTER') {
      return applyOutcomeCommands(state, enterCommands(definition));
    }
    if (request.action === 'DECLINE') {
      return { state, outcomeIds: [] };
    }
    if (request.optionId === undefined) {
      throw new ExpeditionError('UNKNOWN_ACTION', { nodeId: definition.nodeId, action: request.action });
    }
    const event = eventFor(definition);
    return applyOutcomeCommands(state, buildEventCommands(state, event, definition.nodeId, request.optionId));
  },
};
