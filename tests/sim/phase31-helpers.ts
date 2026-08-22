import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ProfileError } from '../../src/game/profile/profile-error.js';
import type { Profile, TroopCopy, TroopTypeState } from '../../src/game/profile/types.js';

const here = path.dirname(fileURLToPath(import.meta.url));

/** Reads a Phase 31 contract or fixture file (JSON). */
export function readJson(name: string): unknown {
  return JSON.parse(readFileSync(path.join(here, '..', '..', 'contracts', 'phase31', name), 'utf8'));
}

/** Returns the ProfileError code of a throwing call, or null when it succeeds. */
export function catchProfileCode(fn: () => void): string | null {
  try {
    fn();
    return null;
  } catch (error) {
    return error instanceof ProfileError ? error.code : null;
  }
}

/** Minimal valid profile with no content. */
export function emptyProfile(wallet: { gold: number; riftEssence: number } = { gold: 100, riftEssence: 0 }): Profile {
  return {
    revision: 31,
    wallet,
    heroes: {},
    troops: {},
    items: {},
    transactionLedger: {},
  };
}

export function troopCopy(instanceId: string, typeId: string, kitId?: string): TroopCopy {
  return kitId !== undefined ? { instanceId, typeId, kitId } : { instanceId, typeId };
}

export function troopState(typeId: string, contractLevel: 1 | 2 | 3, copies: readonly TroopCopy[]): TroopTypeState {
  return { typeId, contractLevel, copies };
}
