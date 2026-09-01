import { KernelInvariantError } from '../core/invariant-error.js';
import { asciiCompare } from '../core/primitives.js';
import { stagePriority } from '../core/pipeline-stage.js';
import type { KernelCommand } from '../core/command-types.js';
import { compareEffectCommands, validateEffectCommand, type EffectCommand } from './effect-command.js';

/**
 * Phase 19 T03 effect executor (§7). Validates a batch, canonicalizes order,
 * assigns stable sequences, and either maps a command onto an existing kernel
 * command (pure plumbing) or defers it with a closed reason. It never performs
 * damage/heal/shield/status/movement/spawn logic and never mutates state.
 */

export type DeferredEffectReason =
  /** Phase 20 owns the full summon/construct lifecycle (§6.1). */
  | 'summon_lifecycle_phase20'
  /** Consumed by the Phase-19 ability system (charge/removal state). */
  | 'ability_system_internal'
  /** No authorized kernel port exists yet. */
  | 'no_authorized_port';

export type EffectEnqueueOutcome =
  | { readonly status: 'mapped'; readonly command: KernelCommand }
  | { readonly status: 'deferred'; readonly reason: DeferredEffectReason; readonly command: EffectCommand };

function targetOrderKey(command: EffectCommand): string {
  return command.targetRef.entityId ?? command.targetRef.groundKey ?? command.targetRef.slotId ?? '';
}

/** §7 ordering key excluding `sequence`, used to assign deterministic sequences. */
function effectOrderKey(a: EffectCommand, b: EffectCommand): number {
  return (
    a.scheduledTick - b.scheduledTick ||
    stagePriority(a.stage) - stagePriority(b.stage) ||
    asciiCompare(a.abilityInstanceId, b.abilityInstanceId) ||
    a.effectIndex - b.effectIndex ||
    asciiCompare(targetOrderKey(a), targetOrderKey(b))
  );
}

/**
 * Validates a batch (§7, §13.1): structural checks plus duplicate `commandId`
 * and duplicate `(abilityInstanceId, effectIndex)` as hard errors.
 */
export function validateEffectBatch(commands: readonly EffectCommand[]): void {
  const seenCommandIds = new Set<string>();
  const seenEffectKeys = new Set<string>();
  for (const command of commands) {
    validateEffectCommand(command);
    if (seenCommandIds.has(command.commandId)) {
      throw new KernelInvariantError('P19_EFFECT_DUPLICATE', { reason: 'commandId', commandId: command.commandId });
    }
    const effectKey = `${command.abilityInstanceId}\u0000${String(command.effectIndex)}`;
    if (seenEffectKeys.has(effectKey)) {
      throw new KernelInvariantError('P19_EFFECT_DUPLICATE', { reason: 'effectIndex', abilityInstanceId: command.abilityInstanceId, effectIndex: command.effectIndex });
    }
    seenCommandIds.add(command.commandId);
    seenEffectKeys.add(effectKey);
  }
}

/**
 * Canonicalizes a batch: validates, sorts by the §7 ordering (excluding
 * `sequence`), then assigns stable `sequence` values by position. Identical
 * input multisets yield identical output in every runtime.
 */
export function canonicalizeEffectBatch(commands: readonly EffectCommand[]): readonly EffectCommand[] {
  validateEffectBatch(commands);
  const sorted = [...commands].sort(effectOrderKey);
  return Object.freeze(sorted.map((command, index) => Object.freeze({ ...command, sequence: index })));
}

/** Re-export the full §7 comparator (includes `sequence`). */
export function orderEffectCommands(commands: readonly EffectCommand[]): readonly EffectCommand[] {
  return Object.freeze([...commands].sort(compareEffectCommands));
}

/** Closed dispatch: maps a command onto an existing kernel command (no own logic). */
export function mapToKernelCommand(command: EffectCommand): KernelCommand | null {
  const entityId = command.targetRef.entityId;
  switch (command.kind) {
    case 'damage':
      if (entityId === null) return null;
      return Object.freeze({ kind: 'apply_lp_delta', entityId, delta: -command.amount, sourceId: command.sourceId });
    case 'heal':
      if (entityId === null) return null;
      return Object.freeze({ kind: 'apply_lp_delta', entityId, delta: command.amount, sourceId: command.sourceId });
    case 'shield':
      if (entityId === null) return null;
      return Object.freeze({ kind: 'set_shields', entityId, shields: command.shields });
    case 'apply_status':
    case 'mark':
      return Object.freeze({ kind: 'set_statuses', statuses: command.statuses });
    case 'cleanse':
    case 'dispel':
      if (entityId === null) return null;
      return Object.freeze({ kind: 'queue_cleanse_dispel', targetId: entityId, request: command.kind });
    case 'move':
      if (entityId === null) return null;
      return Object.freeze({ kind: 'set_position', entityId, lane: command.lane, x100: command.x100 });
    case 'lane_change':
      if (entityId === null) return null;
      return Object.freeze({ kind: 'set_lane_change', entityId, state: command.laneChange });
    case 'remove_status':
    case 'spawn_request':
    case 'modify_charge':
    case 'taunt':
    case 'modify_objective':
    case 'modify_world':
      return null;
  }
}

/** Closed deferral classification for kinds without an existing kernel port. */
export function deferredReasonOf(command: EffectCommand): DeferredEffectReason | null {
  switch (command.kind) {
    case 'spawn_request':
      return 'summon_lifecycle_phase20';
    case 'remove_status':
    case 'modify_charge':
      return 'ability_system_internal';
    case 'taunt':
    case 'modify_objective':
    case 'modify_world':
      return 'no_authorized_port';
    case 'damage':
    case 'heal':
    case 'shield':
    case 'apply_status':
    case 'mark':
    case 'cleanse':
    case 'dispel':
    case 'move':
    case 'lane_change':
      return null;
  }
}

/** Validate + map-or-defer a single command. */
export function enqueueEffect(command: EffectCommand): EffectEnqueueOutcome {
  validateEffectCommand(command);
  const mapped = mapToKernelCommand(command);
  if (mapped !== null) return Object.freeze({ status: 'mapped', command: mapped });
  const reason = deferredReasonOf(command);
  if (reason !== null) return Object.freeze({ status: 'deferred', reason, command });
  throw new KernelInvariantError('P19_EFFECT_UNMAPPED', { kind: command.kind });
}
