import { KernelInvariantError } from '../core/invariant-error.js';
import type { KernelEntity } from '../core/entity.js';
import { asciiCompare } from '../core/primitives.js';
import { edgeDistanceX100, type Body } from '../geometry/distance.js';
import { asX100, LANES, LANE_ORDINAL, type Lane } from '../geometry/x100.js';

/**
 * Phase 19 T02 closed target-query DSL and deterministic resolver (§6).
 * Closed target spaces (§6.1); `summon_slot` is only a typed port here
 * (Phase 20 owns the lifecycle) and resolves to `slot_unavailable` when the
 * slot is absent/unavailable. Deterministic tie order (§6.2, §4): primary
 * score desc → distance asc → lane ordinal asc → entityId code-unit asc —
 * never array/insertion order, localized text or object identity. Fixed
 * content targets take precedence over generic selection (§6.2). Closed
 * `InvalidTargetReason` (§6.3); preview and runtime share these semantics.
 */

export const TARGET_SPACES = ['self', 'allied_entity', 'enemy_entity', 'ground_point', 'summon_slot', 'boss_object'] as const;
export type TargetSpace = (typeof TARGET_SPACES)[number];

export const SELECTION_PROFILES = ['score', 'lowest_effective_lp', 'highest_threat', 'nearest'] as const;
export type SelectionProfile = (typeof SELECTION_PROFILES)[number];

export const INVALID_TARGET_REASONS = ['empty', 'out_of_range', 'untargetable', 'defeated', 'slot_unavailable', 'ground_invalid', 'disclosure_forbidden'] as const;
export type InvalidTargetReason = (typeof INVALID_TARGET_REASONS)[number];

/** Closed per-candidate filter (§6.2). */
export type TargetFilter =
  | { readonly type: 'alive' }
  | { readonly type: 'active' }
  | { readonly type: 'origin'; readonly origin: 'regular' | 'summoned' | 'construct' }
  | { readonly type: 'boss' }
  | { readonly type: 'visible' }
  | { readonly type: 'targetable' }
  | { readonly type: 'lane'; readonly lane: Lane }
  | { readonly type: 'range'; readonly rangeX100: number };

export interface TargetQuery {
  readonly space: TargetSpace;
  readonly profile: SelectionProfile;
  readonly filters?: readonly TargetFilter[];
  /** Fixed content targets win over generic selection (§6.2). */
  readonly fixedTargetIds?: readonly string[];
  readonly groundKey?: string;
  readonly groundLane?: Lane;
  readonly groundX100?: number;
}

/** Phase 20 typed slot port; Phase 19 only reads availability. */
export interface SummonSlotState {
  readonly slotId: string;
  readonly lane: Lane;
  readonly x100: number;
  readonly available: boolean;
}

export interface TargetQueryContext {
  readonly tick: number;
  readonly source: KernelEntity;
  readonly entities: readonly KernelEntity[];
  readonly bossIds: ReadonlySet<string>;
  /** Authorized threat metric (content-supplied); absent ⇒ all zero. */
  readonly threat?: ReadonlyMap<string, number>;
  /** Phase 20 typed port; absent ⇒ every slot is `slot_unavailable`. */
  readonly summonSlots?: ReadonlyMap<string, SummonSlotState>;
  readonly visibleIds?: ReadonlySet<string>;
  readonly untargetableIds?: ReadonlySet<string>;
  readonly disclosureForbidden?: boolean;
}

export interface TargetSnapshot {
  readonly kind: 'entity' | 'ground' | 'summon_slot';
  readonly entityId: string | null;
  readonly groundKey: string | null;
  readonly slotId: string | null;
  readonly lane: Lane;
  readonly x100: number;
  readonly acquiredTick: number;
}

export type TargetQueryOutcome =
  | { readonly status: 'selected'; readonly target: TargetSnapshot; readonly score: number }
  | { readonly status: 'invalid'; readonly reason: InvalidTargetReason };

const ID = /^[a-z][a-z0-9_]*$/;
const invalid = (reason: InvalidTargetReason): TargetQueryOutcome => Object.freeze({ status: 'invalid', reason });
const selected = (target: TargetSnapshot, score: number): TargetQueryOutcome => Object.freeze({ status: 'selected', target: Object.freeze(target), score });

function assertLane(lane: unknown): asserts lane is Lane {
  if (typeof lane !== 'string' || !(LANES as readonly string[]).includes(lane)) throw new KernelInvariantError('P19_TARGET_INVALID', { lane });
}

