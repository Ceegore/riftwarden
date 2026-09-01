import { KernelInvariantError } from '../core/invariant-error.js';
import type { KernelEventInput } from '../events/event-types.js';
import type { KernelSystem, TickContext } from '../core/tick-context.js';
import { laneOrdinal, type Lane } from '../geometry/x100.js';
import { asciiCompare } from '../core/primitives.js';
import { advanceLaneChange, startLaneChange, NORMAL_LANE_CHANGE_COOLDOWN_TICKS } from './lane-change.js';

export interface LaneChangeRequest {
  readonly entityId: string;
  readonly to: Lane;
  readonly reason: 'normal' | 'ability';
  readonly sourceId: string;
  readonly priority: number;
}

export interface LaneChangeSystemConfig {
  /** Produces this tick's start requests from the frozen tick context. */
  readonly requests?: (context: TickContext) => readonly LaneChangeRequest[];
}

const REASON_ORDINAL: Readonly<Record<LaneChangeRequest['reason'], number>> = Object.freeze({ normal: 0, ability: 1 });
const INTERRUPT_PHASES = new Set(['DEFEATED', 'REMOVED', 'CONTROLLED']);

function eventFor(type: 'LaneLogicalSwitched' | 'LaneChangeCompleted' | 'LaneChangeInterrupted', entityId: string, payload: Record<string, number>): KernelEventInput {
  return Object.freeze({ type, sourceId: entityId, targetIds: Object.freeze([]), contentIds: Object.freeze([]), payload: Object.freeze(payload), logTags: Object.freeze(['sim.phase15']) });
}

/**
 * Stage-F lane-change system (§6). Advances in-flight lane changes one tick,
 * switches the logical lane at 18 and completes at 36 (emitting exactly one
 * event each), interrupts on death/control, and accepts new start requests with
 * priority arbitration, adjacency and the 90-tick normal cooldown. Runs before
 * movement so the effective lane is authoritative for the same tick.
 */
export function createLaneChangeSystem(config: LaneChangeSystemConfig = {}): KernelSystem {
  return {
    id: 'phase15.f1.lane_change',
    stage: 'F',
    run(context: TickContext): void {
      const tick = context.state.tick;

      // 1. New start requests (§6.5): priority, reason, target lane, source id.
      const requests = config.requests ? [...config.requests(context)] : [];
      const ordered = [...requests].sort(
        (a, b) =>
          b.priority - a.priority ||
          REASON_ORDINAL[a.reason] - REASON_ORDINAL[b.reason] ||
          laneOrdinal(a.to) - laneOrdinal(b.to) ||
          asciiCompare(a.sourceId, b.sourceId),
      );
      const byEntity = new Map<string, LaneChangeRequest[]>();
      for (const request of ordered) {
        const list = byEntity.get(request.entityId) ?? [];
        list.push(request);
        byEntity.set(request.entityId, list);
      }
      for (const [entityId, list] of byEntity) {
        const entity = context.state.entities.find((e) => e.id === entityId);
        if (!entity) throw new KernelInvariantError('P15_SNAPSHOT_INCOMPATIBLE', { reason: 'lane-change-unknown-entity', entityId });
        if (entity.phase.phase !== 'ACTIVE') continue;
        const top = list[0];
        if (top === undefined) continue;
        if (list[1]?.priority === top.priority) {
          throw new KernelInvariantError('P15_LANECHANGE_AMBIGUOUS', { entityId, requests: list });
        }
        const cooldown = entity.normalLaneChangeCooldownUntilTick ?? 0;
        if (top.reason === 'normal' && tick < cooldown) {
          throw new KernelInvariantError('P15_LANECHANGE_COOLDOWN', { entityId, tick, cooldownUntilTick: cooldown });
        }
        if (entity.laneChange !== undefined && entity.laneChange !== null) {
          throw new KernelInvariantError('P15_LANECHANGE_STATE_INVALID', { entityId, reason: 'already-in-flight' });
        }
        const state = startLaneChange(entity.lane, top.to, tick, top.sourceId, top.reason);
        context.commands.push({ kind: 'set_lane_change', entityId, state });
      }

      // 2. Advance in-flight lane changes (§6.2, §6.4).
      for (const entity of context.state.entities) {
        const laneChange = entity.laneChange;
        if (laneChange === undefined || laneChange === null) continue;
        if (INTERRUPT_PHASES.has(entity.phase.phase)) {
          const reasonOrdinal = entity.phase.phase === 'CONTROLLED' ? 1 : 0;
          context.commands.push({ kind: 'set_lane_change', entityId: entity.id, state: null });
          context.commands.push({ kind: 'append_event', event: eventFor('LaneChangeInterrupted', entity.id, { reasonOrdinal }) });
          continue;
        }
        const advanced = advanceLaneChange(laneChange, entity.lane);
        if (advanced.switched) {
          context.commands.push({ kind: 'set_lane', entityId: entity.id, lane: advanced.logicalLane });
          context.commands.push({ kind: 'append_event', event: eventFor('LaneLogicalSwitched', entity.id, { fromLane: laneOrdinal(laneChange.from), toLane: laneOrdinal(laneChange.to) }) });
        }
        if (advanced.completed) {
          context.commands.push({ kind: 'set_lane', entityId: entity.id, lane: advanced.logicalLane });
          context.commands.push({ kind: 'set_lane_change', entityId: entity.id, state: null });
          context.commands.push({ kind: 'set_lane_change_cooldown', entityId: entity.id, untilTick: tick + NORMAL_LANE_CHANGE_COOLDOWN_TICKS });
          context.commands.push({ kind: 'append_event', event: eventFor('LaneChangeCompleted', entity.id, { fromLane: laneOrdinal(laneChange.from), toLane: laneOrdinal(laneChange.to) }) });
        } else {
          context.commands.push({ kind: 'set_lane_change', entityId: entity.id, state: advanced.state });
        }
      }
    },
  };
}
