import { KernelInvariantError } from '../core/invariant-error.js';
import { asciiCompare } from '../core/primitives.js';
import { validateLaneChange } from '../core/entity.js';
import type { LaneChange } from '../movement/lane-change.js';
import { validateShieldSource, type ShieldSource } from '../combat/shield-ledger.js';
import { validateStatusInstance, type StatusInstance } from '../status/status-instance.js';
import { LANES, type Lane } from '../geometry/x100.js';
import { stagePriority } from '../core/pipeline-stage.js';

/**
 * Phase 19 T03 closed effect-command composition DSL (§7). An ability's
 * effects are composed into a closed set of commands; each command carries the
 * §7 identity fields (`commandId`, `abilityInstanceId`, `abilityId`,
 * `effectIndex`, `sourceId`, `targetRef`, `scheduledTick`, `stage`,
 * `sourceSnapshot`, `sequence`). Duplicate `commandId` or `effectIndex` (per
 * ability instance) is a hard error — never "last write wins".
 *
 * The executor in `effect-executor.ts` only validates, orders and enqueues;
 * it contains no damage/heal/shield/status/movement/spawn logic (§7).
 */

export const EFFECT_COMMAND_KINDS = [
  'damage',
  'heal',
  'shield',
  'apply_status',
  'remove_status',
  'cleanse',
  'dispel',
  'move',
  'lane_change',
  'spawn_request',
  'modify_charge',
  'taunt',
  'mark',
  'modify_objective',
  'modify_world',
] as const;
export type EffectCommandKind = (typeof EFFECT_COMMAND_KINDS)[number];

/** Effect commands enqueue at these authorized stages (§7, §3). */
export const EFFECT_STAGES = ['F', 'G', 'H', 'I', 'K'] as const;
export type EffectStage = (typeof EFFECT_STAGES)[number];

export interface EffectTargetRef {
  readonly kind: 'entity' | 'ground' | 'summon_slot';
  readonly entityId: string | null;
  readonly groundKey: string | null;
  readonly slotId: string | null;
}

/** Snapshot-safe source data carried on every command (§7). */
export interface SourceSnapshot {
  readonly sourceId: string;
  readonly sourceLane: Lane;
  readonly sourceX100: number;
  readonly sourceLp: number;
  readonly sourceMaxLp: number;
}

interface EffectCommandBase {
  readonly commandId: string;
  readonly abilityInstanceId: string;
  readonly abilityId: string;
  readonly effectIndex: number;
  readonly sourceId: string;
  readonly targetRef: EffectTargetRef;
  readonly scheduledTick: number;
  readonly stage: EffectStage;
  readonly sourceSnapshot: SourceSnapshot;
  readonly sequence: number;
}

export type EffectCommand =
  | (EffectCommandBase & { readonly kind: 'damage' | 'heal'; readonly amount: number })
  | (EffectCommandBase & { readonly kind: 'shield'; readonly shields: readonly ShieldSource[] })
  | (EffectCommandBase & { readonly kind: 'apply_status' | 'mark'; readonly statuses: readonly StatusInstance[] })
  | (EffectCommandBase & { readonly kind: 'remove_status'; readonly statusIds: readonly string[] })
  | (EffectCommandBase & { readonly kind: 'cleanse' | 'dispel' })
  | (EffectCommandBase & { readonly kind: 'move'; readonly lane: Lane; readonly x100: number })
  | (EffectCommandBase & { readonly kind: 'lane_change'; readonly laneChange: LaneChange })
  | (EffectCommandBase & { readonly kind: 'spawn_request'; readonly summonId: string })
  | (EffectCommandBase & { readonly kind: 'modify_charge'; readonly deltaTicks: number })
  | (EffectCommandBase & { readonly kind: 'taunt'; readonly durationTicks: number })
  | (EffectCommandBase & { readonly kind: 'modify_objective' | 'modify_world'; readonly port: string });

const ID = /^[a-z][a-z0-9_]*$/;

function assertId(value: string, code: string, field: string): void {
  if (!ID.test(value)) throw new KernelInvariantError(code, { [field]: value });
}

function assertNonNegative(value: number, code: string, field: string): void {
  if (!Number.isSafeInteger(value) || value < 0 || Object.is(value, -0)) {
    throw new KernelInvariantError(code, { [field]: value });
  }
}

function assertStage(value: EffectStage): void {
  if (!(EFFECT_STAGES as readonly string[]).includes(value)) throw new KernelInvariantError('P19_EFFECT_INVALID', { stage: value });
}

