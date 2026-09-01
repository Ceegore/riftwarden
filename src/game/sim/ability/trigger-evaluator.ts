import { KernelInvariantError } from '../core/invariant-error.js';
import type { BattlePhaseState } from '../core/battle-state.js';
import type { KernelEntity } from '../core/entity.js';
import type { EventType } from '../events/event-spec.js';
import type { StatusInstance, StatusKind } from '../status/status-instance.js';
import { validatePredicateNode, validateTriggerNode, type PredicateNode, type TriggerNode } from './trigger-definition.js';

/**
 * Phase 19 T01 pure trigger evaluator (§5.2). Receives only an immutable
 * `TriggerContext` and a validated definition; never mutates state and never
 * consumes RNG. Result is `{matched, reasonCode, evidence}` with stable
 * reason codes and snapshot-safe evidence (IDs and integers only).
 */

export interface TriggerEventRecord {
  readonly type: EventType;
  readonly sourceId: string | null;
  readonly targetIds: readonly string[];
  readonly side: 'player' | 'enemy';
}

export interface TriggerContext {
  readonly battleTick: number;
  readonly ownerId: string;
  readonly ownerSide: 'player' | 'enemy';
  /** All entities alive-or-defeated this tick (stage B view). */
  readonly entities: readonly KernelEntity[];
  /** Canonically sorted active status instances (§18). */
  readonly statuses: readonly StatusInstance[];
  readonly battlePhase: BattlePhaseState;
  /** Events emitted since the previous tick (stage B view). */
  readonly eventsThisTick: readonly TriggerEventRecord[];
  /** Authoritative boss entity ids (Phase-17 battle-end config). */
  readonly bossIds: ReadonlySet<string>;
  /** Charge/cooldown state of the owning ability. */
  readonly chargeReady: boolean;
  /** True when this ability already fired its `once` trigger this battle. */
  readonly onceFired: boolean;
  /** HP at the start of the previous tick, for `hp_threshold_crossed`. */
  readonly hpBeforeTick: ReadonlyMap<string, number>;
}

export type TriggerReasonCode =
  | 'battle_start'
  | 'tick_interval_due'
  | 'hp_below_crossed'
  | 'hp_above_crossed'
  | 'event_seen'
  | 'event_not_seen'
  | 'status_present'
  | 'status_absent'
  | 'target_condition'
  | 'once_already_fired'
  | 'once_first_fire'
  | 'charge_ready'
  | 'charge_not_ready'
  | 'entity_defeated'
  | 'boss_phase'
  | 'count_in_range'
  | 'all_matched'
  | 'any_matched'
  | 'not_matched'
  | 'no_match';

export interface TriggerResult {
  readonly matched: boolean;
  readonly reasonCode: TriggerReasonCode;
  readonly evidence: readonly string[];
}

function result(matched: boolean, reasonCode: TriggerReasonCode, evidence: readonly string[] = []): TriggerResult {
  return Object.freeze({ matched, reasonCode, evidence: Object.freeze([...evidence]) });
}

function entityById(entities: readonly KernelEntity[], id: string | null): KernelEntity | undefined {
  if (id === null) return undefined;
  return entities.find((e) => e.id === id);
}

function scopeEntityIds(scope: string, ctx: TriggerContext, targetId: string | null): readonly string[] {
  if (scope === 'self') return [ctx.ownerId];
  if (scope === 'target') return targetId === null ? [] : [targetId];
  return ctx.entities.filter((e) => (scope === 'any_ally' ? e.side === ctx.ownerSide : e.side !== ctx.ownerSide)).map((e) => e.id);
}

function statusOn(entityId: string, kind: StatusKind, statuses: readonly StatusInstance[]): boolean {
  return statuses.some((s) => s.kind === kind && s.targetId === entityId);
}

function isAlive(entity: KernelEntity | undefined): boolean {
  return entity !== undefined && entity.phase.phase !== 'DEFEATED' && entity.phase.phase !== 'REMOVED';
}

/** Pure predicate evaluation against a candidate entity (or ground context). */
export function evaluatePredicate(node: PredicateNode, entity: KernelEntity | undefined, ctx: TriggerContext): boolean {
  switch (node.type) {
    case 'hp_below_percent':
      return entity !== undefined && entity.lp * 100 < entity.maxLp * node.percent;
    case 'hp_above_percent':
      return entity !== undefined && entity.lp * 100 > entity.maxLp * node.percent;
    case 'is_alive':
      return isAlive(entity);
    case 'is_boss':
      return entity?.id !== undefined && ctx.bossIds.has(entity.id);
    case 'is_regular':
      return entity?.origin === 'regular' || entity?.origin === undefined;
    case 'is_summoned':
      return entity?.origin === 'summoned';
    case 'is_construct':
      return entity?.origin === 'construct';
    case 'lane_is':
      return entity?.lane === node.lane;
    case 'has_status':
      return entity?.id !== undefined && statusOn(entity.id, node.kind, ctx.statuses);
    case 'lacks_status':
      return entity?.id !== undefined && !statusOn(entity.id, node.kind, ctx.statuses);
    case 'all':
      return node.children.every((child) => evaluatePredicate(child, entity, ctx));
    case 'any':
      return node.children.some((child) => evaluatePredicate(child, entity, ctx));
    case 'not':
      return !evaluatePredicate(node.child, entity, ctx);
    default:
      throw new KernelInvariantError('P19_TRIGGER_EVAL', { reason: 'unknown-predicate', type: (node as { type?: unknown }).type });
  }
}