function isAlive(entity: KernelEntity): boolean {
  return entity.phase.phase !== 'DEFEATED' && entity.phase.phase !== 'REMOVED';
}

function isActive(entity: KernelEntity): boolean {
  const p = entity.phase.phase;
  return p !== 'SPAWNING' && p !== 'DEFEATED' && p !== 'REMOVED';
}

/** Structural validation; rejects malformed content (throws), never returns. */
export function validateTargetQuery(query: TargetQuery): void {
  if (!(TARGET_SPACES as readonly string[]).includes(query.space)) throw new KernelInvariantError('P19_TARGET_INVALID', { space: query.space });
  if (!(SELECTION_PROFILES as readonly string[]).includes(query.profile)) throw new KernelInvariantError('P19_TARGET_INVALID', { profile: query.profile });
  for (const filter of query.filters ?? []) {
    switch (filter.type) {
      case 'alive':
      case 'active':
      case 'boss':
      case 'visible':
      case 'targetable':
        break;
      case 'origin':
        if (!['regular', 'summoned', 'construct'].includes(filter.origin)) throw new KernelInvariantError('P19_TARGET_INVALID', { origin: filter.origin });
        break;
      case 'lane':
        assertLane(filter.lane);
        break;
      case 'range':
        if (!Number.isSafeInteger(filter.rangeX100) || filter.rangeX100 < 0 || Object.is(filter.rangeX100, -0)) throw new KernelInvariantError('P19_TARGET_INVALID', { rangeX100: filter.rangeX100 });
        break;
      default:
        throw new KernelInvariantError('P19_TARGET_INVALID', { reason: 'unknown-filter', type: (filter as { type?: unknown }).type });
    }
  }
  for (const id of query.fixedTargetIds ?? []) {
    if (!ID.test(id)) throw new KernelInvariantError('P19_TARGET_INVALID', { fixedTargetId: id });
  }
  if (query.space === 'ground_point') {
    if (query.groundKey === undefined || !ID.test(query.groundKey)) throw new KernelInvariantError('P19_TARGET_INVALID', { groundKey: query.groundKey });
    if (query.groundLane === undefined) throw new KernelInvariantError('P19_TARGET_INVALID', { reason: 'ground-lane-missing' });
    assertLane(query.groundLane);
    if (query.groundX100 === undefined || !Number.isSafeInteger(query.groundX100)) throw new KernelInvariantError('P19_TARGET_INVALID', { reason: 'ground-x100-missing', groundX100: query.groundX100 });
  }
}

interface CandidateView {
  readonly entity: KernelEntity;
  readonly distance: number;
  readonly threat: number;
  readonly visible: boolean;
  readonly targetable: boolean;
}

function bodyOf(entity: KernelEntity): Body {
  return { id: entity.id, x100: asX100(entity.x100), radiusX100: asX100(entity.radiusX100 ?? 0), lane: entity.lane };
}

function matchesFilter(filter: TargetFilter, view: CandidateView, ctx: TargetQueryContext): boolean {
  const e = view.entity;
  switch (filter.type) {
    case 'alive':
      return isAlive(e);
    case 'active':
      return isActive(e);
    case 'origin':
      return (e.origin ?? 'regular') === filter.origin;
    case 'boss':
      return ctx.bossIds.has(e.id);
    case 'visible':
      return view.visible;
    case 'targetable':
      return view.targetable;
    case 'lane':
      return e.lane === filter.lane;
    case 'range':
      return view.distance <= filter.rangeX100;
    default:
      return false;
  }
}

function entityViews(query: TargetQuery, ctx: TargetQueryContext): CandidateView[] {
  const sourceBody = bodyOf(ctx.source);
  const out: CandidateView[] = [];
  for (const entity of ctx.entities) {
    if (entity.id === ctx.source.id) continue;
    const include = (() => {
      switch (query.space) {
        case 'allied_entity':
          return entity.side === ctx.source.side;
        case 'enemy_entity':
          return entity.side !== ctx.source.side;
        case 'boss_object':
          return ctx.bossIds.has(entity.id);
        case 'self':
        case 'ground_point':
        case 'summon_slot':
          return false;
      }
    })();
    if (!include) continue;
    out.push({
      entity,
      distance: Number(edgeDistanceX100(sourceBody, bodyOf(entity))),
      threat: ctx.threat?.get(entity.id) ?? 0,
      visible: ctx.visibleIds?.has(entity.id) ?? true,
      targetable: !(ctx.untargetableIds?.has(entity.id) ?? false),
    });
  }
  return out;
}

