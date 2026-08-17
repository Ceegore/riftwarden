import { KernelInvariantError } from '../core/invariant-error.js';
import type { KernelEventInput } from '../events/event-types.js';
import type { KernelEntity } from '../core/entity.js';
import type { KernelSystem, TickContext } from '../core/tick-context.js';
import { asX100, nonNegativeX100, type Lane } from '../geometry/x100.js';
import { effectiveLogicalLane, resolveMovement, type MovementSystemConfig } from '../movement/movement-system.js';
import { updateStuck, updateGlobalProgress, STUCK_TICKS, GLOBAL_NO_PROGRESS_WARNING_TICKS, type StuckState, type GlobalProgress } from './anti-stuck.js';
import { updateFrontDeadlock, FRONT_DEADLOCK_TICKS, type DeadlockCandidate, type FrontDeadlockState } from './deadlock.js';

function eventFor(type: 'StuckRepath' | 'RepathLaneUnavailable' | 'FrontDeadlockRangeBoost' | 'RiftCollapseWarning', entityId: string | null, payload: Record<string, number>): KernelEventInput {
  return Object.freeze({ type, sourceId: entityId, targetIds: Object.freeze([]), contentIds: Object.freeze([]), payload: Object.freeze(payload), logTags: Object.freeze(['sim.phase15']) });
}

interface ActiveProgress {
  readonly entity: KernelEntity;
  readonly radiusX100: number;
  readonly movementRemainder: number;
  readonly speed: number | undefined;
  readonly lane: Lane;
  readonly noProgressTicks: number;
  readonly repathTicks: readonly number[];
  readonly laneFallbackUsed: boolean;
  readonly frontDeadlockBlockedTicks: number;
  readonly deadlockBuffConsumed: boolean;
  readonly deadlockBuffedEntityId: string | null;
  progressed: boolean;
  blocked: boolean;
  readonly frontDistance: number;
}

function frontDistance(entity: KernelEntity): number {
  return entity.side === 'player' ? 10000 - entity.x100 : entity.x100;
}

/**
 * Stage-F anti-stuck system (§9). Recomputes each moving entity's tick movement
 * from the frozen prior state (same pure resolver as the movement system), then
 * advances the 30-tick stuck counter, the 3-repath lane fallback, the 60-tick
 * front-deadlock counter and the 300+300 no-progress endcap. Qualifying progress
 * resets both global counters (§9.4): a committed spawn resets them in the
 * same tick via the stage-K spawn system, while damage/heal/death/phase
 * progress signals arrive with Phase 14/16. Render/audio events never count.
 */
