import { KernelInvariantError } from '../core/invariant-error.js';
import type { KernelEntity } from '../core/entity.js';
import type { KernelSystem, TickContext } from '../core/tick-context.js';

/**
 * Phase 17 T05 defeat resolution (§9). Runs in stage J only, after every
 * stage-I command has been applied stably — HP may reach 0 during I, but
 * DEFEATED is set exclusively here. Processing order is the authorized §9
 * priority: death prevention hooks, committed revives, Defeated (+overkill),
 * then a later Remove (the remove hook, not an auto-remove).
 *
 * Phase 17 provides hooks and commands only: revive caps, once-per-battle and
 * HP return values come from content/status contracts. `preventDefeat` and
 * `queueRevive` are the two content-facing hooks this system honors per tick.
 */

export interface DefeatHookInput {
  /** Committed death-prevention requests: entityId -> priority (higher wins). */
  readonly preventDefeat: Readonly<Record<string, number>>;
  /**
   * Committed revive requests keyed by entityId. Values come from content
   * contracts (restored LP, once-per-battle flag). One revive per entity per
   * tick; once-per-battle refuses a second revive of the same entity.
   */
  readonly revives: Readonly<Record<string, { readonly restoredLp: number; readonly oncePerBattle: boolean }>>;
  /** When true, entities that reach 0 LP are removed the same tick after Defeated. */
  readonly removeOnDefeat: ReadonlySet<string>;
}

export const EMPTY_DEFEAT_HOOKS: DefeatHookInput = Object.freeze({
  preventDefeat: Object.freeze({}),
  revives: Object.freeze({}),
  removeOnDefeat: new Set<string>(),
});

export function validateDefeatHooks(hooks: DefeatHookInput): void {
  for (const [entityId, priority] of Object.entries(hooks.preventDefeat)) {
    if (!/^[a-z][a-z0-9_]*$/.test(entityId)) throw new KernelInvariantError('P14_SNAPSHOT_INVALID', { reason: 'defeat-hook-id', entityId });
    if (!Number.isSafeInteger(priority) || priority < 0) throw new KernelInvariantError('P14_SNAPSHOT_INVALID', { reason: 'defeat-prevent-priority', entityId, priority });
  }
  for (const [entityId, revive] of Object.entries(hooks.revives)) {
    if (!/^[a-z][a-z0-9_]*$/.test(entityId)) throw new KernelInvariantError('P14_SNAPSHOT_INVALID', { reason: 'revive-hook-id', entityId });
    if (!Number.isSafeInteger(revive.restoredLp) || revive.restoredLp < 0) throw new KernelInvariantError('P14_SNAPSHOT_INVALID', { reason: 'revive-hook-lp', entityId, restoredLp: revive.restoredLp });
    if (typeof revive.oncePerBattle !== 'boolean') throw new KernelInvariantError('P14_SNAPSHOT_INVALID', { reason: 'revive-hook-once', entityId });
  }
}

export interface DefeatOutcome {
  readonly entityId: string;
  /** Result of the resolution for this entity this tick. */
  readonly resolution: 'prevented' | 'revived' | 'defeated' | 'removed' | 'none';
  /** Overkill for the defeated event (amount beyond remaining LP). */
  readonly overkill: number;
  /** LP the entity was restored to on revive (content contract value). */
  readonly restoredLp: number | null;
}

/**
 * Pure stage-J resolution for one entity. `lp` must be the post-stage-I
 * clamped value (never negative). Returns what stage J does with the entity.
 */
export function resolveEntityDefeat(
  entity: KernelEntity,
  hooks: DefeatHookInput,
  reviveCount: number,
): DefeatOutcome {
  const defeatedOrRemoved = entity.phase.phase === 'DEFEATED' || entity.phase.phase === 'REMOVED';
  const atZero = entity.lp === 0;
  // §9 priority: death prevention is evaluated before any committed revive,
  // then revive, then Defeated. Prevention only applies at the moment of death
  // (zero LP, not yet defeated); an already-defeated entity can only change
  // through a committed revive.
  if (atZero && !defeatedOrRemoved) {
    const prevention = hooks.preventDefeat[entity.id];
    if (prevention !== undefined && prevention > 0) {
      return { entityId: entity.id, resolution: 'prevented', overkill: 0, restoredLp: null };
    }
  }
  const revive = hooks.revives[entity.id];
  if (revive !== undefined && (defeatedOrRemoved || atZero)) {
    if (revive.oncePerBattle && reviveCount > 0) {
      return { entityId: entity.id, resolution: 'defeated', overkill: 0, restoredLp: null };
    }
    return { entityId: entity.id, resolution: 'revived', overkill: 0, restoredLp: revive.restoredLp };
  }
  if (defeatedOrRemoved) return { entityId: entity.id, resolution: 'none', overkill: 0, restoredLp: null };
  if (!atZero) return { entityId: entity.id, resolution: 'none', overkill: 0, restoredLp: null };
  return { entityId: entity.id, resolution: 'defeated', overkill: entity.pendingOverkill ?? 0, restoredLp: null };
}

