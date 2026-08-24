/**
 * Phase 37 equipment domain: hero equipment slots, item stat
 * definitions, and the localStorage persistence layer.
 */
export type EquipmentSlot =
  | 'weapon'
  | 'offhand'
  | 'head'
  | 'chest'
  | 'hands'
  | 'feet'
  | 'accessory1'
  | 'accessory2';

export interface EquipmentItem {
  readonly id: string;
  readonly slot: EquipmentSlot;
  readonly stats: Readonly<Partial<Record<string, number>>>;
  readonly tier: 1 | 2 | 3 | 4;
  readonly owned: boolean;
}

export interface EquipmentState {
  readonly items: Readonly<Record<string, EquipmentItem>>;
  /** heroId → slot → itemId */
  readonly equipped: Readonly<Record<string, Partial<Readonly<Record<EquipmentSlot, string>>>>>;
}

export const EQUIPMENT_SLOTS: readonly EquipmentSlot[] = [
  'weapon', 'offhand', 'head', 'chest', 'hands', 'feet', 'accessory1', 'accessory2',
] as const;
