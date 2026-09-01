/**
 * Phase 37 equipment definitions: 8 pinned equipment items.
 */
import type { EquipmentItem } from './types.js';

export const EQUIPMENT_DEFINITIONS: readonly EquipmentItem[] = [
  { id: 'equip_rusted_sword', slot: 'weapon', stats: { atk: 3 }, tier: 1, owned: false },
  { id: 'equip_iron_blade', slot: 'weapon', stats: { atk: 6 }, tier: 2, owned: false },
  { id: 'equip_rune_sword', slot: 'weapon', stats: { atk: 10, matk: 2 }, tier: 3, owned: false },
  { id: 'equip_buckler', slot: 'offhand', stats: { def: 3 }, tier: 1, owned: false },
  { id: 'equip_tower_shield', slot: 'offhand', stats: { def: 7, hp: 10 }, tier: 2, owned: false },
  { id: 'equip_leather_helm', slot: 'head', stats: { def: 2, res: 1 }, tier: 1, owned: false },
  { id: 'equip_chainmail', slot: 'chest', stats: { def: 5, hp: 15 }, tier: 2, owned: false },
  { id: 'equip_iron_gauntlets', slot: 'hands', stats: { def: 2, atk: 1 }, tier: 1, owned: false },
];
