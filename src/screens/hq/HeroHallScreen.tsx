/**
 * Hero Hall screen (S15): read-only list of unlocked heroes from the
 * persistent profile. Selecting a hero opens its detail view.
 */
import { useMemo } from 'react';
import type { JSX } from 'react';
import { Button } from '../../ui/components/Button.js';
import { GameCard } from '../../ui/components/GameCard.js';
import { StatRow } from '../../ui/components/StatRow.js';
import { ScreenFrame } from '../../ui/layout/ScreenFrame.js';
import { ScrollRegion } from '../../ui/layout/ScrollRegion.js';
import { BottomActionBar } from '../../ui/layout/BottomActionBar.js';
import { loadOrCreateProfile } from '../../game/profile/profile-store.js';

export interface HeroHallScreenProps {
  readonly onSelect: (heroId: string) => void;
  readonly onBack: () => void;
}

export function HeroHallScreen({ onSelect, onBack }: HeroHallScreenProps): JSX.Element {
  const profile = useMemo(() => loadOrCreateProfile(), []);

  const heroes = Object.values(profile.heroes).filter((h) => h.unlocked);
  const sorted = [...heroes].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  return (
    <ScreenFrame labelledBy="hero-hall-title">
      <h1 id="hero-hall-title">Hero Hall</h1>
      {sorted.length === 0 ? (
        <p>No heroes unlocked yet. Complete expeditions to recruit heroes.</p>
      ) : (
        <ScrollRegion label="Heroes">
          {sorted.map((hero) => (
            <GameCard key={hero.id} title={hero.id} state="default" onSelect={() => onSelect(hero.id)}>
              <StatRow label="Level" value={String(hero.level)} />
              <StatRow label="Fame" value={String(hero.fame)} />
            </GameCard>
          ))}
        </ScrollRegion>
      )}
      <BottomActionBar>
        <Button labelKey="ui.common.back" variant="secondary" onClick={onBack} />
      </BottomActionBar>
    </ScreenFrame>
  );
}
