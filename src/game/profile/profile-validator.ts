/**
 * Phase 31 profile validator (PROFILE_PROGRESSION_CONTRACT): revision pinned,
 * all values non-negative safe integers, hero level 1–3, contract level I–III,
 * at most three copies per troop type with unique instance ids, and the active
 * banner must be an owned banner item. Invalid references are rejected, never
 * silently repaired.
 */
import { assertNonNegativeInteger } from './integer.js';
import { ProfileError } from './profile-error.js';
import { PROFILE_REVISION, type Profile } from './types.js';

export const HERO_LEVEL_MIN = 1;
export const HERO_LEVEL_MAX = 3;
export const CONTRACT_LEVEL_MIN = 1;
export const CONTRACT_LEVEL_MAX = 3;
export const COPY_LIMIT_PER_TROOP_TYPE = 3;

export function validateProfile(input: unknown): asserts input is Profile {
  if (typeof input !== 'object' || input === null) {
    throw new ProfileError('PROFILE_REVISION', { revision: 'non-object' });
  }
  const profile = input as Partial<Profile>;
  if (profile.revision !== PROFILE_REVISION) {
    throw new ProfileError('PROFILE_REVISION', { revision: profile.revision, expected: PROFILE_REVISION });
  }
  if (profile.wallet === undefined || profile.heroes === undefined || profile.troops === undefined || profile.items === undefined || profile.transactionLedger === undefined) {
    throw new ProfileError('PROFILE_REVISION', { missing: 'profile-fields' });
  }
  const typed = input as Profile;
  assertNonNegativeInteger(profile.wallet.gold, 'gold');
  assertNonNegativeInteger(profile.wallet.riftEssence, 'riftEssence');

  for (const hero of Object.values(typed.heroes)) {
    if (hero.level < HERO_LEVEL_MIN || hero.level > HERO_LEVEL_MAX) {
      throw new ProfileError('HERO_LEVEL_RANGE', { id: hero.id, level: hero.level });
    }
    assertNonNegativeInteger(hero.fame, 'fame');
    if (hero.equipmentId !== undefined && profile.items[hero.equipmentId] === undefined) {
      throw new ProfileError('INVALID_ITEM_REFERENCE', { id: hero.id, ref: hero.equipmentId });
    }
  }

  const seenInstanceIds = new Set<string>();
  for (const troop of Object.values(typed.troops)) {
    if (troop.contractLevel < CONTRACT_LEVEL_MIN || troop.contractLevel > CONTRACT_LEVEL_MAX) {
      throw new ProfileError('CONTRACT_LEVEL_RANGE', { id: troop.typeId, level: troop.contractLevel });
    }
    if (troop.copies.length > COPY_LIMIT_PER_TROOP_TYPE) {
      throw new ProfileError('COPY_LIMIT', { id: troop.typeId, copies: troop.copies.length });
    }
    for (const copy of troop.copies) {
      if (seenInstanceIds.has(copy.instanceId)) {
        throw new ProfileError('DUPLICATE_INSTANCE_ID', { id: copy.instanceId });
      }
      seenInstanceIds.add(copy.instanceId);
      if (copy.kitId !== undefined && profile.items[copy.kitId] === undefined) {
        throw new ProfileError('INVALID_ITEM_REFERENCE', { id: copy.instanceId, ref: copy.kitId });
      }
    }
  }

  if (profile.activeBannerId !== undefined) {
    const banner = typed.items[profile.activeBannerId];
    if (banner === undefined || !banner.isBanner || !banner.owned) {
      throw new ProfileError('INVALID_ACTIVE_BANNER', { id: profile.activeBannerId });
    }
  }
}
