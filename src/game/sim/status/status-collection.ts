import { KernelInvariantError } from '../core/invariant-error.js';
import { compareStatusInstances, validateStatusInstance, type StatusInstance, type StatusKind } from './status-instance.js';

/**
 * Phase 18 T02 status collection (§5.3). Immutable by contract: a frozen,
 * canonically sorted array is the only stored form. Queries return frozen
 * copies ordered by the §11 canonical comparator — never an unsorted Map/Set
 * iteration and never array position as an authority.
 */
export type StatusCollection = readonly StatusInstance[];

function freezeSorted(instances: readonly StatusInstance[]): StatusCollection {
  return Object.freeze([...instances].sort(compareStatusInstances));
}

/**
 * Builds a collection, validating every instance and rejecting duplicate
 * `statusId` or duplicate `sequence` within the canonical scope (§5.3 — hard
 * validation error, not "last write wins").
 */
export function createStatusCollection(instances: readonly StatusInstance[]): StatusCollection {
  const seenIds = new Set<string>();
  const seenSequences = new Set<number>();
  for (const instance of instances) {
    validateStatusInstance(instance);
    if (seenIds.has(instance.statusId)) {
      throw new KernelInvariantError('P14_SNAPSHOT_INVALID', { reason: 'status-duplicate-id', statusId: instance.statusId });
    }
    if (seenSequences.has(instance.sequence)) {
      throw new KernelInvariantError('P14_SNAPSHOT_INVALID', { reason: 'status-duplicate-sequence', sequence: instance.sequence });
    }
    seenIds.add(instance.statusId);
    seenSequences.add(instance.sequence);
  }
  return freezeSorted(instances);
}

export function byStatusId(collection: StatusCollection, statusId: string): StatusInstance | undefined {
  return collection.find((instance) => instance.statusId === statusId);
}

export function byTargetId(collection: StatusCollection, targetId: string): readonly StatusInstance[] {
  return Object.freeze(collection.filter((instance) => instance.targetId === targetId));
}

export function byTargetAndKind(collection: StatusCollection, targetId: string, kind: StatusKind): readonly StatusInstance[] {
  return Object.freeze(collection.filter((instance) => instance.targetId === targetId && instance.kind === kind));
}

export function byTargetAndStackGroup(collection: StatusCollection, targetId: string, stackGroup: string): readonly StatusInstance[] {
  return Object.freeze(collection.filter((instance) => instance.targetId === targetId && instance.stackGroup === stackGroup));
}

export function byTargetAndSource(collection: StatusCollection, targetId: string, sourceId: string): readonly StatusInstance[] {
  return Object.freeze(collection.filter((instance) => instance.targetId === targetId && instance.sourceId === sourceId));
}

/** Active instances for a target at `tick` (endTick exclusive, §5.1). */
export function activeForTarget(collection: StatusCollection, targetId: string, tick: number): readonly StatusInstance[] {
  return Object.freeze(collection.filter((instance) => instance.targetId === targetId && tick < instance.endTick));
}

/** Count of instances matching `predicate` (stack counting for UI selectors). */
export function count(collection: StatusCollection, predicate: (instance: StatusInstance) => boolean): number {
  let result = 0;
  for (const instance of collection) if (predicate(instance)) result += 1;
  return result;
}
