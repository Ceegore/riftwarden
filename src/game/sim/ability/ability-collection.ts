import { KernelInvariantError } from '../core/invariant-error.js';
import { asciiCompare } from '../core/primitives.js';
import { validateAbilityInstance, type AbilityInstance } from './ability-system.js';

/**
 * Phase 19 ability-instance collection (§11). A frozen, canonically sorted
 * array is the only stored form; queries/snapshots never use an unsorted
 * Map/Set iteration or array position as authority. Canonical order is
 * (ownerId, abilityInstanceId) with code-unit compares.
 */

export type AbilityCollection = readonly AbilityInstance[];

export function compareAbilityInstances(a: AbilityInstance, b: AbilityInstance): number {
  return asciiCompare(a.ownerId, b.ownerId) || asciiCompare(a.abilityInstanceId, b.abilityInstanceId);
}

/**
 * Builds a collection, validating every instance and rejecting duplicate
 * `abilityInstanceId` (hard validation error, not "last write wins").
 */
export function createAbilityCollection(instances: readonly AbilityInstance[]): AbilityCollection {
  const seen = new Set<string>();
  for (const instance of instances) {
    validateAbilityInstance(instance);
    if (seen.has(instance.abilityInstanceId)) {
      throw new KernelInvariantError('P14_SNAPSHOT_INVALID', { reason: 'ability-duplicate-instance', abilityInstanceId: instance.abilityInstanceId });
    }
    seen.add(instance.abilityInstanceId);
  }
  return Object.freeze([...instances].sort(compareAbilityInstances));
}

export function byAbilityInstanceId(collection: AbilityCollection, abilityInstanceId: string): AbilityInstance | undefined {
  return collection.find((instance) => instance.abilityInstanceId === abilityInstanceId);
}
