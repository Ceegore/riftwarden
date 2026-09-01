/**
 * Barracks screen (S19): read-only list of troop types and their copies
 * from the persistent profile. Selecting a troop type opens its detail.
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

export interface BarracksScreenProps {
  readonly onSelect: (troopTypeId: string) => void;
  readonly onBack: () => void;
}

export function BarracksScreen({ onSelect, onBack }: BarracksScreenProps): JSX.Element {
  const profile = useMemo(() => loadOrCreateProfile(), []);

  const troopTypes = Object.values(profile.troops).sort((a, b) => (a.typeId < b.typeId ? -1 : a.typeId > b.typeId ? 1 : 0));

  return (
    <ScreenFrame labelledBy="barracks-title">
      <h1 id="barracks-title">Barracks</h1>
      {troopTypes.length === 0 ? (
        <p>No troops yet. Recruit troops during expeditions.</p>
      ) : (
        <ScrollRegion label="Troop types">
          {troopTypes.map((troop) => (
            <GameCard
              key={troop.typeId}
              title={troop.typeId}
              state="default"
              onSelect={() => { onSelect(troop.typeId); }}
            >
              <StatRow label="Contract level" value={String(troop.contractLevel)} />
              <StatRow label="Copies" value={String(troop.copies.length)} />
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
