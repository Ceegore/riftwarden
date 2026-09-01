import type { RenderQualityTier } from './types.js';
import type { CosmeticKind } from './pool-policy.js';
import { COSMETIC_KINDS } from './pool-policy.js';

/**
 * Quality degradation under pressure (quality-pressure-matrix fixture).
 * Fixed drop order: decorative particles -> damage numbers -> trail segments
 * -> screen effects -> render resolution. Telegraphs, warnings, accessibility
 * signals and entity readability are never degraded.
 */
export const COSMETIC_DROP_ORDER: readonly CosmeticKind[] = COSMETIC_KINDS;

export interface QualityProfile {
  readonly tier: RenderQualityTier;
  readonly droppedCosmetics: readonly CosmeticKind[];
  readonly resolutionScale1000: number;
}

const HIGH: QualityProfile = { tier: 'high', droppedCosmetics: [], resolutionScale1000: 1000 };
const MEDIUM: QualityProfile = { tier: 'medium', droppedCosmetics: ['decorative_particle'], resolutionScale1000: 1000 };
const LOW: QualityProfile = { tier: 'low', droppedCosmetics: ['decorative_particle', 'damage_number'], resolutionScale1000: 750 };
const REDUCED: QualityProfile = {
  tier: 'reduced',
  droppedCosmetics: [...COSMETIC_KINDS],
  resolutionScale1000: 500,
};

export function baselineQuality(tier: RenderQualityTier): QualityProfile {
  switch (tier) {
    case 'high':
      return { ...HIGH, droppedCosmetics: [...HIGH.droppedCosmetics] };
    case 'medium':
      return { ...MEDIUM, droppedCosmetics: [...MEDIUM.droppedCosmetics] };
    case 'low':
      return { ...LOW, droppedCosmetics: [...LOW.droppedCosmetics] };
    case 'reduced':
      return { ...REDUCED, droppedCosmetics: [...REDUCED.droppedCosmetics] };
  }
}

/**
 * Applies the next degradation step. Each step drops the next cosmetic kind
 * in fixed order; once all cosmetics are dropped the render resolution is
 * reduced. Critical kinds and entity readability are never touched.
 */
export function degradeQuality(profile: QualityProfile): QualityProfile {
  const remaining = COSMETIC_DROP_ORDER.filter((kind) => !profile.droppedCosmetics.includes(kind));
  if (remaining.length > 0) {
    const next = remaining[0];
    if (next === undefined) return profile;
    return { ...profile, droppedCosmetics: [...profile.droppedCosmetics, next] };
  }
  return { ...profile, resolutionScale1000: 500 };
}

export function isFullyDegraded(profile: QualityProfile): boolean {
  return profile.droppedCosmetics.length === COSMETIC_KINDS.length && profile.resolutionScale1000 <= 500;
}
