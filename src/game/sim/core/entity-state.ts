import { KernelInvariantError } from './invariant-error.js';
import type { Tick } from './primitives.js';

export const ENTITY_PHASES = ['SPAWNING', 'ACTIVE', 'PREPARING', 'EXECUTING', 'RECOVERING', 'CONTROLLED', 'DEFEATED', 'REMOVED'] as const;
export type EntityPhase = (typeof ENTITY_PHASES)[number];
export type RestorableEntityPhase = 'ACTIVE' | 'PREPARING' | 'RECOVERING';
export interface EntityPhaseState {
  readonly phase: EntityPhase;
  readonly enteredTick: Tick;
  readonly controlledReturn: RestorableEntityPhase | null;
}

const ALLOWED: Readonly<Record<EntityPhase, readonly EntityPhase[]>> = Object.freeze({
  SPAWNING: ['ACTIVE', 'DEFEATED'],
  // REMOVED is a legal direct exit from ACTIVE: construct-slot replacement and
  // explicit despawns must retire an entity without fabricating a death. The
  // DEFEATED path remains death resolution (stage J); this is not a revive.
  ACTIVE: ['PREPARING', 'CONTROLLED', 'DEFEATED', 'REMOVED'],
  PREPARING: ['EXECUTING', 'ACTIVE', 'CONTROLLED', 'DEFEATED'],
  EXECUTING: ['RECOVERING', 'DEFEATED'],
  RECOVERING: ['ACTIVE', 'CONTROLLED', 'DEFEATED'],
  CONTROLLED: ['ACTIVE', 'PREPARING', 'RECOVERING', 'DEFEATED'],
  DEFEATED: ['ACTIVE', 'REMOVED'],
  REMOVED: [],
});

function restorable(phase: EntityPhase): phase is RestorableEntityPhase {
  return phase === 'ACTIVE' || phase === 'PREPARING' || phase === 'RECOVERING';
}

export function transitionEntityPhase(state: EntityPhaseState, to: EntityPhase, atTick: Tick): EntityPhaseState {
  if (!ALLOWED[state.phase].includes(to)) throw new KernelInvariantError('P14_STATE_TRANSITION_INVALID', { kind: 'entity', from: state.phase, to });
  if (state.phase === 'CONTROLLED' && to !== 'DEFEATED' && state.controlledReturn !== to) {
    throw new KernelInvariantError('P14_STATE_TRANSITION_INVALID', { kind: 'controlled-return', expected: state.controlledReturn, to });
  }
  const controlledReturn = to === 'CONTROLLED' ? (restorable(state.phase) ? state.phase : null) : null;
  if (to === 'CONTROLLED' && controlledReturn === null) throw new KernelInvariantError('P14_STATE_TRANSITION_INVALID', { kind: 'controlled-entry', from: state.phase });
  return Object.freeze({ phase: to, enteredTick: atTick, controlledReturn });
}

export interface TransitionRequest {
  readonly to: EntityPhase;
  readonly priority: number;
  readonly reason: string;
}

export function selectEntityTransition(requests: readonly TransitionRequest[]): TransitionRequest | null {
  if (requests.length === 0) return null;
  const ordered = [...requests].sort((a, b) => b.priority - a.priority || (a.to < b.to ? -1 : a.to > b.to ? 1 : 0));
  const winner = ordered[0];
  if (winner === undefined) return null;
  const conflict = ordered.find((r, i) => i > 0 && r.priority === winner.priority && r.to !== winner.to);
  if (conflict) throw new KernelInvariantError('P14_TRANSITION_CONFLICT', { winner, conflict });
  return winner;
}
