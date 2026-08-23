/**
 * Endless setup screen (S35): configuration for endless mode runs.
 * Select starting team, map profile, difficulty tier, and active
 * modifiers before launching an endless expedition.
 */
import { useMemo, type JSX } from 'react';
import { Button } from '../../ui/components/Button.js';
import { GameCard } from '../../ui/components/GameCard.js';
import { StatRow } from '../../ui/components/StatRow.js';
import { ScreenFrame } from '../../ui/layout/ScreenFrame.js';
import { ScrollRegion } from '../../ui/layout/ScrollRegion.js';

export interface EndlessSetupScreenProps {
  readonly onBack: () => void;
  readonly onLaunch?: () => void;
}

interface EndlessOption {
  readonly id: string;
  readonly labelKey: string;
  readonly descriptionKey: string;
  readonly values: readonly string[];
  readonly selectedIndex: number;
}

function loadOptions(): readonly EndlessOption[] {
  return [
    { id: 'endless_tier',  labelKey: 'endless.tier',  descriptionKey: 'Difficulty tier',  values: ['Tier 1 — Normal', 'Tier 2 — Hard', 'Tier 3 — Elite'], selectedIndex: 0 },
    { id: 'endless_bias',  labelKey: 'endless.bias',  descriptionKey: 'Map bias',         values: ['Balanced', 'Combat-heavy', 'Event-heavy', 'Merchant-heavy'], selectedIndex: 0 },
    { id: 'endless_length', labelKey: 'endless.length', descriptionKey: 'Target length',   values: ['Short (6 nodes)', 'Medium (9 nodes)', 'Long (13 nodes)'], selectedIndex: 1 },
  ];
}

export function EndlessSetupScreen({ onBack, onLaunch }: EndlessSetupScreenProps): JSX.Element {
  const options = useMemo(() => loadOptions(), []);

  return (
    <ScreenFrame labelledBy="endless-title">
      <h1 id="endless-title">Endless Setup</h1>
      <p>Endless mode: fight through escalating waves. No boss — survive as long as you can.</p>

      <ScrollRegion label="Endless configuration">
        {options.map((opt) => (
          <GameCard
            key={opt.id}
            title={opt.labelKey}
            state="default"
          >
            <p>{opt.descriptionKey}</p>
            <StatRow label="Current" value={opt.values[opt.selectedIndex] ?? 'Unknown'} />
          </GameCard>
        ))}
      </ScrollRegion>

      <StatRow label="Wave" value="1" />
      <StatRow label="Instability start" value="0" />

      {onLaunch ? (
        <Button labelKey="ui.common.launch" variant="primary" onClick={onLaunch} />
      ) : null}
      <Button labelKey="ui.common.back" variant="secondary" onClick={onBack} />
    </ScreenFrame>
  );
}
