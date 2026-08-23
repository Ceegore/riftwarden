/**
 * Ascension ranks screen (S32): displays the player's ascension level,
 * the perks unlocked at each tier, and progress toward the next rank.
 * Ascension is the prestige/reset mechanic that grants permanent bonuses.
 */
import { useMemo, type JSX } from 'react';
import { Button } from '../../ui/components/Button.js';
import { GameCard } from '../../ui/components/GameCard.js';
import { StatRow } from '../../ui/components/StatRow.js';
import { ScreenFrame } from '../../ui/layout/ScreenFrame.js';
import { ScrollRegion } from '../../ui/layout/ScrollRegion.js';

export interface AscensionRanksScreenProps {
  readonly onBack: () => void;
}

interface AscensionRank {
  readonly level: number;
  readonly titleKey: string;
  readonly perkKeys: readonly string[];
  readonly unlocked: boolean;
  readonly requirement: string;
}

function loadRanks(): readonly AscensionRank[] {
  return [
    { level: 1, titleKey: 'ascension.rank1', perkKeys: ['ascension.perk.gold_bonus_5', 'ascension.perk.start_bonus'], unlocked: false, requirement: 'Complete Act 1' },
    { level: 2, titleKey: 'ascension.rank2', perkKeys: ['ascension.perk.item_drop_10', 'ascension.perk.map_bonus'], unlocked: false, requirement: 'Ascension 1 + 3 victories' },
    { level: 3, titleKey: 'ascension.rank3', perkKeys: ['ascension.perk.hero_slot', 'ascension.perk.relic_slot'], unlocked: false, requirement: 'Ascension 2 + 5 victories' },
    { level: 4, titleKey: 'ascension.rank4', perkKeys: ['ascension.perk.double_rewards', 'ascension.perk.boss_bonus'], unlocked: false, requirement: 'Ascension 3 + 10 victories' },
    { level: 5, titleKey: 'ascension.rank5', perkKeys: ['ascension.perk.ultimate', 'ascension.perk.all_slots'], unlocked: false, requirement: 'Ascension 4 + 20 victories' },
  ];
}

export function AscensionRanksScreen({ onBack }: AscensionRanksScreenProps): JSX.Element {
  const ranks = useMemo(() => loadRanks(), []);

  return (
    <ScreenFrame labelledBy="ascension-title">
      <h1 id="ascension-title">Ascension Ranks</h1>
      <p>Ascension resets your profile for permanent power bonuses.</p>

      <ScrollRegion label="Ascension ranks">
        {ranks.map((rank) => (
          <GameCard
            key={rank.level}
            title={`Rank ${rank.level}: ${rank.titleKey}`}
            state={rank.unlocked ? 'selected' : 'locked'}
          >
            <StatRow label="Requirement" value={rank.requirement} />
            <p>Perks:</p>
            {rank.perkKeys.map((pk) => (
              <StatRow key={pk} label={pk} value={rank.unlocked ? 'Active' : 'Locked'} />
            ))}
          </GameCard>
        ))}
      </ScrollRegion>

      <Button labelKey="ui.common.back" variant="secondary" onClick={onBack} />
    </ScreenFrame>
  );
}