/**
 * Stage-J defeat resolver system. Emits Defeated (with overkill = excess of
 * the killing hit, carried by the damage pipeline as a pending field), Revived
 * and Removed transitions/events via kernel commands. Never mutates LP itself.
 */
export function createDefeatResolverSystem(hooks: Partial<DefeatHookInput> = EMPTY_DEFEAT_HOOKS): KernelSystem {
  const full: DefeatHookInput = Object.freeze({
    preventDefeat: hooks.preventDefeat ?? Object.freeze({}),
    revives: hooks.revives ?? Object.freeze({}),
    removeOnDefeat: hooks.removeOnDefeat ?? new Set<string>(),
  });
  validateDefeatHooks(full);
  return {
    id: 'phase17.j1.defeat_resolver',
    stage: 'J',
    run(context: TickContext): void {
      const reviveCounts = new Map<string, number>();
      for (const entity of context.state.entities) {
        const count = entity.reviveCount ?? 0;
        reviveCounts.set(entity.id, count);
        const outcome = resolveEntityDefeat(entity, full, count);
        if (outcome.resolution === 'prevented') {
          // Prevention keeps the entity ACTIVE at 0 LP; no Defeated event.
          continue;
        }
        if (outcome.resolution === 'revived' && outcome.restoredLp !== null) {
          const restored = Math.min(outcome.restoredLp, entity.maxLp);
          reviveCounts.set(entity.id, count + 1);
          context.commands.push({ kind: 'entity_transition', entityId: entity.id, request: { to: 'ACTIVE', priority: 100, reason: 'revive' } });
          context.commands.push({ kind: 'apply_lp_delta', entityId: entity.id, delta: Math.max(0, restored - entity.lp), sourceId: null });
          context.commands.push({ kind: 'set_revive_count', entityId: entity.id, count: count + 1 });
          context.commands.push({
            kind: 'append_event',
            event: Object.freeze({
              type: 'Revived',
              sourceId: entity.id,
              targetIds: Object.freeze([entity.id]),
              contentIds: Object.freeze([]),
              payload: Object.freeze({ restoredLp: restored }),
              logTags: Object.freeze(['sim.phase17']),
            }),
          });
          continue;
        }
        if (outcome.resolution === 'defeated') {
          // An entity already DEFEATED (e.g. a once-per-battle revive refused)
          // stays put — never re-transition or re-emit.
          if (entity.phase.phase === 'DEFEATED' || entity.phase.phase === 'REMOVED') continue;
          // §9.4: a real kill is battle progress — reset the global
          // no-progress endcap so a battle that is advancing toward
          // elimination never times out (stage-I damage/heal and stage-K
          // spawns reset it too; this is the death signal). Prevention/revive
          // do not count.
          context.commands.push({ kind: 'set_global_progress', noProgressTicks: 0, collapseTicks: 0, warned: false });
          const overkill = entity.pendingOverkill ?? 0;
          const removeNow = full.removeOnDefeat.has(entity.id);
          // With the remove hook, transition straight to REMOVED (a legal
          // direct exit from ACTIVE): the deferred transition resolution and
          // the immediate remove cannot both fire in one stage.
          if (removeNow) {
            context.commands.push({ kind: 'remove_entity', entityId: entity.id });
          } else {
            context.commands.push({ kind: 'entity_transition', entityId: entity.id, request: { to: 'DEFEATED', priority: 100, reason: 'defeat' } });
          }
          context.commands.push({
            kind: 'append_event',
            event: Object.freeze({
              type: 'Defeated',
              sourceId: entity.id,
              targetIds: Object.freeze([entity.id]),
              contentIds: Object.freeze([]),
              payload: Object.freeze({ overkill }),
              logTags: Object.freeze(['sim.phase17']),
            }),
          });
          continue;
        }
      }
      void reviveCounts;
    },
  };
}
