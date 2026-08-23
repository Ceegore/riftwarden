/**
 * Troop detail screen (S20): read-only detail of one troop type — contract
 * level and its instance copies with kit assignments.
 */
import { useMemo } from 'react';
import type { JSX } from 'react';
import { Button } from '../../ui/components/Button.js';
import { StatRow } from '../../ui/components/StatRow.js';
import { ScreenFrame } from '../../ui/layout/ScreenFrame.js';
import { ScrollRegion } from '../../ui/layout/ScrollRegion.js';
import { BottomActionBar } from '../../ui/layout/BottomActionBar.js';
import { loadOrCreateProfile } from '../../game/profile/profile-store.js';

export interface TroopDetailsScreenProps {
  readonly troopTypeId: string;
  readonly onBack: () => void;
}

export function TroopDetailsScreen({ troopTypeId, onBack }: TroopDetailsScreenProps): JSX.Element {
  const profile = useMemo(() => loadOrCreateProfile(), []);
  const troop = profile.troops[troopTypeId];

  if (!troop) {
    return (
      <ScreenFrame labelledBy="troop-detail-title">
        <h1 id="troop-detail-title">{troopTypeId}</h1>
        <p>Troop type not owned.</p>
        <BottomActionBar>
          <Button labelKey="ui.common.back" variant="secondary" onClick={onBack} />
        </BottomActionBar>
      </ScreenFrame>
    );
  }

  return (
    <ScreenFrame labelledBy="troop-detail-title">
      <h1 id="troop-detail-title">{troop.typeId}</h1>
      <StatRow label="Contract level" value={String(troop.contractLevel)} />
      <StatRow label="Copies" value={String(troop.copies.length)} />

      {troop.copies.length > 0 ? (
        <ScrollRegion label="Copies">
          {troop.copies.map((copy) => (
            <div key={copy.instanceId} className="rw-node-action">
              <StatRow label="Instance" value={copy.instanceId} />
              <StatRow label="Kit" value={copy.kitId ?? 'None'} />
            </div>
          ))}
        </ScrollRegion>
      ) : (
        <p>No copies owned.</p>
      )}

      <BottomActionBar>
        <Button labelKey="ui.common.back" variant="secondary" onClick={onBack} />
      </BottomActionBar>
    </ScreenFrame>
  );
}
