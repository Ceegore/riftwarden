/**
 * Workshop screen (S22): read-only list of owned items and relics from
 * the persistent profile. Selecting an item opens its detail view.
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

export interface WorkshopScreenProps {
  readonly onSelect: (itemId: string) => void;
  readonly onBack: () => void;
}

export function WorkshopScreen({ onSelect, onBack }: WorkshopScreenProps): JSX.Element {
  const profile = useMemo(() => loadOrCreateProfile(), []);

  const owned = Object.values(profile.items)
    .filter((item) => item.owned)
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

  return (
    <ScreenFrame labelledBy="workshop-title">
      <h1 id="workshop-title">Workshop</h1>
      {owned.length === 0 ? (
        <p>No items owned yet. Collect loot during expeditions.</p>
      ) : (
        <ScrollRegion label="Owned items">
          {owned.map((item) => (
            <GameCard key={item.id} title={item.id} state="default" onSelect={() => { onSelect(item.id); }}>
              <StatRow label="Kind" value={item.isBanner ? 'Banner' : item.ownerId !== undefined ? 'Equipped item' : 'Item / Relic'} />
              <StatRow label="Polish" value={item.polished ? 'Polished' : 'Base'} />
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
