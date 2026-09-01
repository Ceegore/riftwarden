import { KernelInvariantError } from '../core/invariant-error.js';
import type { KernelCommand } from '../core/command-types.js';
import type { KernelSystem, TickContext } from '../core/tick-context.js';
import { byTargetId, createStatusCollection, type StatusCollection } from './status-collection.js';
import { selectCleanseTarget, selectDispelTarget, type CleanseDispelKind } from './cleanse-dispel.js';
import { removalReasonOrdinal, statusKindOrdinal, type StatusInstance } from './status-instance.js';
import { statusContentIds } from './status-events.js';

/**
 * Phase 18 T05 kernel integration (§4 stages H/K, §9). Content supplies
 * cleanse/dispel requests per tick (the Phase-19 ability framework will drive
 * these); this module owns the deterministic plumbing:
 *
 * - stage H (`phase18.h1.cleanse_queue`) enqueues `queue_cleanse_dispel`
 *   commands — no collection mutation outside the resolver (§4);
 * - stage K (`phase18.k1.cleanse_apply`) consumes `pendingCleanses`, resolves
 *   the §9.1/§9.2 target through the pure selectors (unremovable always
 *   skipped), removes it via `set_statuses`, publishes `EffectRemoved` with
 *   the cleansed/dispelled reason, and clears the queue.
 *
 * Shield effects are not status instances (§9.2) — a shield dispel goes
 * through the Phase-17 shield ledger with individual removal/reduction
 * events, which is content-owned and lands with Phase-19 abilities.
 */
export interface CleanseDispelConfig {
  /** Content-driven cleanse requests per tick (§9.1). Absent → no cleanses. */
  readonly cleanses?: (context: TickContext) => readonly { targetId: string }[];
  /** Content-driven dispel requests per tick (§9.2). Absent → no dispels. */
  readonly dispels?: (context: TickContext) => readonly { targetId: string }[];
}

const EMPTY: StatusCollection = Object.freeze([]);
const ID = /^[a-z][a-z0-9_]*$/;

export function createCleanseQueueSystem(config: CleanseDispelConfig = {}): KernelSystem {
  const cleanses = config.cleanses ?? ((): readonly { targetId: string }[] => Object.freeze([]));
  const dispels = config.dispels ?? ((): readonly { targetId: string }[] => Object.freeze([]));
  return Object.freeze({
    id: 'phase18.h1.cleanse_queue',
    stage: 'H' as const,
    run(context: TickContext): void {
      for (const request of cleanses(context)) enqueue(context, request.targetId, 'cleanse');
      for (const request of dispels(context)) enqueue(context, request.targetId, 'dispel');
    },
  });
}

function enqueue(context: TickContext, targetId: string, request: CleanseDispelKind): void {
  if (!ID.test(targetId)) throw new KernelInvariantError('P14_SNAPSHOT_INVALID', { reason: 'cleanse-target-invalid', targetId });
  context.commands.push({ kind: 'queue_cleanse_dispel', targetId, request });
}

export function createCleanseApplySystem(): KernelSystem {
  return Object.freeze({
    id: 'phase18.k1.cleanse_apply',
    stage: 'K' as const,
    run(context: TickContext): void {
      const pending = context.state.pendingCleanses;
      if (pending === undefined || pending.length === 0) return;
      const now = context.state.tick;
      let statuses: StatusCollection = context.state.statuses ?? EMPTY;
      let mutated = false;
      const emitRemoved = (instance: StatusInstance, targetId: string, kind: CleanseDispelKind): void => {
        const reason = kind === 'cleanse' ? 'cleansed' : 'dispelled';
        const stack = byTargetId(statuses, targetId).filter((s) => s.kind === instance.kind).length;
        const command: KernelCommand = {
          kind: 'append_event',
          event: {
            type: 'EffectRemoved',
            sourceId: instance.sourceId,
            targetIds: Object.freeze([targetId]),
            contentIds: statusContentIds(instance),
            payload: Object.freeze({
              stackCount: stack,
              endTick: instance.endTick,
              strength: instance.strength,
              kindOrdinal: statusKindOrdinal(instance.kind),
              reasonOrdinal: removalReasonOrdinal(reason),
            }),
            logTags: Object.freeze([]),
          },
        };
        context.commands.push(command);
      };
      for (const request of pending) {
        const targetInstances = byTargetId(statuses, request.targetId);
        const instance = request.kind === 'cleanse' ? selectCleanseTarget(targetInstances, now) : selectDispelTarget(targetInstances, now);
        if (instance === undefined) continue;
        statuses = statuses.filter((s) => s.statusId !== instance.statusId);
        mutated = true;
        emitRemoved(instance, request.targetId, request.kind);
      }
      if (mutated) context.commands.push({ kind: 'set_statuses', statuses: createStatusCollection(statuses) });
      context.commands.push({ kind: 'clear_pending_cleanses' });
    },
  });
}
