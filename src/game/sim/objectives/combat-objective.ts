import { KernelInvariantError } from '../core/invariant-error.js';
import { asciiCompare } from '../core/primitives.js';
import type { KernelEvent } from '../events/event-types.js';

/**
 * Phase 21 §8 combat objectives (T05). Closed objective kinds: defeat regulars,
 * defeat the boss, destroy/protect a boss object, survive until a tick, complete
 * reinforcement waves, and heal-sustain (accumulate `required` healed HP), plus
 * composite mission conditions. Progress is derived from canonical combat
 * events — never from UI state — and objective resolution runs in stage L
 * before the generic end resolver, without ever producing an impossible state.
 */

export const OBJECTIVE_KINDS = [
  'kill_regulars',
  'kill_boss',
  'destroy_object',
  'protect_object',
  'survive_until',
  'complete_waves',
  'heal_sustain',
] as const;
export type ObjectiveKind = (typeof OBJECTIVE_KINDS)[number];

export interface Objective {
  readonly id: string;
  readonly kind: ObjectiveKind;
  /** Target boss/object id for kill_boss/destroy_object/protect_object. */
  readonly targetId: string | null;
  /** Kills to reach, tick to survive to, or waves to complete. */
  readonly required: number;
  readonly progress: number;
  readonly complete: boolean;
}

export interface CompositeCondition {
  readonly id: string;
  readonly mode: 'all' | 'any';
  readonly objectiveIds: readonly string[];
}

const ID = /^[a-z][a-z0-9_]*$/;

function assertId(value: string, field: string): void {
  if (!ID.test(value)) throw new KernelInvariantError('P21_OBJECTIVE_INVALID', { field, value });
}

function assertInt(value: number, field: string): void {
  if (!Number.isSafeInteger(value) || value < 0 || Object.is(value, -0)) {
    throw new KernelInvariantError('P21_OBJECTIVE_INVALID', { field, value });
  }
}

/** Validates an objective instance (§8). */
export function validateObjective(o: Objective): void {
  assertId(o.id, 'id');
  if (!(OBJECTIVE_KINDS as readonly string[]).includes(o.kind)) throw new KernelInvariantError('P21_OBJECTIVE_INVALID', { field: 'kind', kind: o.kind });
  if (o.targetId !== null) assertId(o.targetId, 'targetId');
  assertInt(o.required, 'required');
  assertInt(o.progress, 'progress');
  if (typeof o.complete !== 'boolean') throw new KernelInvariantError('P21_OBJECTIVE_INVALID', { field: 'complete' });
  if (o.progress > o.required) throw new KernelInvariantError('P21_OBJECTIVE_INVALID', { reason: 'progress-over-required', id: o.id });
}

/** §8 monotonic progress application: never decreases, never overshoots. */
export function applyProgress(o: Objective, delta: number): Objective {
  if (o.complete || delta <= 0) return o;
  if (!Number.isSafeInteger(delta)) {
    throw new KernelInvariantError('P21_OBJECTIVE_INVALID', { field: 'delta', delta });
  }
  const progress = Math.min(o.required, o.progress + delta);
  return Object.freeze({ ...o, progress, complete: progress >= o.required });
}

/**
 * §8 event-driven progress. Maps canonical combat events to objective progress
 * for the defeat/destroy kinds; `survive_until` is tick-driven (see
 * `evaluateSurvival`), and `complete_waves` is driven by reinforcement events.
 */
export function applyEventProgress(o: Objective, event: KernelEvent): Objective {
  if (o.complete) return o;
  switch (o.kind) {
    case 'kill_regulars':
      return event.type === 'Defeated' && event.targetIds.length === 1 ? applyProgress(o, 1) : o;
    case 'kill_boss':
      return event.type === 'Defeated' && o.targetId !== null && event.targetIds.includes(o.targetId) ? applyProgress(o, 1) : o;
    case 'destroy_object':
      return (event.type === 'Defeated' || event.type === 'Removed') && o.targetId !== null && event.targetIds.includes(o.targetId) ? applyProgress(o, 1) : o;
    case 'complete_waves':
      return event.type === 'ReinforcementSpawned' ? applyProgress(o, 1) : o;
    case 'heal_sustain':
      return event.type === 'HealApplied' ? applyProgress(o, Math.max(1, event.payload['finalHpDelta'] ?? 1)) : o;
    case 'protect_object':
    case 'survive_until':
      return o;
  }
}

