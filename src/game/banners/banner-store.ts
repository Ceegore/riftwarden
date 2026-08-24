/**
 * Banner store: localStorage persistence for unlocked and active banner.
 */
import type { BannerState } from './types.js';
import { BANNER_DEFINITIONS } from './types.js';

const BANNER_KEY = 'rw.banners.v1';

export function loadBannerState(): BannerState {
  try {
    const raw = localStorage.getItem(BANNER_KEY);
    if (!raw) return { unlocked: [], activeBanner: null };
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const unlocked = Array.isArray(parsed['unlocked'])
      ? (parsed['unlocked'] as string[]).filter((id) => BANNER_DEFINITIONS.some((b) => b.id === id))
      : [];
    const activeCandidate = typeof parsed['activeBanner'] === 'string' ? parsed['activeBanner'] : undefined;
    const activeBanner = activeCandidate !== undefined && unlocked.includes(activeCandidate)
      ? activeCandidate
      : null;
    return { unlocked, activeBanner };
  } catch {
    return { unlocked: [], activeBanner: null };
  }
}

export function saveBannerState(state: BannerState): void {
  localStorage.setItem(BANNER_KEY, JSON.stringify(state));
}

export function unlockBanner(state: BannerState, bannerId: string): BannerState {
  if (state.unlocked.includes(bannerId)) return state;
  const def = BANNER_DEFINITIONS.find((b) => b.id === bannerId);
  if (!def) return state;
  return { ...state, unlocked: [...state.unlocked, bannerId] };
}

export function setActiveBanner(state: BannerState, bannerId: string | null): BannerState {
  if (bannerId !== null && !state.unlocked.includes(bannerId)) return state;
  return { ...state, activeBanner: bannerId };
}

export function clearBannerState(): void {
  localStorage.removeItem(BANNER_KEY);
}
