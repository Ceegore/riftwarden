import { KernelInvariantError } from '../core/invariant-error.js';
import type { BattlePhase } from '../core/battle-state.js';
import type { Lane } from '../geometry/x100.js';
import { EVENT_SPEC, type EventType } from '../events/event-spec.js';
import { isStatusKind, type StatusKind } from '../status/status-instance.js';

/**
 * Phase 19 T01 closed trigger/predicate DSL (§5). Every node is a plain,
 * frozen data structure — no free expression, no string path, no callback,
 * no `eval`, no dynamic function reference. Identical definitions evaluate
 * identically in every runtime.
 *
 * Safety bounds (§5.3): fixed AST depth cap, fixed child cap per node, and
 * validation rejects unknown variants, NaN, floats, negative/safe-integer
 * violations and invalid IDs. Cyclic structures are impossible to evaluate
 * because validation fails them at the depth cap.
 */

/** §5.3: closed maximum AST depth. */
export const MAX_TRIGGER_DEPTH = 8;
/** §5.3: closed maximum number of children per composite node. */
export const MAX_TRIGGER_CHILDREN = 6;

export type EntityScope = 'self' | 'target' | 'any_ally' | 'any_enemy';
export const ENTITY_SCOPES = ['self', 'target', 'any_ally', 'any_enemy'] as const;

export type TriggerNode =
  | { readonly type: 'battle_start' }
  | { readonly type: 'tick_interval'; readonly everyTicks: number; readonly offsetTicks?: number }
  | {
      readonly type: 'hp_threshold_crossed';
      readonly scope: EntityScope;
      readonly thresholdPercent: number;
      readonly direction: 'below' | 'above';
    }
  | { readonly type: 'ally_event'; readonly eventId: EventType }
  | { readonly type: 'enemy_event'; readonly eventId: EventType }
  | { readonly type: 'status_present'; readonly kind: StatusKind; readonly scope: EntityScope }
  | { readonly type: 'status_absent'; readonly kind: StatusKind; readonly scope: EntityScope }
  | { readonly type: 'target_condition'; readonly predicate: PredicateNode }
  | { readonly type: 'once'; readonly child: TriggerNode }
  | { readonly type: 'charge_ready' }
  | { readonly type: 'entity_defeated'; readonly side: 'ally' | 'enemy' }
  | { readonly type: 'boss_phase'; readonly phase: BattlePhase }
  | { readonly type: 'count_in_range'; readonly predicate: PredicateNode; readonly min: number; readonly max: number }
  | { readonly type: 'all' | 'any'; readonly children: readonly TriggerNode[] }
  | { readonly type: 'not'; readonly child: TriggerNode };

export type PredicateNode =
  | { readonly type: 'hp_below_percent' | 'hp_above_percent'; readonly percent: number }
  | { readonly type: 'is_alive' | 'is_boss' | 'is_regular' | 'is_summoned' | 'is_construct' }
  | { readonly type: 'lane_is'; readonly lane: Lane }
  | { readonly type: 'has_status' | 'lacks_status'; readonly kind: StatusKind }
  | { readonly type: 'all' | 'any'; readonly children: readonly PredicateNode[] }
  | { readonly type: 'not'; readonly child: PredicateNode };

const EVENT_IDS = new Set<string>(Object.keys(EVENT_SPEC));

function isEventId(value: string): boolean {
  return EVENT_IDS.has(value);
}

function assertInt(value: number, code: string, detail: string): number {
  if (!Number.isSafeInteger(value) || value < 0 || Object.is(value, -0)) {
    throw new KernelInvariantError(code, { [detail]: value });
  }
  return value;
}

function assertPercent(value: number, code: string, detail: string): void {
  if (!Number.isSafeInteger(value) || value < 1 || value > 100) {
    throw new KernelInvariantError(code, { [detail]: value });
  }
}

function isEntityScope(value: unknown): value is EntityScope {
  return typeof value === 'string' && (ENTITY_SCOPES as readonly string[]).includes(value);
}

function isPredicate(value: unknown): value is PredicateNode {
  return typeof value === 'object' && value !== null && 'type' in (value as Record<string, unknown>);
}

function checkChildCount(count: number, code: string): void {
  if (count > MAX_TRIGGER_CHILDREN) throw new KernelInvariantError(code, { count });
}

/** Validates a predicate node; rejects unknown variants and unsafe values. */
export function validatePredicateNode(node: PredicateNode, depth = 0): void {
  if (depth > MAX_TRIGGER_DEPTH) throw new KernelInvariantError('P19_TRIGGER_DEPTH', { depth });
  switch (node.type) {
    case 'hp_below_percent':
    case 'hp_above_percent':
      assertPercent(node.percent, 'P19_TRIGGER_INVALID', 'percent');
      return;
    case 'is_alive':
    case 'is_boss':
    case 'is_regular':
    case 'is_summoned':
    case 'is_construct':
      return;
    case 'lane_is':
      if (!['top', 'middle', 'bottom'].includes(node.lane)) throw new KernelInvariantError('P19_TRIGGER_INVALID', { lane: node.lane });
      return;
    case 'has_status':
    case 'lacks_status':
      if (!isStatusKind(node.kind)) throw new KernelInvariantError('P19_TRIGGER_INVALID', { kind: node.kind });
      return;
    case 'all':
    case 'any': {
      if (!Array.isArray(node.children)) throw new KernelInvariantError('P19_TRIGGER_INVALID', { reason: 'children-not-array' });
      checkChildCount(node.children.length, 'P19_TRIGGER_CHILD_CAP');
      for (const child of node.children) {
        if (!isPredicate(child)) throw new KernelInvariantError('P19_TRIGGER_INVALID', { reason: 'predicate-child' });
        validatePredicateNode(child, depth + 1);
      }
      return;
    }
    case 'not':
      if (!isPredicate(node.child)) throw new KernelInvariantError('P19_TRIGGER_INVALID', { reason: 'not-child' });
      validatePredicateNode(node.child, depth + 1);
      return;
    default:
      throw new KernelInvariantError('P19_TRIGGER_INVALID', { reason: 'unknown-predicate-variant', type: (node as { type?: unknown }).type });
  }
}

