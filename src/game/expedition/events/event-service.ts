/**
 * Event service (EVENT_SYSTEM_CONTRACT, GDD §20.1): an event snapshot is
 * materialized exactly once at first open from runId + nodeId + seed; all
 * roll slots are resolved then and stored, so reload/resume never re-rolls.
 * Preconditions filter here (never in the UI); non-fulfillable options stay
 * visible but greyed with a reason key; every option shows its full cost and
 * consequence list before confirmation. Confirm produces a stable
 * transaction id; navigation only happens after a durable commit.
 */
import { ExpeditionError } from '../expedition-error.js';
import { fnv1a32, nextU32 } from '../stable.js';
import type { NodeRunState, EventOptionState, EventSnapshot, OutcomeCommand } from '../nodes/types.js';
import type { EventDefinition } from './event-types.js';

export const RISK_SUCCESS_PERMILLE = 5000;
export const RISK_FAILURE_INSTABILITY = 5;

function snapshotSeed(state: NodeRunState, nodeId: string): number {
  return fnv1a32([state.runId, nodeId, state.contentRevision]);
}

function collectRollSlots(event: EventDefinition, seed: number): Readonly<Record<string, number>> {
  const slots: Record<string, number> = {};
  let cursor = seed;
  for (const option of event.options) {
    for (const slot of option.rollSlots) {
      if (slots[slot] === undefined) {
        cursor = nextU32(cursor);
        slots[slot] = cursor % 10000;
      }
    }
  }
  return slots;
}

/** Availability per option: prerequisites and visible costs, never hidden. */
export function optionAvailability(state: NodeRunState, event: EventDefinition): readonly EventOptionState[] {
  return event.options.map((option) => {
    const prerequisite = event.prerequisites.find((id) => !state.knowledge.includes(id) && !state.relics.includes(id) && !state.recruits.includes(id));
    if (prerequisite !== undefined) {
      return { optionId: option.optionId, available: false, blockedReasonKey: 'event.requirement.prerequisite' };
    }
    const goldCost = option.cost.gold ?? 0;
    if (state.gold < goldCost) {
      return { optionId: option.optionId, available: false, blockedReasonKey: 'event.requirement.gold' };
    }
    const instabilityCost = option.cost.instability ?? 0;
    if (state.instability + instabilityCost > 100) {
      return { optionId: option.optionId, available: false, blockedReasonKey: 'event.requirement.instability' };
    }
    return { optionId: option.optionId, available: true };
  });
}

/** Materializes the event snapshot exactly once per node visit. */
export function materializeEvent(state: NodeRunState, event: EventDefinition, nodeId: string): EventSnapshot {
  const existing = state.snapshots[nodeId];
  if (existing !== undefined) {
    if (existing.kind !== 'EVENT' || existing.eventId !== event.eventId) {
      throw new ExpeditionError('SNAPSHOT_MISMATCH', { nodeId, kind: existing.kind });
    }
    return existing;
  }
  const seed = snapshotSeed(state, nodeId);
  const snapshot: EventSnapshot = {
    kind: 'EVENT',
    snapshotId: `${state.runId}:${nodeId}`,
    nodeId,
    seed,
    eventId: event.eventId,
    options: optionAvailability(state, event),
    rollSlots: collectRollSlots(event, seed),
  };
  return snapshot;
}

/** Attaches the materialized event snapshot (idempotent for stored nodes). */
export function attachEventSnapshot(state: NodeRunState, snapshot: EventSnapshot): NodeRunState {
  if (state.snapshots[snapshot.nodeId] !== undefined) return state;
  return { ...state, revision: state.revision + 1, snapshots: { ...state.snapshots, [snapshot.nodeId]: snapshot } };
}

/**
 * The deterministic effect commands for one confirmed option: the visible
 * cost plus the outcome from the already-resolved roll slots. Rolls are
 * resolved at open, so the preview after open shows the exact consequences —
 * nothing is rolled at confirm time.
 */
export function buildEventCommands(state: NodeRunState, event: EventDefinition, nodeId: string, optionId: string): readonly OutcomeCommand[] {
  const option = event.options.find((candidate) => candidate.optionId === optionId);
  if (option === undefined) {
    throw new ExpeditionError('UNKNOWN_ACTION', { eventId: event.eventId, optionId });
  }
  const snapshot = state.snapshots[nodeId];
  if (snapshot?.kind !== 'EVENT') {
    throw new ExpeditionError('SNAPSHOT_MISMATCH', { nodeId, reason: 'event snapshot missing' });
  }
  const commands: OutcomeCommand[] = [];
  const goldCost = option.cost.gold ?? 0;
  if (goldCost > 0) commands.push({ kind: 'GOLD_DELTA', amount: -goldCost });
  const instabilityCost = option.cost.instability ?? 0;
  if (instabilityCost > 0) commands.push({ kind: 'INSTABILITY_DELTA', amount: instabilityCost });
  if (option.preview.includes('VISIBLE_RISK')) {
    const slot = option.rollSlots[0];
    if (slot === undefined) {
      throw new ExpeditionError('CONTENT_BUILD_ERROR', { eventId: event.eventId, optionId, reason: 'risk option without roll slot' });
    }
    const roll = snapshotRoll(state, nodeId, slot);
    if (roll < RISK_SUCCESS_PERMILLE) {
      commands.push({ kind: 'GRANT_UNSECURED_LOOT', rewardId: `${event.eventId}:${optionId}:reward` });
    } else {
      commands.push({ kind: 'INSTABILITY_DELTA', amount: RISK_FAILURE_INSTABILITY });
    }
    return commands;
  }
  if (option.preview.includes('VISIBLE_SAFE_OUTCOME')) {
    commands.push({ kind: 'GRANT_UNSECURED_LOOT', rewardId: `${event.eventId}:${optionId}:safe` });
    return commands;
  }
  if (option.preview.includes('VISIBLE_TRADEOFF')) {
    commands.push({ kind: 'GRANT_UNSECURED_LOOT', rewardId: `${event.eventId}:${optionId}:tradeoff` });
    return commands;
  }
  throw new ExpeditionError('CONTENT_BUILD_ERROR', { eventId: event.eventId, optionId, reason: 'no preview kind' });
}

/** Resolves one stored roll slot for preview/outcome (never re-rolled). */
export function snapshotRoll(state: NodeRunState, nodeId: string, slot: string): number {
  const snapshot = state.snapshots[nodeId];
  if (snapshot?.kind !== 'EVENT') {
    throw new ExpeditionError('SNAPSHOT_MISMATCH', { nodeId, reason: 'event snapshot missing' });
  }
  const value = snapshot.rollSlots[slot];
  if (value === undefined) {
    throw new ExpeditionError('CONTENT_BUILD_ERROR', { nodeId, slot, reason: 'roll slot missing' });
  }
  return value;
}