export function createAntiStuckSystem(config: MovementSystemConfig): KernelSystem {
  const stopGap = config.stopGapX100 === undefined ? asX100(10) : nonNegativeX100(config.stopGapX100);
  return {
    id: 'phase15.f3.anti_stuck',
    stage: 'F',
    run(context: TickContext): void {
      const tick = context.state.tick;
      const actives: ActiveProgress[] = [];

      for (const entity of context.state.entities) {
        if (entity.phase.phase !== 'ACTIVE') continue;
        const radiusX100 = entity.radiusX100;
        const movementRemainder = entity.movementRemainder;
        const noProgressTicks = entity.noProgressTicks;
        const repathTicks = entity.repathTicks;
        const laneFallbackUsed = entity.laneFallbackUsed;
        const frontDeadlockBlockedTicks = entity.frontDeadlockBlockedTicks;
        const deadlockBuffConsumed = entity.deadlockBuffConsumed;
        const deadlockBuffedEntityId = entity.deadlockBuffedEntityId;
        if (
          radiusX100 === undefined || movementRemainder === undefined ||
          noProgressTicks === undefined || repathTicks === undefined || laneFallbackUsed === undefined ||
          frontDeadlockBlockedTicks === undefined || deadlockBuffConsumed === undefined || deadlockBuffedEntityId === undefined
        ) {
          throw new KernelInvariantError('P15_SNAPSHOT_INCOMPATIBLE', { reason: 'unmigrated-entity', entityId: entity.id });
        }
        actives.push({
          entity,
          radiusX100,
          movementRemainder,
          speed: config.speedsX100PerSecond[entity.id],
          lane: effectiveLogicalLane(entity),
          noProgressTicks,
          repathTicks,
          laneFallbackUsed,
          frontDeadlockBlockedTicks,
          deadlockBuffConsumed,
          deadlockBuffedEntityId,
          progressed: false,
          blocked: false,
          frontDistance: frontDistance(entity),
        });
      }

      // Recompute movement so progress/blocked reflect the movement system's
      // output without depending on its buffered commands.
      for (const active of actives) {
        if (active.speed === undefined) continue;
        const enemies = actives
          .filter((other) => other.entity.side !== active.entity.side && other.lane === active.lane)
          .map((other) => ({ id: other.entity.id, x100: asX100(other.entity.x100), radiusX100: asX100(other.radiusX100), lane: other.lane }));
        const resolution = resolveMovement(
          {
            entityId: active.entity.id,
            x100: asX100(active.entity.x100),
            radiusX100: asX100(active.radiusX100),
            lane: active.lane,
            movementRemainder: active.movementRemainder,
            speedX100PerSecond: active.speed,
            direction: active.entity.side === 'player' ? 1 : -1,
          },
          enemies,
          stopGap,
        );
        active.progressed = resolution.appliedStepX100 > 0;
        active.blocked = resolution.desiredStepX100 > 0 && resolution.appliedStepX100 === 0;
      }

      // 1. Entity stuck + repath (§9.1–9.2).
      for (const active of actives) {
        const prior: StuckState = {
          noProgressTicks: active.noProgressTicks,
          repathTicks: active.repathTicks,
          laneFallbackUsed: active.laneFallbackUsed,
        };
        const update = updateStuck(prior, tick, active.speed !== undefined, active.progressed);
        context.commands.push({ kind: 'set_stuck_state', entityId: active.entity.id, noProgressTicks: update.state.noProgressTicks, repathTicks: update.state.repathTicks, laneFallbackUsed: update.state.laneFallbackUsed });
        if (update.emitRepath) context.commands.push({ kind: 'append_event', event: eventFor('StuckRepath', active.entity.id, { noProgressTicks: STUCK_TICKS }) });
        if (update.requestLaneFallback) context.commands.push({ kind: 'append_event', event: eventFor('RepathLaneUnavailable', active.entity.id, { noProgressTicks: STUCK_TICKS }) });
      }

      // 2. Front deadlock (§9.3): frontmost moving entity per side, both blocked.
      const fronts = ['player', 'enemy'].map((side) => {
        const sideActives = actives.filter((a) => a.entity.side === side && a.speed !== undefined);
        return [...sideActives].sort((a, b) => a.frontDistance - b.frontDistance || (a.entity.id < b.entity.id ? -1 : 1))[0] ?? null;
      });
      const bothFrontsBlocked = fronts.every((front) => front?.blocked === true);
      const qualified = actives.some((a) => a.progressed);
      for (const front of fronts) {
        if (front === null) continue;
        const prior: FrontDeadlockState = {
          blockedTicks: front.frontDeadlockBlockedTicks,
          buffedEntityId: front.deadlockBuffedEntityId,
          buffConsumed: front.deadlockBuffConsumed,
        };
        const candidates: DeadlockCandidate[] = actives
          .filter((a) => a.entity.side === front.entity.side && a.speed !== undefined)
          .map((a) => ({ entityId: a.entity.id, lane: a.entity.lane, edgeDistanceX100: a.frontDistance }));
        const update = updateFrontDeadlock(prior, bothFrontsBlocked, qualified, candidates);
        context.commands.push({ kind: 'set_deadlock_state', entityId: front.entity.id, blockedTicks: update.state.blockedTicks, buffConsumed: update.state.buffConsumed, buffedEntityId: update.state.buffedEntityId });
        const grantedNow = prior.blockedTicks < FRONT_DEADLOCK_TICKS && update.state.blockedTicks >= FRONT_DEADLOCK_TICKS;
        if (grantedNow && update.buffEntityId !== null) {
          context.commands.push({ kind: 'append_event', event: eventFor('FrontDeadlockRangeBoost', update.buffEntityId, { blockedTicks: FRONT_DEADLOCK_TICKS }) });
        }
      }

      // 3. Global no-progress endcap (§9.4).
      const priorGlobal: GlobalProgress = {
        noProgressTicks: context.state.globalNoProgressTicks ?? 0,
        collapseTicks: context.state.riftCollapseTicks ?? 0,
        warned: context.state.riftCollapseWarningEmitted ?? false,
      };
      const global = updateGlobalProgress(priorGlobal, false);
      context.commands.push({ kind: 'set_global_progress', noProgressTicks: global.state.noProgressTicks, collapseTicks: global.state.collapseTicks, warned: global.state.warned });
      if (global.warning) context.commands.push({ kind: 'append_event', event: eventFor('RiftCollapseWarning', null, { noProgressTicks: GLOBAL_NO_PROGRESS_WARNING_TICKS }) });
    },
  };
}
