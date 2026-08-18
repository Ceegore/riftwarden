import type { KernelEventInput } from '../events/event-types.js';
import type { KernelSystem, TickContext } from '../core/tick-context.js';
import { buildCandidates } from './candidates.js';
import { queryValidCandidates } from './target-query.js';
import { chooseTarget, scoreCandidate } from './target-score.js';
import { mayReevaluate } from './target-lock.js';
import type { QueryContext, Role, TargetLock } from './types.js';

export interface TargetingConfig {
  /** Role per source entity; defaults to 'fighter' (no role modifiers). */
  readonly roles?: Readonly<Record<string, Role>>;
  /** Explicit focus-fire target per source entity. */
  readonly focusTargetId?: Readonly<Record<string, string>>;
  /** Entities that de-prioritize summoned targets. */
  readonly antiSummoner?: readonly string[];
}

function eventFor(type: 'TargetChanged', entityId: string, payload: Record<string, number>): KernelEventInput {
  return Object.freeze({ type, sourceId: entityId, targetIds: Object.freeze([]), contentIds: Object.freeze([]), payload: Object.freeze(payload), logTags: Object.freeze(['sim.phase16']) });
}

/**
 * Stage-E target selection (§P16-T01/02/03, kit). From the frozen state it
 * builds the valid enemy candidates (inclusive edge distance, lane-reachable),
 * scores them and applies the basic lock: an in-flight lane change suppresses
 * re-evaluation (a target-loss signal must not abort a started lane change),
 * the current target keeps its +18 binding and is only replaced when a better
 * candidate beats it by 20 (hysteresis), and targets are released only when
 * no valid candidate remains outside a lane change.
 */
export function createTargetingSystem(config: TargetingConfig = {}): KernelSystem {
  return {
    id: 'phase16.e1.targeting',
    stage: 'E',
    run(context: TickContext): void {
      for (const source of context.state.entities) {
        if (source.phase.phase !== 'ACTIVE') continue;
        const role = config.roles?.[source.id] ?? 'fighter';
        const candidates = buildCandidates(source, context.state.entities);
        const valid = queryValidCandidates(candidates);
        const lock: TargetLock = {
          kind: 'basic_until_hit_or_abort',
          ...(source.targetId === null ? {} : { targetId: source.targetId }),
          acquiredTick: context.state.tick,
        };
        const laneChangeActive = source.laneChange !== undefined && source.laneChange !== null;

        // §P16-T03: while a lane change is in flight the lock does not
        // re-evaluate — not even on a target-loss signal.
        if (!mayReevaluate(lock, 'state_entry', laneChangeActive)) continue;

        if (valid.length === 0) {
          if (source.targetId !== null) {
            context.commands.push({ kind: 'set_target', entityId: source.id, targetId: null });
            context.commands.push({ kind: 'append_event', event: eventFor('TargetChanged', source.id, {}) });
          }
          continue;
        }

        const query: QueryContext = {
          sourceId: source.id,
          sourceLane: source.lane,
          role,
          ...(source.targetId === null ? {} : { currentTargetId: source.targetId }),
          ...(config.focusTargetId?.[source.id] === undefined ? {} : { focusTargetId: config.focusTargetId[source.id] }),
          ...(config.antiSummoner?.includes(source.id) === true ? { antiSummoner: true } : {}),
          ownLaneHasTarget: valid.some((c) => c.lane === source.lane),
          laneChangeRequired: (c) => c.lane !== source.lane,
        };
        const breakdowns = valid.map((c) => scoreCandidate(c, query));
        const current = source.targetId === null ? undefined : breakdowns.find((b) => b.candidateId === source.targetId);
        const chosen = chooseTarget(breakdowns, current);
        const targetId = chosen?.candidateId ?? null;
        if (targetId !== source.targetId) {
          context.commands.push({ kind: 'set_target', entityId: source.id, targetId });
          context.commands.push({ kind: 'append_event', event: eventFor('TargetChanged', source.id, {}) });
        }
      }
    },
  };
}
