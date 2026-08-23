/**
 * Hero detail screen (S16): read-only detail view of one unlocked hero —
 * level, fame, and equipped item reference. Back returns to the hall.
 */
import { useMemo } from 'react';
import type { JSX } from 'react';
import { Button } from '../../ui/components/Button.js';
import { ResourcePill } from '../../ui/components/ResourcePill.js';
import { StatRow } from '../../ui/components/StatRow.js';
import { ScreenFrame } from '../../ui/layout/ScreenFrame.js';
import { BottomActionBar } from '../../ui/layout/BottomActionBar.js';
import { loadOrCreateProfile } from '../../game/profile/profile-store.js';

export interface HeroDetailsScreenProps {
  readonly heroId: string;
  readonly onBack: () => void;
}

export function HeroDetailsScreen({ heroId, onBack }: HeroDetailsScreenProps): JSX.Element {
  const profile = useMemo(() => loadOrCreateProfile(), []);
  const hero = profile.heroes[heroId];

  if (!hero || !hero.unlocked) {
    return (
      <ScreenFrame labelledBy="hero-detail-title">
        <h1 id="hero-detail-title">{heroId}</h1>
        <p>Hero not unlocked.</p>
        <BottomActionBar>
          <Button labelKey="ui.common.back" variant="secondary" onClick={onBack} />
        </BottomActionBar>
      </ScreenFrame>
    );
  }

  const equippedItem = hero.equipmentId !== undefined ? profile.items[hero.equipmentId] : undefined;

  return (
    <ScreenFrame labelledBy="hero-detail-title">
      <h1 id="hero-detail-title">{heroId}</h1>
      <div className="rw-expedition-resources">
        <ResourcePill icon="★" value={hero.level} nameKey="ui.hero.level" />
        <ResourcePill icon="✧" value={hero.fame} nameKey="ui.hero.fame" />
      </div>
      <StatRow label="Status" value={hero.unlocked ? 'Unlocked' : 'Locked'} />
      <StatRow label="Equipment" value={hero.equipmentId ?? 'None'} />
      {equippedItem !== undefined && (
        <StatRow label="Equipment polished" value={equippedItem.polished ? 'Yes' : 'No'} />
      )}
      <BottomActionBar>
        <Button labelKey="ui.common.back" variant="secondary" onClick={onBack} />
      </BottomActionBar>
    </ScreenFrame>
  );
}
