/**
 * Rift chamber screen (S31): the player's collection of rift essence
 * with options to spend it on permanent upgrades, relic crafting, or
 * hero enhancements.
 */
import { useMemo, type JSX } from 'react';
import { Button } from '../../ui/components/Button.js';
import { GameCard } from '../../ui/components/GameCard.js';
import { ResourcePill } from '../../ui/components/ResourcePill.js';
import { StatRow } from '../../ui/components/StatRow.js';
import { ScreenFrame } from '../../ui/layout/ScreenFrame.js';
import { ScrollRegion } from '../../ui/layout/ScrollRegion.js';
import { loadOrCreateProfile } from '../../game/profile/profile-store.js';

export interface RiftChamberScreenProps {
  readonly onBack: () => void;
}

interface RiftUpgrade {
  readonly id: string;
  readonly labelKey: string;
  readonly descriptionKey: string;
  readonly costEssence: number;
  readonly purchased: boolean;
}

function loadUpgrades(): readonly RiftUpgrade[] {
  return [
    { id: 'rift_gold_boost',    labelKey: 'rift.gold_boost',    descriptionKey: '+5% gold from all sources',      costEssence: 50,   purchased: false },
    { id: 'rift_drop_rate',     labelKey: 'rift.drop_rate',     descriptionKey: '+3% item drop chance',           costEssence: 75,   purchased: false },
    { id: 'rift_hero_xp',       labelKey: 'rift.hero_xp',       descriptionKey: '+10% hero XP gain',              costEssence: 100,  purchased: false },
    { id: 'rift_start_bonus',   labelKey: 'rift.start_bonus',   descriptionKey: '+50 gold at expedition start',   costEssence: 80,   purchased: false },
    { id: 'rift_extra_slot',    labelKey: 'rift.extra_slot',    descriptionKey: '+1 relic slot',                  costEssence: 200,  purchased: false },
    { id: 'rift_ascend_boost',  labelKey: 'rift.ascend_boost',  descriptionKey: 'Ascension rank requirement -1',  costEssence: 500,  purchased: false },
  ];
}

export function RiftChamberScreen({ onBack }: RiftChamberScreenProps): JSX.Element {
  const profile = useMemo(() => loadOrCreateProfile(), []);
  const upgrades = useMemo(() => loadUpgrades(), []);
  const essence = profile.wallet.riftEssence;

  return (
    <ScreenFrame labelledBy="rift-title">
      <h1 id="rift-title">Rift Chamber</h1>

      <div className="rw-expedition-resources">
        <ResourcePill icon="◇" value={essence} nameKey="ui.resource.rift_essence" />
      </div>

      <p>Spend rift essence gained from expeditions on permanent upgrades.</p>

      <ScrollRegion label="Rift upgrades">
        {upgrades.map((upg) => (
          <GameCard
            key={upg.id}
            title={upg.labelKey}
            state={upg.purchased ? 'selected' : essence >= upg.costEssence ? 'new' : 'locked'}
          >
            <p>{upg.descriptionKey}</p>
            <StatRow
              label="Cost"
              value={`${String(upg.costEssence)} rift essence`}
            />
            {upg.purchased && <p>Purchased</p>}
          </GameCard>
        ))}
      </ScrollRegion>

      <Button labelKey="ui.common.back" variant="secondary" onClick={onBack} />
    </ScreenFrame>
  );
}
