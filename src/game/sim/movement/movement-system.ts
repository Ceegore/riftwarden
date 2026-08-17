import { resolveEnemyStop } from '../collision/collision-resolver.js';
import { asX100, type Lane, type X100 } from '../geometry/x100.js';
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
