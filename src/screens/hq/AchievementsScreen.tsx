/**
 * Achievements screen (S28): lists all achievements with progress bars,
 * organized by category. Shows earned/total counts.
 */
import { useMemo, type JSX } from 'react';
import { Button } from '../../ui/components/Button.js';
import { GameCard } from '../../ui/components/GameCard.js';
import { StatRow } from '../../ui/components/StatRow.js';
import { ScreenFrame } from '../../ui/layout/ScreenFrame.js';
import { ScrollRegion } from '../../ui/layout/ScrollRegion.js';
import { loadAchievementState, achievementStats } from '../../game/achievements/achievement-store.js';
import { ACHIEVEMENTS } from '../../game/achievements/achievement-definitions.js';
import type { AchievementCategory } from '../../game/achievements/types.js';

const CATEGORY_LABELS: Record<AchievementCategory, string> = {
  combat: 'Combat',
  collection: 'Collection',
  mastery: 'Mastery',
  exploration: 'Exploration',
  milestone: 'Milestone',
};

export interface AchievementsScreenProps {
  readonly onBack: () => void;
}

export function AchievementsScreen({ onBack }: AchievementsScreenProps): JSX.Element {
  const state = useMemo(() => loadAchievementState(), []);
  const stats = useMemo(() => achievementStats(state), [state]);

  const categories = useMemo(() => {
    const cats = new Map<AchievementCategory, typeof ACHIEVEMENTS[number][]>();
    for (const def of ACHIEVEMENTS) {
      if (!cats.has(def.category)) cats.set(def.category, []);
      cats.get(def.category)!.push(def);
    }
    return cats;
  }, []);

  return (
    <ScreenFrame labelledBy="ach-title">
      <h1 id="ach-title">Achievements</h1>
      <StatRow
        label="Earned"
        value={`${stats.earned} / ${stats.total}`}
      />

      <ScrollRegion label="Achievement list">
        {[...categories.entries()].map(([cat, defs]) => {
          const earned = defs.filter((d) => state.achievements[d.id]?.earned).length;
          return (
            <section key={cat}>
              <h2>{CATEGORY_LABELS[cat]} ({earned}/{defs.length})</h2>
              {defs.map((def) => {
                const prog = state.achievements[def.id];
                const pct = prog ? Math.min(100, Math.round((prog.current / def.target) * 100)) : 0;
                return (
                  <GameCard
                    key={def.id}
                    title={<span>{def.titleKey}{def.tier > 1 ? ` ★${def.tier}` : ''}</span>}
                    state={prog?.earned ? 'selected' : 'default'}
                  >
                    <p>{def.descriptionKey}</p>
                    <StatRow
                      label="Progress"
                      value={`${prog?.current ?? 0} / ${def.target}`}
                      details={
                        <progress
                          value={pct}
                          max={100}
                          aria-label={`${pct}%`}
                          style={{ width: '100%', marginTop: 4 }}
                        />
                      }
                    />
                    {prog?.earnedAt ? (
                      <small>Earned {new Date(prog.earnedAt).toLocaleDateString()}</small>
                    ) : null}
                  </GameCard>
                );
              })}
            </section>
          );
        })}
      </ScrollRegion>

      <Button labelKey="ui.common.back" variant="secondary" onClick={onBack} />
    </ScreenFrame>
  );
}
