import type { StatusInstance } from './status-instance.js';

/**
 * Phase 18 T02 stack resolver (§6). `existing` is the canonically sorted set
 * of instances already on the target within the same stack group (see
 * `byTargetAndStackGroup`). Each policy returns the instances to keep plus a
 * closed outcome tag used for the `EffectApplied`/`EffectIgnored`/`EffectRefreshed`
 * event stream. All comparisons are pure and code-unit stable.
 */

export type StackOutcomeKind =
  | 'applied'
  | 'refreshed'
  | 'ignored_weaker'
  | 'ignored_no_reapply'
  | 'ignored_duration_cap'
  | 'refreshed_no_delta';

export interface StackContext {
  /** Authoritative battle tick the apply resolves at. */
  readonly now: number;
  /** §6.3 duration cap in ticks for `extend_duration_capped` (undefined = uncapped). */
  readonly durationCapTicks?: number;
}

export interface StackOutcome {
  readonly kind: StackOutcomeKind;
  /** Instances that remain in the group after the apply. */
  readonly kept: readonly StatusInstance[];
  /** The accepted instance (applied or refreshed), or null when ignored. */
  readonly instance: StatusInstance | null;
}

/** Remaining active duration in ticks, clamped to >= 0 (§5.1 endTick exclusive). */
export function remainingTicks(instance: StatusInstance, now: number): number {
  return Math.max(0, instance.endTick - now);
}

/** §6.1 primary key: strength alone decides replace vs ignore for replace_if_stronger. */
export function compareStrength(a: StatusInstance, b: StatusInstance): number {
  return a.strength - b.strength;
}

/**
 * §6.1 stable tie-break ordering: strength, then remaining duration, then
 * sourceId, then statusId. Used when choosing among distinct instances
 * (independent_by_source full-cap replacement, cleanse/dispel priority).
 */
export function compareStable(a: StatusInstance, b: StatusInstance, now: number): number {
  if (a.strength !== b.strength) return a.strength - b.strength;
  const da = remainingTicks(a, now);
  const db = remainingTicks(b, now);
  if (da !== db) return da - db;
  if (a.sourceId !== b.sourceId) return a.sourceId < b.sourceId ? -1 : 1;
  if (a.statusId !== b.statusId) return a.statusId < b.statusId ? -1 : 1;
  return 0;
}

function strongestOf(existing: readonly StatusInstance[], now: number): StatusInstance | undefined {
  let best: StatusInstance | undefined;
  for (const instance of existing) {
    if (best === undefined || compareStable(instance, best, now) > 0) best = instance;
  }
  return best;
}

function applied(instance: StatusInstance): StackOutcome {
  return { kind: 'applied', kept: Object.freeze([instance]), instance };
}

function refreshed(instance: StatusInstance, endTick: number): StackOutcome {
  const next = Object.freeze({ ...instance, endTick });
  return { kind: 'refreshed', kept: Object.freeze([next]), instance: next };
}

export function resolveStack(
  existing: readonly StatusInstance[],
  incoming: StatusInstance,
  context: StackContext,
): StackOutcome {
  switch (incoming.stackPolicy) {
    case 'replace_if_stronger': {
      // §6.1: one instance per group. A stronger instance replaces it; an equal
      // one refreshes the duration; a weaker one is ignored.
      if (existing.length === 0) return applied(incoming);
      const current = strongestOf(existing, context.now);
      if (current === undefined) return applied(incoming);
      const cmp = compareStrength(incoming, current);
      if (cmp > 0) return applied(incoming);
      if (cmp < 0) return { kind: 'ignored_weaker', kept: Object.freeze(existing), instance: null };
      return refreshed(current, incoming.endTick);
    }

    case 'refresh_duration': {
      // §6.2: existing strength stays; endTick is refreshed to the new duration.
      if (existing.length === 0) return applied(incoming);
      const current = strongestOf(existing, context.now);
      if (current === undefined) return applied(incoming);
      return refreshed(current, incoming.endTick);
    }

    case 'extend_duration_capped': {
      // §6.3: new duration is added to the remaining duration and capped.
      if (existing.length === 0) return applied(incoming);
      const current = strongestOf(existing, context.now);
      if (current === undefined) return applied(incoming);
      const cap = context.durationCapTicks;
      const remaining = remainingTicks(current, context.now);
      const added = Math.max(0, incoming.endTick - incoming.startTick);
      const extended = Math.min(remaining + added, cap ?? Number.MAX_SAFE_INTEGER);
      if (cap !== undefined && extended >= cap && remaining >= cap) {
        return { kind: 'ignored_duration_cap', kept: Object.freeze(existing), instance: null };
      }
      const next = Object.freeze({ ...current, endTick: context.now + extended });
      return {
        kind: extended > remaining ? 'refreshed' : 'refreshed_no_delta',
        kept: Object.freeze([next]),
        instance: next,
      };
    }

    case 'independent_by_source': {
      // §6.4: one instance per source. Reapply from the same source refreshes
      // that source's instance; distinct sources accumulate up to maxStacks. At
      // the cap the weakest existing instance is replaced via the stable
      // comparison — never insertion order.
      const sameSource = existing.find((instance) => instance.sourceId === incoming.sourceId);
      if (sameSource !== undefined) {
        const next = Object.freeze({ ...sameSource, endTick: Math.max(sameSource.endTick, incoming.endTick) });
        const kept = Object.freeze(existing.map((instance) => (instance === sameSource ? next : instance)));
        return { kind: 'refreshed', kept, instance: next };
      }
      if (existing.length < incoming.maxStacks) {
        return { kind: 'applied', kept: Object.freeze([...existing, incoming]), instance: incoming };
      }
      let weakestIndex = 0;
      for (let i = 1; i < existing.length; i += 1) {
        const atI = existing[i];
        const atWeakest = existing[weakestIndex];
        if (atI !== undefined && atWeakest !== undefined && compareStable(atI, atWeakest, context.now) < 0) weakestIndex = i;
      }
      const kept = Object.freeze(existing.map((instance, index) => (index === weakestIndex ? incoming : instance)));
      return { kind: 'applied', kept, instance: incoming };
    }

    case 'no_reapply': {
      // §6.5: while a matching instance is active or expiry-marked, reapply is
      // rejected.
      if (existing.some((instance) => instance.kind === incoming.kind)) {
        return { kind: 'ignored_no_reapply', kept: Object.freeze(existing), instance: null };
      }
      return applied(incoming);
    }
  }
}
