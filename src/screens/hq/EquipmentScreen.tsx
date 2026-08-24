/**
 * Equipment screen (S37): manage hero equipment — view owned items,
 * equip to slots, unequip.
 */
import { useCallback, useMemo, useState } from 'react';
import type { JSX } from 'react';
import { Button } from '../../ui/components/Button.js';
import { GameCard } from '../../ui/components/GameCard.js';
import { StatRow } from '../../ui/components/StatRow.js';
import { ScreenFrame } from '../../ui/layout/ScreenFrame.js';
import { BottomActionBar } from '../../ui/layout/BottomActionBar.js';
import { ScrollRegion } from '../../ui/layout/ScrollRegion.js';
import { loadEquipmentState, saveEquipmentState, equipItem, unequipSlot } from '../../game/equipment/equipment-store.js';
import { EQUIPMENT_SLOTS, type EquipmentSlot } from '../../game/equipment/types.js';
import { loadOrCreateProfile } from '../../game/profile/profile-store.js';

export interface EquipmentScreenProps {
  readonly onBack: () => void;
}

function slotLabel(slot: EquipmentSlot): string {
  const labels: Record<EquipmentSlot, string> = {
    weapon: 'Weapon', offhand: 'Offhand', head: 'Head', chest: 'Chest',
    hands: 'Hands', feet: 'Feet', accessory1: 'Accessory 1', accessory2: 'Accessory 2',
  };
  return labels[slot];
}

function heroDisplayName(heroId: string): string {
  return heroId.replace(/^hero_/, '').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function EquipmentScreen({ onBack }: EquipmentScreenProps): JSX.Element {
  const [equipment, setEquipment] = useState(loadEquipmentState);
  const profile = useMemo(() => loadOrCreateProfile(), []);

  const heroIds = useMemo(
    () => Object.values(profile.heroes).filter((hero) => hero.unlocked).map((hero) => hero.id),
    [profile],
  );
  const [selectedHeroId, setSelectedHeroId] = useState(heroIds[0] ?? '');
  const [selectedSlot, setSelectedSlot] = useState<EquipmentSlot | null>(null);

  const ownedItems = useMemo(() =>
    Object.values(equipment.items).filter((item) => item.owned),
    [equipment],
  );

  const heroEquipped = equipment.equipped[selectedHeroId] ?? {};

  const handleEquip = useCallback((itemId: string, slot: EquipmentSlot) => {
    if (!selectedHeroId) return;
    const eq = loadEquipmentState();
    const next = equipItem(eq, selectedHeroId, slot, itemId);
    saveEquipmentState(next);
    setEquipment(next);
  }, [selectedHeroId]);

  const handleUnequip = useCallback((slot: EquipmentSlot) => {
    if (!selectedHeroId) return;
    const eq = loadEquipmentState();
    const next = unequipSlot(eq, selectedHeroId, slot);
    saveEquipmentState(next);
    setEquipment(next);
  }, [selectedHeroId]);

  const itemsForSlot = useMemo(() => {
    if (!selectedSlot) return ownedItems;
    return ownedItems.filter((item) => item.slot === selectedSlot);
  }, [ownedItems, selectedSlot]);

  return (
    <ScreenFrame labelledBy="equipment-title">
      <h1 id="equipment-title">Equipment</h1>

      {/* Hero selector */}
      <ScrollRegion label="Select hero">
        {heroIds.map((hid) => (
          <Button
            key={hid}
            label={heroDisplayName(hid)}
            variant={hid === selectedHeroId ? 'primary' : 'secondary'}
            onClick={() => { setSelectedHeroId(hid); }}
          />
        ))}
      </ScrollRegion>

      {selectedHeroId && (
        <section>
          <h2>Equipped</h2>
          {EQUIPMENT_SLOTS.map((slot) => {
            const itemId = heroEquipped[slot];
            const item = itemId ? equipment.items[itemId] : null;
            return (
              <GameCard key={slot} title={slotLabel(slot)} state="default"
                onSelect={() => { setSelectedSlot(slot); }}>
                {item ? (
                  <>
                    <StatRow label="Item" value={item.id} />
                    {Object.entries(item.stats).map(([stat, val]) => (
                      <StatRow key={stat} label={stat.toUpperCase()} value={String(val)} />
                    ))}
                    <Button labelKey="ui.common.unequip" variant="secondary"
                      onClick={() => { handleUnequip(slot); }} />
                  </>
                ) : (
                  <StatRow label="Empty" value="—" />
                )}
              </GameCard>
            );
          })}
        </section>
      )}

      {selectedSlot && (
        <section>
          <h2>Available for {slotLabel(selectedSlot)}</h2>
          <ScrollRegion label="Available items">
            {itemsForSlot.map((item) => (
              <GameCard key={item.id} title={item.id} state="default">
                <StatRow label="Tier" value={String(item.tier)} />
                {Object.entries(item.stats).map(([stat, val]) => (
                  <StatRow key={stat} label={stat.toUpperCase()} value={String(val)} />
                ))}
                <Button labelKey="ui.common.equip" variant="primary"
                  onClick={() => { handleEquip(item.id, selectedSlot); }} />
              </GameCard>
            ))}
          </ScrollRegion>
        </section>
      )}

      <BottomActionBar>
        <Button labelKey="ui.common.back" variant="secondary" onClick={onBack} />
      </BottomActionBar>
    </ScreenFrame>
  );
}
