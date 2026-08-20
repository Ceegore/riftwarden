import { FormationError } from './formation-error.js';
import { DEPTHS, LANES, type Formation, type SlotId } from './types.js';

/**
 * Formation model (FORMATION_DOMAIN_CONTRACT): nine stable slot ids in
 * canonical lane-major order, code-unit-stable canonicalization and a
 * canonical serialization. Comparison and serialization never depend on
 * insertion order, locale or display strings.
 */

export function compareCodeUnits(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export const SLOT_IDS: readonly SlotId[] = LANES.reduce<SlotId[]>((slots, lane) => {
  for (const depth of DEPTHS) {
    slots.push(`${lane}:${depth}`);
  }
  return slots;
}, []);

const SLOT_SET: ReadonlySet<SlotId> = new Set(SLOT_IDS);

export function isSlotId(value: unknown): value is SlotId {
  return typeof value === 'string' && SLOT_SET.has(value as SlotId);
}

export function assertSlotId(value: unknown): asserts value is SlotId {
  if (!isSlotId(value)) {
    throw new FormationError('UNKNOWN_SLOT', { slotId: value });
  }
}

export function canonicalizeFormation(formation: Formation): Formation {
  return {
    ...formation,
    entries: [...formation.entries].sort(
      (a, b) => compareCodeUnits(a.slotId, b.slotId) || compareCodeUnits(a.unit.instanceId, b.unit.instanceId),
    ),
  };
}

export function serializeFormation(formation: Formation): string {
  return JSON.stringify(canonicalizeFormation(formation));
}

export function sameFormation(a: Formation, b: Formation): boolean {
  return serializeFormation(a) === serializeFormation(b);
}
