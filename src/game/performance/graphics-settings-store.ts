/**
 * Phase 41: persistent graphics quality store (GRAPHICS_QUALITY_PERSISTENCE).
 *
 * Shared between GraphicsSettingsScreen and BattleCanvas. When the player
 * picks a quality tier in settings it becomes the initial tier for every
 * battle canvas; auto-quality can still degrade/upgrade from there at
 * runtime. Survives page reload.
 */
import type { QualityTier } from './auto-quality.js';

const STORE_KEY = 'rw.graphics-quality.v1';

const VALID_TIERS: ReadonlySet<string> = new Set(['high', 'medium', 'low']);

export function loadQualityPreference(): QualityTier {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw !== null && VALID_TIERS.has(raw)) return raw as QualityTier;
  } catch { /* noop */ }
  return 'high';
}

export function saveQualityPreference(tier: QualityTier): void {
  try { localStorage.setItem(STORE_KEY, tier); } catch { /* storage may be unavailable */ }
}