/**
 * Kit store: localStorage persistence for unlocked kits.
 */
import { loadEquipmentState, saveEquipmentState, equipItem } from '../equipment/equipment-store.js';
import type { KitState } from './types.js';
import { KIT_DEFINITIONS } from './types.js';

const KIT_KEY = 'rw.kits.v1';

export function loadKitState(): KitState {
  try {
    const raw = localStorage.getItem(KIT_KEY);
    if (!raw) return { unlockedKits: [] };
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return {
      unlockedKits: Array.isArray(parsed['unlockedKits'])
        ? (parsed['unlockedKits'] as string[]).filter((id) => KIT_DEFINITIONS.some((k) => k.id === id))
        : [],
    };
  } catch {
    return { unlockedKits: [] };
  }
}

export function saveKitState(state: KitState): void {
  localStorage.setItem(KIT_KEY, JSON.stringify(state));
}

/** Unlock a kit by id. */
export function unlockKit(state: KitState, kitId: string): KitState {
  if (state.unlockedKits.includes(kitId)) return state;
  const def = KIT_DEFINITIONS.find((k) => k.id === kitId);
  if (!def) return state;
  return { unlockedKits: [...state.unlockedKits, kitId] };
}

/** Apply a kit to a hero: equips all the kit's items to the hero. */
export function applyKit(heroId: string, kitId: string): boolean {
  const def = KIT_DEFINITIONS.find((k) => k.id === kitId);
  if (!def || !loadKitState().unlockedKits.includes(kitId)) return false;
  let equip = loadEquipmentState();
  for (const slot of def.slots) {
    if (!equip.items[slot.itemId]?.owned) return false;
    equip = equipItem(equip, heroId, slot.slot, slot.itemId);
  }
  saveEquipmentState(equip);
  return true;
}

export function clearKitState(): void {
  localStorage.removeItem(KIT_KEY);
}
