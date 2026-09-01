import { KernelInvariantError } from '../core/invariant-error.js';
import { asciiCompare } from '../core/primitives.js';

/**
 * Phase 20 §3.1/§4 deterministic synergy counter. A regular, deployed unit
 * contributes at most two canonical trait ids; summons, constructs, boss
 * objects and removed units contribute zero. Counts are unique regular unit
 * ids per trait. Tiers are exactly 0/2/3 — counts above three add no further
 * tier. Preview and battle-start commit call the same pure function, so their
 * hashes match by construction (§4 step 8).
 */

export const SYNERGY_IDS = [
  'kingdom',
  'wild',
  'arcane',
  'faith',
  'underworld',
  'construction',
  'mercenary',
  'summoner',
] as const;
export type SynergyId = (typeof SYNERGY_IDS)[number];

export type SynergyTier = 0 | 2 | 3;

export interface SynergyUnitInput {
  readonly id: string;
  readonly side: 'player' | 'enemy';
  readonly deployed: boolean;
  readonly regular: boolean;
  readonly traits: readonly string[];
}

export function isSynergyId(value: string): value is SynergyId {
  return (SYNERGY_IDS as readonly string[]).includes(value);
}

export function tierForCount(count: number): SynergyTier {
  return count >= 3 ? 3 : count >= 2 ? 2 : 0;
}

/**
 * Counts unique regular, deployed unit ids per trait, canonically ordered by
 * trait id (§4 steps 2–4). Unknown trait ids block content validation
 * (§4 negative rule) and duplicate trait ids on one unit count once.
 */
export function countSynergies(units: readonly SynergyUnitInput[]): Readonly<Record<string, number>> {
  const seen = new Set<string>();
  const counts: Record<string, number> = {};
  for (const unit of [...units].sort((a, b) => asciiCompare(a.id, b.id))) {
    if (seen.has(unit.id) || !unit.deployed || !unit.regular) continue;
    seen.add(unit.id);
    const traits = [...new Set(unit.traits)].sort(asciiCompare);
    if (traits.length > 2) throw new KernelInvariantError('P20_SYNERGY_INVALID', { reason: 'TraitLimitExceeded', unitId: unit.id, traitCount: traits.length });
    for (const trait of traits) {
      if (!isSynergyId(trait)) throw new KernelInvariantError('UnknownSynergyId', { unitId: unit.id, trait });
      counts[trait] = (counts[trait] ?? 0) + 1;
    }
  }
  return Object.freeze(Object.fromEntries(Object.entries(counts).sort(([a], [b]) => asciiCompare(a, b))));
}

/** §4 step 5: map raw counts to closed 0/2/3 tiers, canonically ordered. */
export function synergyTiers(units: readonly SynergyUnitInput[]): Readonly<Record<string, SynergyTier>> {
  return Object.freeze(
    Object.fromEntries(Object.entries(countSynergies(units)).map(([id, count]) => [id, tierForCount(count)])),
  );
}

/** §4 step 6: the preview object is the shared tier map (preview == runtime). */
export function buildSynergyPreview(units: readonly SynergyUnitInput[]): Readonly<Record<string, SynergyTier>> {
  return synergyTiers(units);
}

const isValidSynergyTier = (value: unknown): value is SynergyTier => value === 0 || value === 2 || value === 3;

/**
 * Canonical committed tier map (§4 step 7 snapshot form). Validates closed
 * ids/tiers against untrusted input and returns a deep-frozen map in code-unit
 * key order — so a committed tier map hashes identically regardless of
 * insertion order.
 */
export function canonicalizeSynergyTiers(tiers: Readonly<Record<string, unknown>>): Readonly<Record<string, SynergyTier>> {
  const out: Record<string, SynergyTier> = {};
  for (const [id, tier] of Object.entries(tiers).sort(([a], [b]) => asciiCompare(a, b))) {
    if (!isSynergyId(id)) throw new KernelInvariantError('UnknownSynergyId', { synergyId: id });
    if (!isValidSynergyTier(tier)) throw new KernelInvariantError('P20_SYNERGY_INVALID', { reason: 'tier-invalid', synergyId: id, tier });
    out[id] = tier;
  }
  return Object.freeze(out);
}
