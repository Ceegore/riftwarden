/**
 * Cycle preparation screen (S34): before starting an endless cycle, the
 * player selects starting bonuses, difficulty modifiers, and cycle rules.
 * Each completed cycle increases difficulty and rewards.
 */
import { useMemo, type JSX } from 'react';
import { Button } from '../../ui/components/Button.js';
import { GameCard } from '../../ui/components/GameCard.js';
import { StatRow } from '../../ui/components/StatRow.js';
import { ScreenFrame } from '../../ui/layout/ScreenFrame.js';
import { ScrollRegion } from '../../ui/layout/ScrollRegion.js';

export interface CyclePreparationScreenProps {
  readonly onBack: () => void;
  readonly onLaunch?: () => void;
}

interface CycleOption {
  readonly id: string;
  readonly labelKey: string;
  readonly descriptionKey: string;
  readonly selected: boolean;
}

function loadOptions(): readonly CycleOption[] {
  return [
    { id: 'cycle_starter_gold',  labelKey: 'cycle.starter_gold',  descriptionKey: '+100 starting gold',         selected: false },
    { id: 'cycle_hero_pick',     labelKey: 'cycle.hero_pick',     descriptionKey: 'Choose a starting hero',     selected: false },
    { id: 'cycle_map_bonus',     labelKey: 'cycle.map_bonus',     descriptionKey: '+1 node on map',             selected: false },
    { id: 'cycle_hard_mode',     labelKey: 'cycle.hard_mode',     descriptionKey: '+20% enemy stats, +30% gold', selected: false },
    { id: 'cycle_elite_plus',    labelKey: 'cycle.elite_plus',    descriptionKey: 'All enemies are elite',       selected: false },
    { id: 'cycle_no_merchant',   labelKey: 'cycle.no_merchant',   descriptionKey: 'No merchant nodes',           selected: false },
  ];
}

export function CyclePreparationScreen({ onBack, onLaunch }: CyclePreparationScreenProps): JSX.Element {
  const options = useMemo(() => loadOptions(), []);

  return (
    <ScreenFrame labelledBy="cycle-title">
      <h1 id="cycle-title">Cycle Preparation</h1>
      <p>Configure your next endless cycle. Difficulty increases with each completed cycle.</p>

      <ScrollRegion label="Cycle options">
        {options.map((opt) => (
          <GameCard
            key={opt.id}
            title={opt.labelKey}
            state={opt.selected ? 'selected' : 'default'}
          >
            <p>{opt.descriptionKey}</p>
          </GameCard>
        ))}
      </ScrollRegion>

      <StatRow label="Cycle number" value="1" />
      <StatRow label="Difficulty multiplier" value="1.0×" />

      {onLaunch ? (
        <Button labelKey="ui.common.launch" variant="primary" onClick={onLaunch} />
      ) : null}
      <Button labelKey="ui.common.back" variant="secondary" onClick={onBack} />
    </ScreenFrame>
  );
}
