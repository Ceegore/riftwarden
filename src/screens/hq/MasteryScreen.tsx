/**
 * Mastery screen (S18): displays hero mastery progress — kills and
 * expeditions per hero, with mastery tiers.
 */
import { useMemo, type JSX } from 'react';
import { Button } from '../../ui/components/Button.js';
import { GameCard } from '../../ui/components/GameCard.js';
import { StatRow } from '../../ui/components/StatRow.js';
import { ScreenFrame } from '../../ui/layout/ScreenFrame.js';
import { ScrollRegion } from '../../ui/layout/ScrollRegion.js';
import { loadOrCreateProfile } from '../../game/profile/profile-store.js';
import { loadMasteryState } from '../../game/mastery/mastery-store.js';
import { MASTERY_MILESTONES, masteryTier } from '../../game/mastery/types.js';

export interface MasteryScreenProps {
  readonly onBack: () => void;
}

export function MasteryScreen({ onBack }: MasteryScreenProps): JSX.Element {
  const profile = useMemo(() => loadOrCreateProfile(), []);
  const mastery = useMemo(() => loadMasteryState(), []);

  const heroes = useMemo(() => {
    return Object.values(profile.heroes)
      .filter((h) => h.unlocked)
      .map((h) => ({
        hero: h,
        mastery: mastery.heroes[h.id] ?? { heroId: h.id, kills: 0, expeditions: 0 },
        tier: masteryTier(mastery.heroes[h.id] ?? { heroId: h.id, kills: 0, expeditions: 0 }),
      }));
  }, [profile, mastery]);

  return (
    <ScreenFrame labelledBy="mastery-title">
      <h1 id="mastery-title">Mastery</h1>
      <p>Hero mastery grows with kills and completed expeditions.</p>

      <ScrollRegion label="Hero mastery list">
        {heroes.length === 0 ? (
          <p>No heroes unlocked. Complete expeditions to recruit heroes.</p>
        ) : (
          heroes.map(({ hero, mastery: m, tier }) => {
            const nextMilestone: number | undefined = tier < 4 ? (MASTERY_MILESTONES as readonly number[])[tier] : undefined;
            return (
              <GameCard
                key={hero.id}
                title={<span>{hero.id}{tier > 0 ? ` ★${tier}` : ''}</span>}
                state="default"
              >
                <StatRow label="Kills" value={String(m.kills)} />
                <StatRow label="Expeditions" value={String(m.expeditions)} />
                <StatRow label="Mastery Tier" value={`Tier ${tier}`} />
                {nextMilestone !== undefined ? (
                  <StatRow label="Next milestone" value={`${m.kills} / ${nextMilestone} kills`} />
                ) : (
                  <StatRow label="Next milestone" value="Max tier reached" />
                )}
              </GameCard>
            );
          })
        )}
      </ScrollRegion>

      <Button labelKey="ui.common.back" variant="secondary" onClick={onBack} />
    </ScreenFrame>
  );
}
