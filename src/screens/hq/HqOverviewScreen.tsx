/**
 * HQ overview screen (S10): the player's headquarters hub. Shows the
 * profile summary (gold, rift essence, collection counts) and links to
 * the HQ sections: mission board, hero hall, barracks, workshop, archive,
 * mastery, and achievements.
 */
import { useMemo } from 'react';
import type { JSX } from 'react';
import { Button } from '../../ui/components/Button.js';
import { GameCard } from '../../ui/components/GameCard.js';
import { ResourcePill } from '../../ui/components/ResourcePill.js';
import { StatRow } from '../../ui/components/StatRow.js';
import { ScreenFrame } from '../../ui/layout/ScreenFrame.js';
import { ScrollRegion } from '../../ui/layout/ScrollRegion.js';
import { loadOrCreateProfile } from '../../game/profile/profile-store.js';

export type HqSection =
  | 'missions'
  | 'heroHall'
  | 'barracks'
  | 'workshop'
  | 'archive'
  | 'mastery'
  | 'achievements'
  | 'help'
  | 'riftChamber'
  | 'ascension'
  | 'constellation';

export interface HqOverviewScreenProps {
  readonly onNavigate: (section: HqSection) => void;
  readonly onBack: () => void;
}

const SECTIONS: readonly { readonly key: HqSection; readonly label: string; readonly hint: string }[] = [
  { key: 'missions',     label: 'Mission Board',    hint: 'Choose and launch expeditions' },
  { key: 'heroHall',     label: 'Hero Hall',        hint: 'View your unlocked heroes' },
  { key: 'barracks',     label: 'Barracks',         hint: 'Review your troops and copies' },
  { key: 'workshop',     label: 'Workshop',         hint: 'Review owned items and relics' },
  { key: 'riftChamber',  label: 'Rift Chamber',     hint: 'Spend rift essence on permanent upgrades' },
  { key: 'archive',      label: 'Archive',          hint: 'Codex, story fragments, records, achievements' },
  { key: 'mastery',      label: 'Mastery',          hint: 'Hero mastery progress and milestones' },
  { key: 'ascension',    label: 'Ascension Ranks',  hint: 'Prestige system and permanent bonuses' },
  { key: 'constellation',label: 'Constellation',    hint: 'Meta-progression skill tree' },
  { key: 'achievements', label: 'Achievements',     hint: 'Tracked goals and milestones' },
  { key: 'help',         label: 'Help',             hint: 'How to play reference' },
];

export function HqOverviewScreen({ onNavigate, onBack }: HqOverviewScreenProps): JSX.Element {
  const profile = useMemo(() => loadOrCreateProfile(), []);

  const heroCount = Object.keys(profile.heroes).length;
  const troopCount = Object.values(profile.troops).reduce((sum, t) => sum + t.copies.length, 0);
  const itemCount = Object.values(profile.items).filter((item) => item.owned).length;
  const bannerCount = Object.values(profile.items).filter((item) => item.owned && item.isBanner).length;

  return (
    <ScreenFrame labelledBy="hq-title">
      <h1 id="hq-title">Headquarters</h1>

      <div className="rw-expedition-resources">
        <ResourcePill icon="◆" value={profile.wallet.gold} nameKey="ui.resource.gold" />
        <ResourcePill icon="◇" value={profile.wallet.riftEssence} nameKey="ui.resource.rift_essence" />
      </div>

      <section>
        <h2>Account</h2>
        <StatRow label="Heroes unlocked" value={String(heroCount)} />
        <StatRow label="Troop copies" value={String(troopCount)} />
        <StatRow label="Items owned" value={String(itemCount)} />
        <StatRow label="Banners equipped" value={String(bannerCount)} />
      </section>

      <ScrollRegion label="HQ sections">
        {SECTIONS.map((section) => (
          <GameCard
            key={section.key}
            title={section.label}
            state="default"
            onSelect={() => onNavigate(section.key)}
          >
            <p>{section.hint}</p>
          </GameCard>
        ))}
      </ScrollRegion>

      <Button labelKey="ui.common.back" variant="secondary" onClick={onBack} />
    </ScreenFrame>
  );
}