/** Primary score per §6.2 profile; "best" is always the maximum. */
function profileScore(profile: SelectionProfile, view: CandidateView, source: KernelEntity): number {
  switch (profile) {
    case 'lowest_effective_lp':
      return -view.entity.lp;
    case 'highest_threat':
      return view.threat;
    case 'nearest':
      return -view.distance;
    case 'score': {
      // Authorized Phase-19 score profile (integer, deterministic).
      let score = 100 - view.distance * 2;
      if (view.entity.lane === source.lane) score += 45;
      if (view.threat > 0) score += 12;
      if ((view.entity.origin ?? 'regular') === 'regular') score += 8;
      return score;
    }
    default:
      return 0;
  }
}

/** §6.2 tie order: score desc → distance asc → lane ordinal asc → entityId asc. */
function compareViews(a: CandidateView, b: CandidateView, aScore: number, bScore: number): number {
  return bScore - aScore || a.distance - b.distance || LANE_ORDINAL[a.entity.lane] - LANE_ORDINAL[b.entity.lane] || asciiCompare(a.entity.id, b.entity.id);
}

function entityTarget(view: CandidateView, ctx: TargetQueryContext): TargetSnapshot {
  return { kind: 'entity', entityId: view.entity.id, groundKey: null, slotId: null, lane: view.entity.lane, x100: view.entity.x100, acquiredTick: ctx.tick };
}

/**
 * Pure resolver (§6). Validates the query, then either selects a target
 * snapshot (with its primary score) or returns a closed invalid reason.
 */
export function resolveTargetQuery(query: TargetQuery, ctx: TargetQueryContext): TargetQueryOutcome {
  validateTargetQuery(query);
  if (ctx.disclosureForbidden === true) return invalid('disclosure_forbidden');

  if (query.space === 'ground_point') {
    const groundX100 = query.groundX100;
    const groundLane = query.groundLane;
    if (groundX100 === undefined || groundLane === undefined) return invalid('ground_invalid');
    if (groundX100 < 0 || groundX100 > 10000) return invalid('ground_invalid');
    return selected({ kind: 'ground', entityId: null, groundKey: query.groundKey ?? null, slotId: null, lane: groundLane, x100: groundX100, acquiredTick: ctx.tick }, 0);
  }

  if (query.space === 'summon_slot') {
    const slot = ctx.summonSlots?.get(query.groundKey ?? '');
    if (slot?.available === true) return selected({ kind: 'summon_slot', entityId: null, groundKey: null, slotId: slot.slotId, lane: slot.lane, x100: slot.x100, acquiredTick: ctx.tick }, 0);
    return invalid('slot_unavailable');
  }

  if (query.space === 'self') {
    if (!isAlive(ctx.source)) return invalid('defeated');
    return selected({ kind: 'entity', entityId: ctx.source.id, groundKey: null, slotId: null, lane: ctx.source.lane, x100: ctx.source.x100, acquiredTick: ctx.tick }, 0);
  }

  const views = entityViews(query, ctx);
  if (views.length === 0) return invalid('empty');

  const alive = views.filter((view) => isAlive(view.entity));
  if (alive.length === 0) return invalid('defeated');

  const selectable = alive.filter((view) => view.targetable);
  if (selectable.length === 0) return invalid('untargetable');

  const hasRangeFilter = (query.filters ?? []).some((filter) => filter.type === 'range');
  const filtered = selectable.filter((view) => (query.filters ?? []).every((filter) => matchesFilter(filter, view, ctx)));
  if (filtered.length === 0) return invalid(hasRangeFilter ? 'out_of_range' : 'empty');

  // Fixed content targets take precedence over generic selection (§6.2).
  if (query.fixedTargetIds !== undefined && query.fixedTargetIds.length > 0) {
    const byId = new Map(filtered.map((view) => [view.entity.id, view] as const));
    for (const id of query.fixedTargetIds) {
      const view = byId.get(id);
      if (view !== undefined) return selected(entityTarget(view, ctx), profileScore(query.profile, view, ctx.source));
    }
  }

  const scored = filtered.map((view) => ({ view, score: profileScore(query.profile, view, ctx.source) })).sort((a, b) => compareViews(a.view, b.view, a.score, b.score));
  const best = scored[0];
  return best === undefined ? invalid('empty') : selected(entityTarget(best.view, ctx), best.score);
}
