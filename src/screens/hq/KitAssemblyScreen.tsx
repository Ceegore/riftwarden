/**
 * Kit Assembly screen (S38): browse unlocked kits, apply them
 * to heroes. Requires owned equipment items.
 */
import { useCallback, useMemo, useState } from 'react';
import type { JSX } from 'react';
import { Button } from '../../ui/components/Button.js';
import { GameCard } from '../../ui/components/GameCard.js';
import { StatRow } from '../../ui/components/StatRow.js';
import { ScreenFrame } from '../../ui/layout/ScreenFrame.js';
import { BottomActionBar } from '../../ui/layout/BottomActionBar.js';
import { ScrollRegion } from '../../ui/layout/ScrollRegion.js';
import { loadKitState, applyKit } from '../../game/kits/kit-store.js';
import { KIT_DEFINITIONS, type KitDefinition } from '../../game/kits/types.js';
import { loadOrCreateProfile } from '../../game/profile/profile-store.js';

export interface KitAssemblyScreenProps {
  readonly onBack: () => void;
}

function heroDisplayName(heroId: string): string {
  return heroId.replace(/^hero_/, '').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function KitAssemblyScreen({ onBack }: KitAssemblyScreenProps): JSX.Element {
  const kitState = useMemo(() => loadKitState(), []);
  const profile = useMemo(() => loadOrCreateProfile(), []);
  const heroIds = useMemo(
    () => Object.values(profile.heroes).filter((hero) => hero.unlocked).map((hero) => hero.id),
    [profile],
  );
  const [selectedHeroId, setSelectedHeroId] = useState(heroIds[0] ?? '');
  const [message, setMessage] = useState('');

  const unlockedKits: KitDefinition[] = useMemo(() =>
    KIT_DEFINITIONS.filter((k) => kitState.unlockedKits.includes(k.id)),
    [kitState.unlockedKits],
  );

  const handleApply = useCallback((kitId: string) => {
    if (!selectedHeroId) return;
    const ok = applyKit(selectedHeroId, kitId);
    setMessage(ok ? 'Kit applied! Equip equipment to see changes.' : 'Missing required items.');
  }, [selectedHeroId]);

  return (
    <ScreenFrame labelledBy="kits-title">
      <h1 id="kits-title">Kit Assembly</h1>

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

      {message && <p className="rw-status-message">{message}</p>}

      {unlockedKits.length === 0 && <p>No kits unlocked yet.</p>}

      <ScrollRegion label="Available kits">
        {unlockedKits.map((kit) => (
          <GameCard key={kit.id} title={kit.label} state="default">
            <p>{`${String(kit.slots.length)} items`}</p>
            {Object.entries(kit.bonusStats).map(([stat, val]) => (
              <StatRow key={stat} label={`Bonus ${stat.toUpperCase()}`} value={`+${String(val)}`} />
            ))}
            <StatRow label="Slots" value={kit.slots.map((s) => s.slot).join(', ')} />
            <Button labelKey="ui.common.apply" variant="primary"
              onClick={() => { handleApply(kit.id); }}
              disabled={!selectedHeroId} />
          </GameCard>
        ))}
      </ScrollRegion>

      <BottomActionBar>
        <Button labelKey="ui.common.back" variant="secondary" onClick={onBack} />
      </BottomActionBar>
    </ScreenFrame>
  );
}
