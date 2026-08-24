/**
 * Banner Setup screen (S39): select and inspect unlocked banners.
 */
import { useCallback, useState } from 'react';
import type { JSX } from 'react';
import { Button } from '../../ui/components/Button.js';
import { GameCard } from '../../ui/components/GameCard.js';
import { StatRow } from '../../ui/components/StatRow.js';
import { ScreenFrame } from '../../ui/layout/ScreenFrame.js';
import { BottomActionBar } from '../../ui/layout/BottomActionBar.js';
import { ScrollRegion } from '../../ui/layout/ScrollRegion.js';
import { loadBannerState, saveBannerState, setActiveBanner } from '../../game/banners/banner-store.js';
import { BANNER_DEFINITIONS } from '../../game/banners/types.js';

export interface BannerSetupScreenProps {
  readonly onBack: () => void;
}

export function BannerSetupScreen({ onBack }: BannerSetupScreenProps): JSX.Element {
  const [bannerState, setBannerState] = useState(loadBannerState);
  const [message, setMessage] = useState('');

  const handleSelect = useCallback((bannerId: string) => {
    const next = setActiveBanner(bannerState, bannerId);
    saveBannerState(next);
    setBannerState(next);
    const banner = BANNER_DEFINITIONS.find((b) => b.id === bannerId);
    setMessage(banner ? `${banner.label} equipped.` : '');
  }, [bannerState]);

  const handleClear = useCallback(() => {
    const next = setActiveBanner(bannerState, null);
    saveBannerState(next);
    setBannerState(next);
    setMessage('Banner unequipped.');
  }, [bannerState]);

  return (
    <ScreenFrame labelledBy="banner-title">
      <h1 id="banner-title">Banner Setup</h1>

      {message && <p className="rw-status-message">{message}</p>}

      {bannerState.activeBanner && (
        <section>
          <h2>Active Banner</h2>
          <StatRow label="Banner" value={bannerState.activeBanner} />
          <Button labelKey="ui.common.clear" variant="secondary" onClick={handleClear} />
        </section>
      )}

      <ScrollRegion label="Available banners">
        {BANNER_DEFINITIONS.map((banner) => {
          const unlocked = bannerState.unlocked.includes(banner.id);
          const active = bannerState.activeBanner === banner.id;
          return (
            <GameCard
              key={banner.id}
              title={banner.label}
              state={active ? 'selected' : unlocked ? 'default' : 'locked'}
            >
              <StatRow label="Tier" value={String(banner.tier)} />
              <p>{banner.description}</p>
              {banner.passives.map((p, i) => (
                <StatRow
                  key={`${banner.id}-${p.stat}-${String(i)}`}
                  label={p.stat.toUpperCase()}
                  value={`+${String(p.value)}`}
                />
              ))}
              {unlocked && !active && (
                <Button labelKey="ui.common.select" variant="primary"
                  onClick={() => { handleSelect(banner.id); }} />
              )}
              {!unlocked && (
                <StatRow label="Status" value="Locked" />
              )}
            </GameCard>
          );
        })}
      </ScrollRegion>

      <BottomActionBar>
        <Button labelKey="ui.common.back" variant="secondary" onClick={onBack} />
      </BottomActionBar>
    </ScreenFrame>
  );
}
