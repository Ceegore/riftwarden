/**
 * Phase 31 derived stats (DERIVED_STATS_CONTRACT): derivation is pure and
 * deterministic. Order: level base -> equipment/talisman or kit -> other
 * explicitly released modifiers. Integer arithmetic only, each rounding
 * executed exactly once at its fixed stage. No UI-based values.
 */
import { assertNonNegativeInteger, mulPermilleFloor } from './integer.js';

export interface StatInput {
  readonly base: number;
  readonly levelPermille: number;
  readonly equipmentFlat: number;
  readonly otherPermille: number;
}

/** `floor(base * levelPermille / 1000) + equipmentFlat` then `floor(· * otherPermille / 1000)`. */
export function deriveStat(input: StatInput): number {
  assertNonNegativeInteger(input.base, 'base');
  assertNonNegativeInteger(input.equipmentFlat, 'equipmentFlat');
  const afterLevel = mulPermilleFloor(input.base, input.levelPermille);
  const afterEquipment = afterLevel + input.equipmentFlat;
  return mulPermilleFloor(afterEquipment, input.otherPermille);
}
