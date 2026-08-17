import { resolveEnemyStop } from '../collision/collision-resolver.js';
import { separateAlliesTowardEnemy } from '../collision/separation.js';
import type { Body } from '../geometry/distance.js';
import { asX100, laneOrdinal, nonNegativeX100, type Lane, type X100 } from '../geometry/x100.js';
import { KernelInvariantError } from '../core/invariant-error.js';
import type { KernelEventInput } from '../events/event-types.js';
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
  /** Furthest center the entity may advance toward the enemy this tick (§8.2). */
  readonly frontLimitX100: X100;
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
  // Enemy boundary ignores the desired movement step: it is the furthest the
  // entity could advance this tick before §8.1 (enemy) or the field stops it.
  const enemyBoundaryStep = resolveEnemyStop({ ...intent, desiredStepX100: asX100(10000) }, enemies, stopGapX100);
  const fieldLimit = state.direction === 1 ? 10000 - state.x100 : state.x100;
  const frontLimit = asX100(state.x100 + state.direction * Math.min(enemyBoundaryStep, fieldLimit));
  let allowed: number = resolveEnemyStop(intent, enemies, stopGapX100);
  if (fieldLimit < allowed) allowed = fieldLimit;
  const applied = asX100(allowed);
  return {
    newX100: asX100(state.x100 + state.direction * applied),
    newRemainder: step.remainder,
    desiredStepX100: desired,
    appliedStepX100: applied,
    frontLimitX100: frontLimit,
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

interface Intention {
  readonly x100: number;
  readonly remainder: number;
  readonly lane: Lane;
  readonly direction: 1 | -1;
  readonly frontLimitX100: number;
}

function safetyCapEvent(residualOverlaps: number): KernelEventInput {
  return Object.freeze({ type: 'SafetyCapTriggered', sourceId: null, targetIds: Object.freeze([]), contentIds: Object.freeze([]), payload: Object.freeze({ capOrdinal: 0, observed: residualOverlaps }), logTags: Object.freeze(['sim.phase15']) });
}

export interface MovementSystemConfig {
  /** Authoritative speed in X100 per second, keyed by entity id. */
  readonly speedsX100PerSecond: Readonly<Record<string, number>>;
  /** Optional melee stop gap (defaults to 10 X100 per §5.3). */
  readonly stopGapX100?: X100;
}

/**
 * Stage-F movement system (§5, §8, §10). Runs the two-phase §5.3 pipeline from
 * the frozen prior state: every intention is computed first (movement with enemy
 * stop and the §8.2 enemy boundary), then per-side ally separation resolves
 * overlap within the 25-X100/entity/tick cap, then commands are emitted.
 * Separation advances the team front only into its free space — never past its
 * enemy boundary — so the §8.1 pass-through contract is preserved.
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

      // Phase 1: movement intentions from the frozen prior state.
      const intentions = new Map<string, Intention>();
      for (const { entity, radiusX100, movementRemainder } of sorted) {
        const speed = config.speedsX100PerSecond[entity.id];
        if (speed === undefined) continue;
        const direction: 1 | -1 = entity.side === 'player' ? 1 : -1;
        const lane = effectiveLogicalLane(entity);
        const enemies: Body[] = sorted
          .filter(({ entity: other }) => other.side !== entity.side && effectiveLogicalLane(other) === lane)
          .map(({ entity: other, radiusX100: otherRadius }) => ({ id: other.id, x100: asX100(other.x100), radiusX100: asX100(otherRadius), lane }));
        const resolution = resolveMovement(
          { entityId: entity.id, x100: asX100(entity.x100), radiusX100: asX100(radiusX100), lane, movementRemainder, speedX100PerSecond: speed, direction },
          enemies,
          stopGap,
        );
        intentions.set(entity.id, { x100: resolution.newX100, remainder: resolution.newRemainder, lane, direction, frontLimitX100: resolution.frontLimitX100 });
      }

      // Phase 2: per-side, enemy-bound separation (§8.2). The team-front entity
      // may advance toward the enemy only into its free space (up to its enemy
      // boundary); the rear entity absorbs the remaining overlap away from the
      // enemy, so §8.1 front order is preserved without a post-hoc clamp.
      const separated = new Map<string, number>();
      let residualOverlaps = 0;
      for (const side of ['player', 'enemy'] as const) {
        const direction: 1 | -1 = side === 'player' ? 1 : -1;
        const sideActives = sorted.filter(({ entity }) => entity.side === side && intentions.has(entity.id));
        const bodies: Body[] = sideActives.map(({ entity, radiusX100 }) => {
          const intent = intentions.get(entity.id);
          return { id: entity.id, x100: asX100(intent?.x100 ?? entity.x100), radiusX100: asX100(radiusX100), lane: intent?.lane ?? entity.lane };
        });
        const frontLimits: Record<string, number> = {};
        for (const { entity } of sideActives) {
          const intent = intentions.get(entity.id);
          if (intent !== undefined) frontLimits[entity.id] = intent.frontLimitX100;
        }
        const result = separateAlliesTowardEnemy(bodies, 8, { frontDirection: direction, frontLimitX100: Object.freeze(frontLimits) });
        residualOverlaps += result.residualOverlaps;
        for (const body of result.bodies) separated.set(body.id, body.x100);
      }

      // Phase 3: emit commands in stable order.
      for (const { entity } of sorted) {
        const intent = intentions.get(entity.id);
        if (intent === undefined) continue;
        const x100 = Math.min(10000, Math.max(0, separated.get(entity.id) ?? intent.x100));
        context.commands.push({ kind: 'set_position', entityId: entity.id, lane: intent.lane, x100: asX100(x100) });
        context.commands.push({ kind: 'set_movement_remainder', entityId: entity.id, remainder: intent.remainder });
      }
      if (residualOverlaps > 0) {
        context.commands.push({ kind: 'append_event', event: safetyCapEvent(residualOverlaps) });
      }
    },
  };
}
