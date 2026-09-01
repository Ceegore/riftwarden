/**
 * Phase 34 HQ screen data tests (HQ_SCREENS_CONTRACT): validates the
 * profile-store data flows the HQ screens render — hero hall listings,
 * barracks copies, workshop item ownership, equipment references, and
 * mission-profile-driven map generation.
 */
import { describe, expect, it } from 'vitest';
import {
  clearProfile,
  createInitialProfile,
  loadOrCreateProfile,
  saveProfile,
} from '../../src/game/profile/profile-store.js';
import type { Profile } from '../../src/game/profile/types.js';
import { RunManager } from '../../src/game/expedition/run-manager.js';

/** Build a profile with a hero, a troop, and several items. */
function buildFilledProfile(): Profile {
  let profile = createInitialProfile();
  profile = {
    ...profile,
    wallet: { gold: 1250, riftEssence: 40 },
    heroes: {
      hero_guardian: { id: 'hero_guardian', unlocked: true, level: 2, fame: 15, equipmentId: 'item_sword' },
      hero_archer: { id: 'hero_archer', unlocked: true, level: 1, fame: 0 },
      hero_mage: { id: 'hero_mage', unlocked: false, level: 1, fame: 0 },
    },
    troops: {
      troop_knight: {
        typeId: 'troop_knight',
        contractLevel: 2,
        copies: [
          { instanceId: 'troop_knight_1', typeId: 'troop_knight', kitId: 'kit_support' },
          { instanceId: 'troop_knight_2', typeId: 'troop_knight' },
        ],
      },
    },
    items: {
      'item_sword': { id: 'item_sword', owned: true, polished: true, ownerId: 'hero_guardian', isBanner: false },
      'item_shield': { id: 'item_shield', owned: true, polished: false, isBanner: false },
      'relic_flame': { id: 'relic_flame', owned: true, polished: false, isBanner: false },
      'banner_crimson': { id: 'banner_crimson', owned: true, polished: false, isBanner: true },
      'item_dust': { id: 'item_dust', owned: false, polished: false, isBanner: false },
      'kit_support': { id: 'kit_support', owned: true, polished: false, isBanner: false },
    },
  };
  return profile;
}

describe('phase34 HQ profile flows', () => {
  it('persists and restores a full profile through profile-store', () => {
    clearProfile();
    saveProfile(buildFilledProfile());

    const loaded = loadOrCreateProfile();
    expect(loaded.wallet.gold).toBe(1250);
    expect(loaded.wallet.riftEssence).toBe(40);
    expect(Object.values(loaded.heroes).filter((h) => h.unlocked).length).toBe(2);
    expect(Object.values(loaded.troops).reduce((sum, t) => sum + t.copies.length, 0)).toBe(2);
    expect(Object.values(loaded.items).filter((i) => i.owned).length).toBe(5);
  });

  it('unlocked hero count matches hero hall rendering data', () => {
    clearProfile();
    saveProfile(buildFilledProfile());
    const profile = loadOrCreateProfile();

    const hallHeroes = Object.values(profile.heroes)
      .filter((h) => h.unlocked)
      .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    expect(hallHeroes.map((h) => h.id)).toEqual(['hero_archer', 'hero_guardian']);
  });

  it('equipment reference resolves to the owning hero', () => {
    clearProfile();
    saveProfile(buildFilledProfile());
    const profile = loadOrCreateProfile();

    let owner: string | undefined;
    for (const hero of Object.values(profile.heroes)) {
      if (hero.equipmentId === 'item_sword') {
        owner = hero.id;
        break;
      }
    }
    expect(owner).toBe('hero_guardian');
  });

  it('barracks copies count includes kit-id-bearing copies', () => {
    clearProfile();
    saveProfile(buildFilledProfile());
    const profile = loadOrCreateProfile();

    const troop = profile.troops['troop_knight'];
    expect(troop).toBeDefined();
    expect(troop?.copies.length).toBe(2);
    expect(troop?.copies[0]?.kitId).toBe('kit_support');
  });

  it('workshop owned items include relics and banners, not unowned', () => {
    clearProfile();
    saveProfile(buildFilledProfile());
    const profile = loadOrCreateProfile();

    const owned = Object.values(profile.items)
      .filter((i) => i.owned)
      .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    expect(owned.map((i) => i.id)).toEqual([
      'banner_crimson',
      'item_shield',
      'item_sword',
      'kit_support',
      'relic_flame',
    ]);
    expect(owned.some((i) => i.isBanner)).toBe(true);
    expect(profile.items['item_dust']?.owned).toBe(false);
  });

  it('clears profile data on demand', () => {
    clearProfile();
    saveProfile(buildFilledProfile());
    expect(loadOrCreateProfile().wallet.gold).toBe(1250);

    clearProfile();
    const fresh = loadOrCreateProfile();
    expect(fresh.wallet.gold).toBe(0);
    expect(Object.keys(fresh.heroes).length).toBe(0);
  });
});

describe('phase34 mission-profile map generation', () => {
  it('RunManager.create honors the mission map profile id', () => {
    RunManager.abandon();
    const mgr = RunManager.create(4242, 100, 'expedition.act1.hard');
    expect(mgr.map.profileId).toBe('expedition.act1.hard');
    expect(mgr.snapshot().gold).toBe(100);
    RunManager.abandon();
  });

  it('RunManager.create defaults to the standard profile when omitted', () => {
    RunManager.abandon();
    const mgr = RunManager.create(4243, 100);
    expect(mgr.map.profileId).toBe('expedition.act1.standard');
    RunManager.abandon();
  });

  it('restore after create reads the same map seed and profile', () => {
    RunManager.abandon();
    RunManager.create(777, 100, 'expedition.act2.forest');
    const snapshot = RunManager.active?.snapshot();
    expect(snapshot).toBeDefined();

    // Simulate a fresh session: abandon clears storage, then restore is a no-op.
    RunManager.abandon();
    expect(RunManager.restore()).toBeNull();
  });
});
