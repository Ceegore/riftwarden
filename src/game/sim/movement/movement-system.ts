import { resolveEnemyStop } from '../collision/collision-resolver.js';
import type { Body } from '../geometry/distance.js';
import { asX100, laneOrdinal, nonNegativeX100, type Lane, type X100 } from '../geometry/x100.js';
import { KernelInvariantError } from '../core/invariant-error.js';
import type { KernelEntity } from '../core/entity.js';
import type { KernelSystem, TickContext } from '../core/tick-context.js';
import { advanceLaneChange } from './lane-change.js';
import { movementStep } from './movement-step.js';

export interface MovementState {
  readonly entityId: string;
  readonly x100: X100;
  readonly radiusX100: X100;
  readonly lane: Lane;
  readonly movementRemainder: number;
  readonly speedX100PerSecond: number;
  readonly direction: 1 | -1;
}

export interface MovementResolution {
  readonly newX100: X100;
  readonly newRemainder: number;
  readonly desiredStepX100: X100;
  readonly appliedStepX100: X100;
}

/**
 * Resolves one movement tick from the prior state (§5): the desired step comes
 * from the rational remainder, then the field boundary, enemy stop distance and
 * stop gap clamp the applied step. The remainder is advanced from the desired
 * step, so blocked movement never creates or loses speed.
 */
export function resolveMovement(
  state: MovementState,
  enemies: readonly { readonly id: string; readonly x100: X100; readonly radiusX100: X100; readonly lane: Lane }[],
  stopGapX100: X100,
): MovementResolution {
  const step = movementStep(state.speedX100PerSecond, state.movementRemainder);
  const desired = step.stepX100;
  const intent = {
    entityId: state.entityId,
    fromX100: state.x100,
    radiusX100: state.radiusX100,
    lane: state.lane,
    direction: state.direction,
    desiredStepX100: desired,
  };
  let allowed: number = resolveEnemyStop(intent, enemies, stopGapX100);
  const fieldLimit = state.direction === 1 ? 10000 - state.x100 : state.x100;
  if (fieldLimit < allowed) allowed = fieldLimit;
  const applied = asX100(allowed);
  return {
    newX100: asX100(state.x100 + state.direction * applied),
    newRemainder: step.remainder,
    desiredStepX100: desired,
    appliedStepX100: applied,
  };
}

/**
 * The lane a moving entity occupies for this tick. A lane change switches the
 * logical lane when its next tick reaches progress 18 (§6.2); movement must use
 * that post-advance lane, not the prior-state lane.
 */
export function effectiveLogicalLane(entity: KernelEntity): Lane {
  if (entity.laneChange === undefined || entity.laneChange === null) return entity.lane;
  return advanceLaneChange(entity.laneChange, entity.lane).logicalLane;
}

/** §5.3.3 canonical resolution order: laneOrdinal, front-nearness, entityId. */
function compareMovementOrder(a: KernelEntity, b: KernelEntity): number {
  const lane = laneOrdinal(effectiveLogicalLane(a)) - laneOrdinal(effectiveLogicalLane(b));
  if (lane !== 0) return lane;
  const frontOf = (e: KernelEntity): number => (e.side === 'player' ? 10000 - e.x100 : e.x100);
  const front = frontOf(a) - frontOf(b);
  if (front !== 0) return front;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

interface MigratedActive {
  readonly entity: KernelEntity;
  readonly radiusX100: number;
  readonly movementRemainder: number;
}

export interface MovementSystemConfig {
  /** Authoritative speed in X100 per second, keyed by entity id. */
  readonly speedsX100PerSecond: Readonly<Record<string, number>>;
  /** Optional melee stop gap (defaults to 10 X100 per §5.3). */
  readonly stopGapX100?: X100;
}

/**
 * Stage-F movement system (§5, §10). Computes every intention from the frozen
 * prior state (two-phase contract), so no entity depends on another's already
 * resolved position. Only entities with movement content move; the remainder
 * advances every tick even when movement is fully blocked (§5.2).
 *
 * Phase 15 entities must have been migrated before this stage runs: a missing
 * radius or remainder is a snapshot-incompatibility, never a silent default.
 */
export function createMovementSystem(config: MovementSystemConfig): KernelSystem {
  const stopGap = config.stopGapX100 === undefined ? asX100(10) : nonNegativeX100(config.stopGapX100);
  return {
    id: 'phase15.f2.movement',
    stage: 'F',
    run(context: TickContext): void {
      const actives: MigratedActive[] = [];
      for (const entity of context.state.entities) {
        if (entity.phase.phase !== 'ACTIVE') continue;
        if (entity.radiusX100 === undefined || entity.movementRemainder === undefined) {
          throw new KernelInvariantError('P15_SNAPSHOT_INCOMPATIBLE', { reason: 'unmigrated-entity', entityId: entity.id });
        }
        actives.push({ entity, radiusX100: entity.radiusX100, movementRemainder: entity.movementRemainder });
      }
      const sorted = [...actives].sort((a, b) => compareMovementOrder(a.entity, b.entity));
      for (const { entity, radiusX100, movementRemainder } of sorted) {
        const speed = config.speedsX100PerSecond[entity.id];
        if (speed === undefined) continue;
        const direction: 1 | -1 = entity.side === 'player' ? 1 : -1;
        const lane = effectiveLogicalLane(entity);
        const enemies: Body[] = sorted
          .filter(({ entity: other }) => other.side !== entity.side && effectiveLogicalLane(other) === lane)
          .map(({ entity: other, radiusX100: otherRadius }) => ({
            id: other.id,
            x100: asX100(other.x100),
            radiusX100: asX100(otherRadius),
            lane,
          }));
        const resolution = resolveMovement(
          {
            entityId: entity.id,
            x100: asX100(entity.x100),
            radiusX100: asX100(radiusX100),
            lane,
            movementRemainder,
            speedX100PerSecond: speed,
            direction,
          },
          enemies,
          stopGap,
        );
        context.commands.push({ kind: 'set_position', entityId: entity.id, lane, x100: resolution.newX100 });
        context.commands.push({ kind: 'set_movement_remainder', entityId: entity.id, remainder: resolution.newRemainder });
      }
    },
  };
}
