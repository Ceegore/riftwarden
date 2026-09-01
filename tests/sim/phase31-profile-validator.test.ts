import { describe, expect, it } from 'vitest';
import { catchProfileCode, emptyProfile, readJson, troopCopy, troopState } from './phase31-helpers.js';
import { validateProfile } from '../../src/game/profile/profile-validator.js';
import type { HeroState, Profile } from '../../src/game/profile/types.js';

describe('phase31 profile fixtures', () => {
  const minimal = readJson('fixtures/profile-minimal.json') as Record<string, unknown>;
  const fullShape = readJson('fixtures/profile-full-shape.json') as {
    readonly revision: number;
    readonly counts: { readonly heroes: number; readonly troopTypes: number; readonly items: number; readonly banners: number };
    readonly constraints: { readonly maxCopies: number; readonly maxHeroLevel: number; readonly maxContractLevel: number; readonly activeBanners: number };
  };

  it('pins the minimal profile shape', () => {
    expect(minimal['revision']).toBe(31);
    expect(minimal['currencies']).toEqual({ gold: 0, riftEssence: 0 });
    expect(minimal['heroes']).toEqual({});
    expect(minimal['troops']).toEqual({});
    expect(minimal['items']).toEqual({});
    expect(minimal['activeBannerId']).toBeNull();
    expect(minimal['transactionLedger']).toEqual({});
  });

  it('pins the full profile release counts and constraints', () => {
    expect(fullShape.revision).toBe(31);
    expect(fullShape.counts).toEqual({ heroes: 10, troopTypes: 18, items: 42, banners: 6 });
    expect(fullShape.constraints).toEqual({ maxCopies: 3, maxHeroLevel: 3, maxContractLevel: 3, activeBanners: 1 });
  });
});

describe('phase31 profile validator', () => {
  it('accepts the empty profile', () => {
    expect(() => {
      validateProfile(emptyProfile());
    }).not.toThrow();
  });

  it('rejects a wrong revision and non-objects', () => {
    expect(catchProfileCode(() => {
      validateProfile({ ...emptyProfile(), revision: 30 });
    })).toBe('PROFILE_REVISION');
    expect(catchProfileCode(() => {
      validateProfile(null);
    })).toBe('PROFILE_REVISION');
    expect(catchProfileCode(() => {
      validateProfile(42);
    })).toBe('PROFILE_REVISION');
  });

  it('rejects negative wallet values', () => {
    const negative = { ...emptyProfile(), wallet: { gold: -1, riftEssence: 0 } } as unknown as Profile;
    expect(() => {
      validateProfile(negative);
    }).toThrow(/non-negative/);
    expect(catchProfileCode(() => {
      validateProfile(negative);
    })).toBeNull();
  });

  it('rejects hero level out of range and negative fame', () => {
    const hero = (level: number, fame: number): Profile => ({
      ...emptyProfile(),
      heroes: { hero_aurel: { id: 'hero_aurel', unlocked: true, level: level as 1 | 2 | 3, fame } },
    });
    expect(catchProfileCode(() => {
      validateProfile(hero(4, 0));
    })).toBe('HERO_LEVEL_RANGE');
    expect(catchProfileCode(() => {
      validateProfile(hero(0, 0));
    })).toBe('HERO_LEVEL_RANGE');
    expect(() => {
      validateProfile(hero(2, -5));
    }).toThrow(/non-negative/);
    expect(() => {
      validateProfile(hero(2, 10));
    }).not.toThrow();
  });

  it('rejects invalid equipment references, never repairs', () => {
    const heroWithMissingItem: Profile = {
      ...emptyProfile(),
      heroes: { hero_aurel: { id: 'hero_aurel', unlocked: true, level: 2, fame: 0, equipmentId: 'item_missing' } },
    };
    expect(catchProfileCode(() => {
      validateProfile(heroWithMissingItem);
    })).toBe('INVALID_ITEM_REFERENCE');
  });

  it('rejects contract level out of range and copy-limit violations', () => {
    const withTroops = (contractLevel: number, copiesCount: number): Profile => {
      const copies = [];
      for (let i = 0; i < copiesCount; i += 1) copies.push(troopCopy(`t_${String(i)}`, 'troop_guard'));
      return { ...emptyProfile(), troops: { troop_guard: troopState('troop_guard', contractLevel as 1 | 2 | 3, copies) } };
    };
    expect(catchProfileCode(() => {
      validateProfile(withTroops(4, 0));
    })).toBe('CONTRACT_LEVEL_RANGE');
    expect(catchProfileCode(() => {
      validateProfile(withTroops(1, 4));
    })).toBe('COPY_LIMIT');
    expect(() => {
      validateProfile(withTroops(2, 3));
    }).not.toThrow();
  });

  it('rejects duplicate instance ids across troop types', () => {
    const profile: Profile = {
      ...emptyProfile(),
      troops: {
        troop_a: troopState('troop_a', 2, [troopCopy('shared', 'troop_a')]),
        troop_b: troopState('troop_b', 2, [troopCopy('shared', 'troop_b')]),
      },
    };
    expect(catchProfileCode(() => {
      validateProfile(profile);
    })).toBe('DUPLICATE_INSTANCE_ID');
  });

  it('rejects an active banner that is missing, non-banner or unowned', () => {
    const baseItems = {
      banner_ember: { id: 'banner_ember', owned: true, polished: false, isBanner: true },
      item_sword: { id: 'item_sword', owned: true, polished: false, isBanner: false },
    };
    const withBanner = (banner: string): Profile => ({
      ...emptyProfile(),
      items: baseItems,
      activeBannerId: banner,
    });
    expect(() => {
      validateProfile(withBanner('banner_ember'));
    }).not.toThrow();
    expect(catchProfileCode(() => {
      validateProfile(withBanner('item_sword'));
    })).toBe('INVALID_ACTIVE_BANNER');
    expect(catchProfileCode(() => {
      validateProfile(withBanner('banner_missing'));
    })).toBe('INVALID_ACTIVE_BANNER');
    const unowned: Profile = {
      ...emptyProfile(),
      items: { banner_ember: { id: 'banner_ember', owned: false, polished: false, isBanner: true } },
      activeBannerId: 'banner_ember',
    };
    expect(catchProfileCode(() => {
      validateProfile(unowned);
    })).toBe('INVALID_ACTIVE_BANNER');
  });

  it('accepts a full realistic profile', () => {
    const heroes: Record<string, HeroState> = {};
    for (let i = 1; i <= 10; i += 1) {
      heroes[`hero_${String(i).padStart(2, '0')}`] = {
        id: `hero_${String(i).padStart(2, '0')}`,
        unlocked: true,
        level: (i % 3) + 1 === 0 ? 3 : ((i % 3) + 1) as 1 | 2 | 3,
        fame: i * 10,
      };
    }
    const profile: Profile = {
      ...emptyProfile({ gold: 999999, riftEssence: 999 }),
      heroes,
      items: { banner_ember: { id: 'banner_ember', owned: true, polished: false, isBanner: true } },
      activeBannerId: 'banner_ember',
    };
    expect(() => {
      validateProfile(profile);
    }).not.toThrow();
  });
});
