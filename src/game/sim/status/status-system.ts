import { KernelInvariantError } from '../core/invariant-error.js';
import type { KernelCommand } from '../core/command-types.js';
import type { KernelSystem, TickContext } from '../core/tick-context.js';
import {
  PERMANENT_END_TICK,
  PERIODIC_EFFECT_KINDS,
  removalReasonOrdinal,
  statusKindOrdinal,
  type PeriodicEffectKind,
  type StatusInstance,
} from './status-instance.js';
import { advancePeriodic, isPeriodicDue } from './periodic-status-system.js';
import { createStatusCollection, type StatusCollection } from './status-collection.js';
import { statusContentIds } from './status-events.js';

/**
 * Phase 18 kernel integration system (§4 stage I, §7). Runs after the
 * Phase-17 combat application (`phase17.i1.combat_application` sorts first)
 * and owns the deterministic periodic/expiry pass:
 *
 * - a periodic fires only while `nextTick < endTick` (§7.3 anchor); `now ==
 *   endTick` never fires — expiry wins;
 * - burn/poison/regeneration LP deltas go through the Phase-17
 *   `apply_lp_delta` command — never direct HP mutation (§12) — using
 *   content-supplied coefficients keyed by `dedupKey`; absent content means
 *   the timer advances without a delta (the system invents no coefficients);
 * - instances whose target no longer exists are dropped with the
 *   `target_defeated` removal reason instead of throwing on an unknown entity;
 * - the updated collection is re-published through `set_statuses` so the
 *   snapshot/hash pipeline always sees the canonical form.
 *
 * Planning (stage B/C per §4) is intentionally folded here: the pure
 * `isPeriodicDue`/`firstPeriodicTick` helpers already make due-ness a pure
 * function of persisted state, so a separate planner would add a second
 * write-pass over the same collection without changing the outcome.
 */
export interface PeriodicEffectConfig {
  readonly effectKind: PeriodicEffectKind;
  /** Positive per-tick magnitude; the sign is derived from the effect kind. */
  readonly amountPerTick: number;
}

export interface StatusSystemConfig {
  /** §7.2 content-supplied per-tick coefficients keyed by `dedupKey`. */
  readonly periodic?: Readonly<Record<string, PeriodicEffectConfig>>;
}

const EMPTY: StatusCollection = Object.freeze([]);

function lpDeltaFor(effectKind: PeriodicEffectKind, amountPerTick: number): number {
  return effectKind === 'regeneration' ? amountPerTick : -amountPerTick;
}

export function createStatusSystem(config: StatusSystemConfig = {}): KernelSystem {
  const periodic: Readonly<Record<string, PeriodicEffectConfig>> = config.periodic ?? Object.freeze({});
  for (const [dedupKey, coefficient] of Object.entries(periodic)) {
    if (!(PERIODIC_EFFECT_KINDS as readonly string[]).includes(coefficient.effectKind)) {
      throw new KernelInvariantError('P14_SNAPSHOT_INVALID', { reason: 'status-periodic-kind-unknown', dedupKey, effectKind: coefficient.effectKind });
    }
    if (!Number.isSafeInteger(coefficient.amountPerTick) || coefficient.amountPerTick <= 0) {
      throw new KernelInvariantError('P14_SNAPSHOT_INVALID', { reason: 'status-periodic-amount-invalid', dedupKey, amountPerTick: coefficient.amountPerTick });
    }
  }
  return Object.freeze({
    id: 'phase18.i1.status',
    stage: 'I' as const,
    run(context: TickContext): void {
      const statuses: StatusCollection = context.state.statuses ?? EMPTY;
      if (statuses.length === 0) return;
      const now = context.state.tick;
      const stackCounts = new Map<string, number>();
      for (const instance of statuses) {
        const key = `${instance.targetId}:${instance.kind}`;
        stackCounts.set(key, (stackCounts.get(key) ?? 0) + 1);
      }
      const entities = context.state.entities;
      const kept: StatusInstance[] = [];
      let mutated = false;
      const remove = (instance: StatusInstance, reason: 'expired' | 'target_defeated'): void => {
        mutated = true;
        const payload = {
          stackCount: stackCounts.get(`${instance.targetId}:${instance.kind}`) ?? 1,
          endTick: instance.endTick,
          strength: instance.strength,
          kindOrdinal: statusKindOrdinal(instance.kind),
          reasonOrdinal: removalReasonOrdinal(reason),
        };
        context.commands.push({
          kind: 'append_event',
          event: {
            type: 'EffectRemoved',
            sourceId: instance.sourceId,
            targetIds: Object.freeze([instance.targetId]),
            contentIds: statusContentIds(instance),
            payload,
            logTags: Object.freeze([]),
          },
        });
      };
      for (const instance of statuses) {
        const targetExists = entities.some((entity) => entity.id === instance.targetId);
        if (!targetExists) {
          remove(instance, 'target_defeated');
          continue;
        }
        const periodicState = instance.periodic;
        if (periodicState !== undefined && isPeriodicDue(instance, now)) {
          mutated = true;
          const coefficient = periodic[periodicState.dedupKey];
          if (coefficient !== undefined) {
            context.commands.push({
              kind: 'apply_lp_delta',
              entityId: instance.targetId,
              delta: lpDeltaFor(coefficient.effectKind, coefficient.amountPerTick),
              sourceId: instance.sourceId,
            });
          }
          const payload = {
            stackCount: stackCounts.get(`${instance.targetId}:${instance.kind}`) ?? 1,
            endTick: instance.endTick,
            strength: instance.strength,
            kindOrdinal: statusKindOrdinal(instance.kind),
            tickIndex: periodicState.tickIndex,
          };
          context.commands.push({
            kind: 'append_event',
            event: {
              type: 'EffectTick',
              sourceId: instance.sourceId,
              targetIds: Object.freeze([instance.targetId]),
              contentIds: statusContentIds(instance),
              payload,
              logTags: Object.freeze([]),
            },
          });
          kept.push(advancePeriodic(instance));
          continue;
        }
        if (now >= instance.endTick && instance.endTick !== PERMANENT_END_TICK) {
          remove(instance, 'expired');
          continue;
        }
        kept.push(instance);
      }
      if (mutated) {
        const next: KernelCommand = { kind: 'set_statuses', statuses: createStatusCollection(kept) };
        context.commands.push(next);
      }
    },
  });
}
