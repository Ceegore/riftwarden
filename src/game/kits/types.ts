/**
 * Phase 37 kit domain: pre-assembled hero gear sets for quick
 * assignment. A kit bundles one item per slot plus a label.
 */
import type { EquipmentSlot } from '../equipment/types.js';

export interface KitSlot {
  readonly slot: EquipmentSlot;
  readonly itemId: string;
}

export interface KitDefinition {
  readonly id: string;
  readonly label: string;
  readonly slots: readonly KitSlot[];
  readonly bonusStats: Readonly<Partial<Record<string, number>>>;
}

export interface KitState {
  readonly unlockedKits: readonly string[];
}

export const KIT_DEFINITIONS: readonly KitDefinition[] = [
  {
    id: 'kit_frontline_defender',
    label: 'Frontline Defender',
    slots: [
      { slot: 'weapon', itemId: 'equip_iron_blade' },
      { slot: 'offhand', itemId: 'equip_tower_shield' },
      { slot: 'head', itemId: 'equip_leather_helm' },
      { slot: 'chest', itemId: 'equip_chainmail' },
    ],
    bonusStats: { def: 3, hp: 5 },
  },
  {
    id: 'kit_striker',
    label: 'Striker',
    slots: [
      { slot: 'weapon', itemId: 'equip_rune_sword' },
      { slot: 'hands', itemId: 'equip_iron_gauntlets' },
    ],
    bonusStats: { atk: 5, spd: 2 },
  },
  {
    id: 'kit_skirmisher',
    label: 'Skirmisher',
    slots: [
      { slot: 'weapon', itemId: 'equip_rusted_sword' },
      { slot: 'offhand', itemId: 'equip_buckler' },
    ],
    bonusStats: { atk: 1, def: 1, spd: 3 },
  },
];