/** Validates a trigger node (recursively); rejects unknown variants, unsafe values, depth/child violations. */
export function validateTriggerNode(node: TriggerNode, depth = 0): void {
  if (depth > MAX_TRIGGER_DEPTH) throw new KernelInvariantError('P19_TRIGGER_DEPTH', { depth });
  switch (node.type) {
    case 'battle_start':
    case 'charge_ready':
      return;
    case 'tick_interval':
      assertInt(node.everyTicks, 'P19_TRIGGER_INVALID', 'everyTicks');
      if (node.everyTicks === 0) throw new KernelInvariantError('P19_TRIGGER_INVALID', { reason: 'interval-zero' });
      if (node.offsetTicks !== undefined) assertInt(node.offsetTicks, 'P19_TRIGGER_INVALID', 'offsetTicks');
      return;
    case 'hp_threshold_crossed':
      if (!isEntityScope(node.scope)) throw new KernelInvariantError('P19_TRIGGER_INVALID', { scope: node.scope });
      assertPercent(node.thresholdPercent, 'P19_TRIGGER_INVALID', 'thresholdPercent');
      if (!(['below', 'above'] as readonly string[]).includes(node.direction)) throw new KernelInvariantError('P19_TRIGGER_INVALID', { direction: node.direction });
      return;
    case 'ally_event':
    case 'enemy_event':
      if (typeof node.eventId !== 'string' || !isEventId(node.eventId)) {
        throw new KernelInvariantError('P19_TRIGGER_INVALID', { reason: 'unknown-event', eventId: node.eventId });
      }
      return;
    case 'status_present':
    case 'status_absent':
      if (!isStatusKind(node.kind)) throw new KernelInvariantError('P19_TRIGGER_INVALID', { kind: node.kind });
      if (!isEntityScope(node.scope)) throw new KernelInvariantError('P19_TRIGGER_INVALID', { scope: node.scope });
      return;
    case 'target_condition':
      if (!isPredicate(node.predicate)) throw new KernelInvariantError('P19_TRIGGER_INVALID', { reason: 'target-predicate' });
      validatePredicateNode(node.predicate, depth + 1);
      return;
    case 'once':
      validateTriggerNode(node.child, depth + 1);
      return;
    case 'entity_defeated':
      if (!(['ally', 'enemy'] as readonly string[]).includes(node.side)) throw new KernelInvariantError('P19_TRIGGER_INVALID', { side: node.side });
      return;
    case 'boss_phase':
      if (!['PREPARED', 'INTRO', 'ACTIVE', 'PHASE_TRANSITION', 'RESOLVING_END', 'VICTORY', 'DEFEAT', 'DRAW_ABORT'].includes(node.phase)) {
        throw new KernelInvariantError('P19_TRIGGER_INVALID', { phase: node.phase });
      }
      return;
    case 'count_in_range':
      if (!isPredicate(node.predicate)) throw new KernelInvariantError('P19_TRIGGER_INVALID', { reason: 'count-predicate' });
      validatePredicateNode(node.predicate, depth + 1);
      assertInt(node.min, 'P19_TRIGGER_INVALID', 'min');
      assertInt(node.max, 'P19_TRIGGER_INVALID', 'max');
      if (node.min > node.max) throw new KernelInvariantError('P19_TRIGGER_INVALID', { reason: 'count-range', min: node.min, max: node.max });
      return;
    case 'all':
    case 'any': {
      if (!Array.isArray(node.children)) throw new KernelInvariantError('P19_TRIGGER_INVALID', { reason: 'children-not-array' });
      checkChildCount(node.children.length, 'P19_TRIGGER_CHILD_CAP');
      for (const child of node.children) {
        validateTriggerNode(child as TriggerNode, depth + 1);
      }
      return;
    }
    case 'not':
      validateTriggerNode(node.child, depth + 1);
      return;
    default:
      throw new KernelInvariantError('P19_TRIGGER_INVALID', { reason: 'unknown-trigger-variant', type: (node as { type?: unknown }).type });
  }
}

/** Convenience: validate a trigger tree and return the (frozen) definition. */
export function defineTrigger(node: TriggerNode): TriggerNode {
  validateTriggerNode(node);
  return Object.freeze(structuredClone(node));
}

/** Convenience: validate a predicate tree and return the (frozen) definition. */
export function definePredicate(node: PredicateNode): PredicateNode {
  validatePredicateNode(node);
  return Object.freeze(structuredClone(node));
}

export function ownerScopeOf(side: 'player' | 'enemy'): 'any_ally' | 'any_enemy' {
  return side === 'player' ? 'any_ally' : 'any_enemy';
}
