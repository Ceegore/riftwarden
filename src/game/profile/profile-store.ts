/**
 * Profile store (PROFILE_STORE_CONTRACT): browser-local persistence for the
 * Phase 31 profile. Uses a single localStorage key; every write validates
 * the profile before it hits storage. Load returns null when no profile
 * exists yet (first run) or the stored value is corrupted — callers then
 * create a fresh profile through createInitialProfile.
 */
import { validateProfile } from './profile-validator.js';
import type { Profile } from './types.js';

const PROFILE_KEY = 'rw.profile.v1';

/** Create a fresh profile: zero currencies, no unlocks, empty ledger. */
export function createInitialProfile(): Profile {
  return {
    revision: 31,
    wallet: { gold: 0, riftEssence: 0 },
    heroes: {},
    troops: {},
    items: {},
    transactionLedger: {},
  };
}

export function loadProfile(): Profile | null {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (raw === null) return null;
    const parsed = JSON.parse(raw) as unknown;
    validateProfile(parsed);
    return parsed;
  } catch {
    return null;
  }
}

/** Validate and persist the profile; throws on invalid input. */
export function saveProfile(profile: Profile): void {
  validateProfile(profile);
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

/** Load or create: never returns null in browser environments. */
export function loadOrCreateProfile(): Profile {
  return loadProfile() ?? createInitialProfile();
}

/** Add the campaign's starter hero at expedition launch without changing empty-profile fixtures. */
export function ensureStarterHero(profile: Profile): Profile {
  if (Object.values(profile.heroes).some((hero) => hero.unlocked)) return profile;
  return {
    ...profile,
    heroes: {
      ...profile.heroes,
      hero_aurel: { id: 'hero_aurel', unlocked: true, level: 1, fame: 0 },
    },
  };
}

export function clearProfile(): void {
  localStorage.removeItem(PROFILE_KEY);
}
