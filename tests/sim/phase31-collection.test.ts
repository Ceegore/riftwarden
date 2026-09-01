import { describe, expect, it } from 'vitest';
import { readJson } from './phase31-helpers.js';
import { canonicalSort, restoreAnchor } from '../../src/game/profile/collection-state.js';
import { itemCompatibility } from '../../src/game/profile/compatibility.js';

describe('phase31 collection-state cases', () => {
  const cases = readJson('fixtures/collection-state-cases.json') as readonly {
    readonly screen: string;
    readonly sortKey: string;
    readonly filter: string;
    readonly scrollAnchor: string;
  }[];

  it('pins the two collection-state cases', () => {
    expect(cases).toHaveLength(2);
    expect(cases[0]).toEqual({ screen: 'S15', sortKey: 'canonicalId', filter: 'ALL', scrollAnchor: 'hero_aurel' });
    expect(cases[1]).toEqual({ screen: 'S22', sortKey: 'sourceOrder', filter: 'POLISHED', scrollAnchor: 'item_017' });
  });

  it('canonical sort is locale-independent and deterministic', () => {
    expect(canonicalSort(['hero_b', 'hero_a', 'hero_c'])).toEqual(['hero_a', 'hero_b', 'hero_c']);
    expect(canonicalSort([])).toEqual([]);
    // Mixed case sorts byte-wise, never locale-aware.
    expect(canonicalSort(['Hero_B', 'hero_a'])).toEqual(['Hero_B', 'hero_a']);
  });

  it('restoreAnchor returns the anchor when present, else the first id', () => {
    const ids = ['hero_aurel', 'hero_bastian', 'hero_cael'];
    expect(restoreAnchor(ids, 'hero_bastian')).toBe('hero_bastian');
    expect(restoreAnchor(ids, 'hero_missing')).toBe('hero_aurel');
    expect(restoreAnchor(ids)).toBe('hero_aurel');
    expect(restoreAnchor([], 'anything')).toBeUndefined();
    expect(restoreAnchor(['only'], 'missing')).toBe('only');
  });
});

describe('phase31 compatibility cases', () => {
  const cases = readJson('fixtures/compatibility-cases.json') as readonly {
    readonly subject: string;
    readonly item?: string;
    readonly kit?: string;
    readonly compatible: boolean;
    readonly reasonKey?: string;
  }[];

  it('pins the three compatibility cases', () => {
    expect(cases).toHaveLength(3);
    expect(cases[0]).toEqual({ subject: 'hero_aurel', item: 'item_guard_talisman', compatible: true });
    expect(cases[1]).toEqual({ subject: 'hero_aurel', item: 'banner_ember', compatible: false, reasonKey: 'ui.compatibility.banner_not_equipment' });
    expect(cases[2]).toEqual({ subject: 'troop_shieldguard#1', kit: 'kit_shield_wall', compatible: true });
  });

  it('hero equipment and troop kits are compatible, banners never equipment', () => {
    expect(itemCompatibility('hero', 'heroEquipment')).toEqual({ compatible: true });
    expect(itemCompatibility('troop', 'troopKit')).toEqual({ compatible: true });
    expect(itemCompatibility('hero', 'banner')).toEqual({ compatible: false, reasonKey: 'ui.compatibility.banner_not_equipment' });
    expect(itemCompatibility('troop', 'banner')).toEqual({ compatible: false, reasonKey: 'ui.compatibility.banner_not_equipment' });
    expect(itemCompatibility('hero', 'troopKit')).toEqual({ compatible: false, reasonKey: 'ui.compatibility.incompatible_kind' });
    expect(itemCompatibility('troop', 'heroEquipment')).toEqual({ compatible: false, reasonKey: 'ui.compatibility.incompatible_kind' });
  });

  it('every incompatible pair carries a visible reason key', () => {
    const pairs: [string, string][] = [
      ['hero', 'banner'],
      ['hero', 'troopKit'],
      ['troop', 'banner'],
      ['troop', 'heroEquipment'],
    ];
    for (const [subject, item] of pairs) {
      const result = itemCompatibility(subject as 'hero' | 'troop', item as 'heroEquipment' | 'troopKit' | 'banner');
      expect(result.compatible).toBe(false);
      expect(result.reasonKey).toBeDefined();
      expect(result.reasonKey?.startsWith('ui.compatibility.')).toBe(true);
    }
  });
});
