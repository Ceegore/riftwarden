/**
 * Equipment store: localStorage persistence for owned items and
 * hero equipment assignments.
 */
import type { EquipmentItem, EquipmentSlot, EquipmentState } from './types.js';
import { EQUIPMENT_SLOTS } from './types.js';
import { EQUIPMENT_DEFINITIONS } from './equipment-definitions.js';

const EQ_KEY = 'rw.equipment.v1';

export function loadEquipmentState(): EquipmentState {
  try {
    const raw = localStorage.getItem(EQ_KEY);
    const baseItems: Record<string, EquipmentItem> = {};
    for (const def of EQUIPMENT_DEFINITIONS) {
      baseItems[def.id] = { ...def };
    }
    if (!raw) return { items: baseItems, equipped: {} };
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const savedItems = typeof parsed['items'] === 'object' && parsed['items'] !== null
      ? parsed['items'] as Record<string, unknown>
      : {};
    for (const id of Object.keys(baseItems)) {
      const saved = savedItems[id];
      if (typeof saved === 'object' && saved !== null) {
        const s = saved as Record<string, unknown>;
        const orig = baseItems[id];
        if (s['owned'] === true && orig !== undefined) {
          baseItems[id] = { ...orig, owned: true };
        }
      }
    }
    const equipped: Record<string, Partial<Record<EquipmentSlot, string>>> = {};
    const savedEquipped = typeof parsed['equipped'] === 'object' && parsed['equipped'] !== null
      ? parsed['equipped'] as Record<string, unknown>
      : {};
    for (const [heroId, slots] of Object.entries(savedEquipped)) {
      if (typeof slots !== 'object' || slots === null) continue;
      const validSlots: Partial<Record<EquipmentSlot, string>> = {};
      for (const [slot, itemId] of Object.entries(slots)) {
        const item = typeof itemId === 'string' ? baseItems[itemId] : undefined;
        if (EQUIPMENT_SLOTS.includes(slot as EquipmentSlot) && item?.owned && item.slot === slot) {
          validSlots[slot] = itemId as string;
        }
      }
      if (Object.keys(validSlots).length > 0) equipped[heroId] = validSlots;
    }
    return { items: baseItems, equipped };
  } catch {
    const items: Record<string, EquipmentItem> = {};
    for (const def of EQUIPMENT_DEFINITIONS) items[def.id] = { ...def };
    return { items, equipped: {} };
  }
}

export function saveEquipmentState(state: EquipmentState): void {
  localStorage.setItem(EQ_KEY, JSON.stringify(state));
}

export function acquireEquipment(state: EquipmentState, itemId: string): EquipmentState {
  const existing = state.items[itemId];
  if (!existing) return state;
  return {
    ...state,
    items: { ...state.items, [itemId]: { ...existing, owned: true } },
  };
}

export function equipItem(
  state: EquipmentState,
  heroId: string,
  slot: EquipmentSlot,
  itemId: string,
): EquipmentState {
  const item = state.items[itemId];
  if (item?.slot !== slot) return state;
  if (!item.owned) return state;
  const heroEquipped: Partial<Record<EquipmentSlot, string>> = {
    ...state.equipped[heroId],
    [slot]: itemId,
  };
  return {
    ...state,
    equipped: { ...state.equipped, [heroId]: heroEquipped },
  };
}

export function unequipSlot(state: EquipmentState, heroId: string, slot: EquipmentSlot): EquipmentState {
  const current = state.equipped[heroId] ?? {};
  const remaining: Partial<Record<EquipmentSlot, string>> = {};
  for (const [key, value] of Object.entries(current)) {
    if (key !== slot && typeof value === 'string') remaining[key as EquipmentSlot] = value;
  }
  return {
    ...state,
    equipped: { ...state.equipped, [heroId]: remaining },
  };
}

export function clearEquipmentState(): void {
  localStorage.removeItem(EQ_KEY);
}