function validateTargetRef(ref: EffectTargetRef): void {
  if (!['entity', 'ground', 'summon_slot'].includes(ref.kind)) {
    throw new KernelInvariantError('P19_EFFECT_INVALID', { reason: 'target-ref-kind', kind: ref.kind });
  }
  for (const id of [ref.entityId, ref.groundKey, ref.slotId]) {
    if (id !== null && !ID.test(id)) throw new KernelInvariantError('P19_EFFECT_INVALID', { reason: 'target-ref-id', id });
  }
}

function validateSourceSnapshot(snapshot: SourceSnapshot): void {
  assertId(snapshot.sourceId, 'P19_EFFECT_INVALID', 'sourceId');
  if (!(LANES as readonly string[]).includes(snapshot.sourceLane)) throw new KernelInvariantError('P19_EFFECT_INVALID', { sourceLane: snapshot.sourceLane });
  for (const [field, value] of [
    ['sourceX100', snapshot.sourceX100],
    ['sourceLp', snapshot.sourceLp],
    ['sourceMaxLp', snapshot.sourceMaxLp],
  ] as const) {
    assertNonNegative(value, 'P19_EFFECT_INVALID', field);
  }
}

/** §7/§4 validation: closed kinds, stable ids, safe integers, no NaN/float/overflow. */
export function validateEffectCommand(command: EffectCommand): void {
  assertId(command.commandId, 'P19_EFFECT_INVALID', 'commandId');
  assertId(command.abilityInstanceId, 'P19_EFFECT_INVALID', 'abilityInstanceId');
  assertId(command.abilityId, 'P19_EFFECT_INVALID', 'abilityId');
  assertId(command.sourceId, 'P19_EFFECT_INVALID', 'sourceId');
  assertNonNegative(command.effectIndex, 'P19_EFFECT_INVALID', 'effectIndex');
  assertNonNegative(command.scheduledTick, 'P19_EFFECT_INVALID', 'scheduledTick');
  assertNonNegative(command.sequence, 'P19_EFFECT_INVALID', 'sequence');
  assertStage(command.stage);
  validateTargetRef(command.targetRef);
  validateSourceSnapshot(command.sourceSnapshot);
  switch (command.kind) {
    case 'damage':
    case 'heal':
      assertNonNegative(command.amount, 'P19_EFFECT_INVALID', 'amount');
      break;
    case 'shield':
      for (const source of command.shields) validateShieldSource(source);
      break;
    case 'apply_status':
    case 'mark':
      for (const instance of command.statuses) validateStatusInstance(instance);
      break;
    case 'remove_status':
      for (const statusId of command.statusIds) assertId(statusId, 'P19_EFFECT_INVALID', 'statusId');
      break;
    case 'cleanse':
    case 'dispel':
      break;
    case 'move':
      if (!(LANES as readonly string[]).includes(command.lane)) throw new KernelInvariantError('P19_EFFECT_INVALID', { lane: command.lane });
      assertNonNegative(command.x100, 'P19_EFFECT_INVALID', 'x100');
      if (command.x100 > 10000) throw new KernelInvariantError('P19_EFFECT_INVALID', { x100: command.x100 });
      break;
    case 'lane_change':
      validateLaneChange(command.laneChange);
      break;
    case 'spawn_request':
      assertId(command.summonId, 'P19_EFFECT_INVALID', 'summonId');
      break;
    case 'modify_charge':
      assertNonNegative(command.deltaTicks, 'P19_EFFECT_INVALID', 'deltaTicks');
      break;
    case 'taunt':
      assertNonNegative(command.durationTicks, 'P19_EFFECT_INVALID', 'durationTicks');
      break;
    case 'modify_objective':
    case 'modify_world':
      assertId(command.port, 'P19_EFFECT_INVALID', 'port');
      break;
    default:
      throw new KernelInvariantError('P19_EFFECT_INVALID', { reason: 'unknown-kind', kind: (command as { kind?: unknown }).kind });
  }
}

function targetOrderKey(ref: EffectTargetRef): string {
  return ref.entityId ?? ref.groundKey ?? ref.slotId ?? '';
}

/** §7 ordering: (scheduledTick, stagePriority, abilityInstanceId, effectIndex, targetKey, sequence). */
export function compareEffectCommands(a: EffectCommand, b: EffectCommand): number {
  return (
    a.scheduledTick - b.scheduledTick ||
    stagePriority(a.stage) - stagePriority(b.stage) ||
    asciiCompare(a.abilityInstanceId, b.abilityInstanceId) ||
    a.effectIndex - b.effectIndex ||
    asciiCompare(targetOrderKey(a.targetRef), targetOrderKey(b.targetRef)) ||
    a.sequence - b.sequence
  );
}

/** Canonical sort (stable, code-unit compares) — never insertion/array order. */
export function sortEffectCommands(commands: readonly EffectCommand[]): readonly EffectCommand[] {
  return Object.freeze([...commands].sort(compareEffectCommands));
}
