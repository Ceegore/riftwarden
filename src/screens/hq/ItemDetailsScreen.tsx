/**
 * Item detail screen (S23): read-only detail of one owned item — polish
 * state, banner flag, and equipping hero if any.
 */
import { useMemo } from 'react';
import type { JSX } from 'react';
import { Button } from '../../ui/components/Button.js';
import { StatRow } from '../../ui/components/StatRow.js';
import { ScreenFrame } from '../../ui/layout/ScreenFrame.js';
import { BottomActionBar } from '../../ui/layout/BottomActionBar.js';
import { loadOrCreateProfile } from '../../game/profile/profile-store.js';

export interface ItemDetailsScreenProps {
  readonly itemId: string;
  readonly onBack: () => void;
}

export function ItemDetailsScreen({ itemId, onBack }: ItemDetailsScreenProps): JSX.Element {
  const profile = useMemo(() => loadOrCreateProfile(), []);
  const item = profile.items[itemId];

  if (!item?.owned) {
    return (
      <ScreenFrame labelledBy="item-detail-title">
        <h1 id="item-detail-title">{itemId}</h1>
        <p>Item not owned.</p>
        <BottomActionBar>
          <Button labelKey="ui.common.back" variant="secondary" onClick={onBack} />
        </BottomActionBar>
      </ScreenFrame>
    );
  }

  // Resolve the owning hero id by scanning heroes' equipment references.
  let ownerHero: string | undefined;
  for (const hero of Object.values(profile.heroes)) {
    if (hero.equipmentId === itemId) {
      ownerHero = hero.id;
      break;
    }
  }

  return (
    <ScreenFrame labelledBy="item-detail-title">
      <h1 id="item-detail-title">{item.id}</h1>
      <StatRow label="Status" value={item.polished ? 'Polished' : 'Base'} />
      <StatRow label="Kind" value={item.isBanner ? 'Banner' : 'Item / Relic'} />
      <StatRow label="Equipped by" value={ownerHero ?? 'Nobody'} />
      <BottomActionBar>
        <Button labelKey="ui.common.back" variant="secondary" onClick={onBack} />
      </BottomActionBar>
    </ScreenFrame>
  );
}
