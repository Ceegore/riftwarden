/**
 * Phase 31 compatibility (WORKSHOP/TROOP/HERO contracts): picker targets must
 * never be dead — an incompatible subject/item pairing shows a visible reason
 * key. Kits are assigned per troop instance and are not physically consumed.
 */
export type SubjectKind = 'hero' | 'troop';

export type ItemKind = 'heroEquipment' | 'troopKit' | 'banner';

export interface Compatibility {
  readonly compatible: boolean;
  readonly reasonKey?: string;
}

/**
 * Hero equipment and troop kits are compatible with their subject; anything
 * else is incompatible with a pinned reason key.
 */
export function itemCompatibility(subjectKind: SubjectKind, itemKind: ItemKind): Compatibility {
  if (subjectKind === 'hero' && itemKind === 'heroEquipment') return { compatible: true };
  if (subjectKind === 'troop' && itemKind === 'troopKit') return { compatible: true };
  if (itemKind === 'banner') return { compatible: false, reasonKey: 'ui.compatibility.banner_not_equipment' };
  return { compatible: false, reasonKey: 'ui.compatibility.incompatible_kind' };
}