function evaluateTriggerInternal(node: TriggerNode, ctx: TriggerContext, targetId: string | null): TriggerResult {
  switch (node.type) {
    case 'battle_start':
      return ctx.battleTick === 0 ? result(true, 'battle_start', ['tick:0']) : result(false, 'no_match');
    case 'tick_interval': {
      const offset = node.offsetTicks ?? 0;
      const due = ctx.battleTick >= offset && (ctx.battleTick - offset) % node.everyTicks === 0;
      return due ? result(true, 'tick_interval_due', [`tick:${String(ctx.battleTick)}`]) : result(false, 'no_match');
    }
    case 'hp_threshold_crossed': {
      const ids = scopeEntityIds(node.scope, ctx, targetId);
      const threshold = Math.floor((node.thresholdPercent / 100) * 100) / 100;
      for (const id of ids) {
        const entity = entityById(ctx.entities, id);
        if (!entity) continue;
        const before = ctx.hpBeforeTick.get(id);
        if (before === undefined) continue;
        const ratioBefore = before / entity.maxLp;
        const ratioNow = entity.lp / entity.maxLp;
        const crossed = node.direction === 'below' ? ratioBefore > threshold && ratioNow <= threshold : ratioBefore < threshold && ratioNow >= threshold;
        if (crossed) return result(true, node.direction === 'below' ? 'hp_below_crossed' : 'hp_above_crossed', [`entity:${id}`, `before:${String(before)}`, `now:${String(entity.lp)}`]);
      }
      return result(false, 'no_match');
    }
    case 'ally_event':
    case 'enemy_event': {
      const side = node.type === 'ally_event' ? ctx.ownerSide : ctx.ownerSide === 'player' ? 'enemy' : 'player';
      const seen = ctx.eventsThisTick.some((e) => e.type === node.eventId && e.side === side);
      return seen ? result(true, 'event_seen', [`event:${node.eventId}`]) : result(false, 'event_not_seen');
    }
    case 'status_present':
    case 'status_absent': {
      const ids = scopeEntityIds(node.scope, ctx, targetId);
      const present = ids.some((id) => statusOn(id, node.kind, ctx.statuses));
      const matched = node.type === 'status_present' ? present : !present;
      return matched ? result(true, node.type === 'status_present' ? 'status_present' : 'status_absent', [`kind:${node.kind}`]) : result(false, 'no_match');
    }
    case 'target_condition': {
      const entity = entityById(ctx.entities, targetId);
      const ok = evaluatePredicate(node.predicate, entity, ctx);
      return ok ? result(true, 'target_condition', targetId === null ? [] : [`entity:${targetId}`]) : result(false, 'no_match');
    }
    case 'once': {
      if (ctx.onceFired) return result(false, 'once_already_fired');
      const inner = evaluateTriggerInternal(node.child, ctx, targetId);
      if (inner.matched) return result(true, 'once_first_fire', inner.evidence);
      return result(false, 'no_match');
    }
    case 'charge_ready':
      return ctx.chargeReady ? result(true, 'charge_ready', [`chargeTicks:${String(ctx.battleTick)}`]) : result(false, 'charge_not_ready');
    case 'entity_defeated': {
      const side = node.side === 'ally' ? ctx.ownerSide : ctx.ownerSide === 'player' ? 'enemy' : 'player';
      const seen = ctx.eventsThisTick.some((e) => e.type === 'Defeated' && e.side === side);
      return seen ? result(true, 'entity_defeated', [`side:${node.side}`]) : result(false, 'no_match');
    }
    case 'boss_phase':
      return ctx.battlePhase.phase === node.phase ? result(true, 'boss_phase', [`phase:${node.phase}`]) : result(false, 'no_match');
    case 'count_in_range': {
      const count = ctx.entities.filter((e) => evaluatePredicate(node.predicate, e, ctx)).length;
      const ok = count >= node.min && count <= node.max;
      return ok ? result(true, 'count_in_range', [`count:${String(count)}`]) : result(false, 'no_match');
    }
    case 'all': {
      for (const child of node.children) {
        const r = evaluateTriggerInternal(child, ctx, targetId);
        if (!r.matched) return result(false, 'no_match');
      }
      return result(true, 'all_matched', [`children:${String(node.children.length)}`]);
    }
    case 'any': {
      for (const child of node.children) {
        const r = evaluateTriggerInternal(child, ctx, targetId);
        if (r.matched) return result(true, 'any_matched', r.evidence);
      }
      return result(false, 'no_match');
    }
    case 'not': {
      const r = evaluateTriggerInternal(node.child, ctx, targetId);
      return r.matched ? result(false, 'no_match') : result(true, 'not_matched');
    }
    default:
      throw new KernelInvariantError('P19_TRIGGER_EVAL', { reason: 'unknown-trigger', type: (node as { type?: unknown }).type });
  }
}

/**
 * Pure top-level evaluation. Validates the definition (cheap, depth-bounded),
 * then evaluates with the immutable context. `targetId` is the ability's
 * current target snapshot (may be null before selection).
 */
export function evaluateTrigger(node: TriggerNode, ctx: TriggerContext, targetId: string | null = null): TriggerResult {
  validateTriggerNode(node);
  return evaluateTriggerInternal(node, ctx, targetId);
}

/** Re-export for callers that build predicate trees inline. */
export function validatePredicate(node: PredicateNode): void {
  validatePredicateNode(node);
}