/** Canonical event-record shape used by the runtime objective resolution (§8). */
export interface EventRecordLike {
  readonly type: string;
  readonly targetIds: readonly string[];
  /** HP actually restored by a `HealApplied` record (present only for heals). */
  readonly amount?: number;
}

/** §8 runtime progress from a persisted event record (previous-tick event log). */
export function applyEventRecordProgress(o: Objective, record: EventRecordLike): Objective {
  switch (o.kind) {
    case 'kill_regulars':
      return record.type === 'Defeated' && record.targetIds.length === 1 ? applyProgress(o, 1) : o;
    case 'kill_boss':
      return record.type === 'Defeated' && o.targetId !== null && record.targetIds.includes(o.targetId) ? applyProgress(o, 1) : o;
    case 'destroy_object':
      return (record.type === 'Defeated' || record.type === 'Removed') && o.targetId !== null && record.targetIds.includes(o.targetId) ? applyProgress(o, 1) : o;
    case 'complete_waves':
      return record.type === 'ReinforcementSpawned' ? applyProgress(o, 1) : o;
    case 'heal_sustain':
      return record.type === 'HealApplied' ? applyProgress(o, Math.max(1, record.amount ?? 1)) : o;
    case 'protect_object':
    case 'survive_until':
      return o;
  }
}

/** §8 survival objective: progress equals the current tick, capped at required. */
export function evaluateSurvival(o: Objective, tick: number): Objective {
  if (o.kind !== 'survive_until' || o.complete) return o;
  return applyProgress(o, Math.max(0, tick - o.progress));
}

/** §8 battle may end only when every objective is complete. */
export function objectiveAllowsBattleEnd(objectives: readonly Objective[]): boolean {
  return objectives.every((o) => o.complete);
}

/**
 * §8 impossibility guard. Reports whether a required objective can no longer
 * be satisfied given the current world, so the stage-L resolver emits
 * P21_OBJECTIVE_IMPOSSIBLE instead of soft-locking.
 */
export function isObjectiveImpossible(o: Objective, facts: { readonly defeatedTargetIds: ReadonlySet<string>; readonly activeWavesRemaining: number }): boolean {
  if (o.complete) return false;
  switch (o.kind) {
    case 'kill_boss':
    case 'destroy_object':
      return o.targetId !== null && facts.defeatedTargetIds.has(o.targetId) && o.progress < o.required;
    case 'protect_object':
      return o.targetId !== null && facts.defeatedTargetIds.has(o.targetId);
    case 'complete_waves':
      return facts.activeWavesRemaining === 0 && o.progress < o.required;
    case 'kill_regulars':
    case 'survive_until':
    case 'heal_sustain':
      return false;
  }
}

/** Evaluates a composite mission condition (§8) against the objective set. */
export function evaluateComposite(composite: CompositeCondition, objectives: readonly Objective[]): boolean {
  const byId = new Map(objectives.map((o) => [o.id, o] as const));
  for (const id of composite.objectiveIds) {
    const o = byId.get(id);
    if (o === undefined) throw new KernelInvariantError('P21_OBJECTIVE_INVALID', { reason: 'composite-unknown-objective', id });
  }
  const states = composite.objectiveIds.map((id) => byId.get(id)?.complete === true);
  return composite.mode === 'all' ? states.every(Boolean) : states.some(Boolean);
}

/** Canonical objective ordering: id code-unit compare (never localeCompare). */
export function compareObjectives(a: Objective, b: Objective): number {
  return asciiCompare(a.id, b.id);
}

/**
 * Canonical objective collection (§8 snapshot projection): validates every
 * objective, rejects duplicate ids and returns a deep-frozen, id-sorted set.
 */
export function createObjectiveCollection(objectives: readonly Objective[]): readonly Objective[] {
  const ids = new Set<string>();
  return Object.freeze([...objectives].sort(compareObjectives).map((o) => {
    validateObjective(o);
    if (ids.has(o.id)) throw new KernelInvariantError('P21_OBJECTIVE_INVALID', { reason: 'duplicate-id', id: o.id });
    ids.add(o.id);
    return Object.freeze({ ...o });
  }));
}
