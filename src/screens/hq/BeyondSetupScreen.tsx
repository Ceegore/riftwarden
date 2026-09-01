/**
 * Beyond setup screen (S36): unlocks after the first ascension. Allows
 * the player to configure "beyond" mode — accelerated difficulty scaling,
 * special mutators, and unique rewards for post-game content.
 */
import { useMemo, type JSX } from 'react';
import { Button } from '../../ui/components/Button.js';
import { GameCard } from '../../ui/components/GameCard.js';
import { StatRow } from '../../ui/components/StatRow.js';
import { ScreenFrame } from '../../ui/layout/ScreenFrame.js';
import { ScrollRegion } from '../../ui/layout/ScrollRegion.js';

export interface BeyondSetupScreenProps {
  readonly onBack: () => void;
  readonly onLaunch?: () => void;
}

interface BeyondModifier {
  readonly id: string;
  readonly labelKey: string;
  readonly descriptionKey: string;
  readonly enabled: boolean;
  readonly locked: boolean;
}

function loadModifiers(): readonly BeyondModifier[] {
  return [
    { id: 'beyond_double_enemies', labelKey: 'beyond.double_enemies', descriptionKey: 'All battles have 2× enemies',  enabled: false, locked: false },
    { id: 'beyond_no_heal',        labelKey: 'beyond.no_heal',        descriptionKey: 'No healing between nodes',       enabled: false, locked: false },
    { id: 'beyond_permadeath',     labelKey: 'beyond.permadeath',     descriptionKey: 'Defeated heroes are lost',        enabled: false, locked: true },
    { id: 'beyond_chaos_drops',    labelKey: 'beyond.chaos_drops',    descriptionKey: 'Randomized loot tables',          enabled: false, locked: false },
    { id: 'beyond_time_pressure',  labelKey: 'beyond.time_pressure',  descriptionKey: 'Instability rises faster',       enabled: false, locked: true },
    { id: 'beyond_boss_rush',      labelKey: 'beyond.boss_rush',      descriptionKey: 'All nodes are bosses',            enabled: false, locked: true },
  ];
}

export function BeyondSetupScreen({ onBack, onLaunch }: BeyondSetupScreenProps): JSX.Element {
  const modifiers = useMemo(() => loadModifiers(), []);

  return (
    <ScreenFrame labelledBy="beyond-title">
      <h1 id="beyond-title">Beyond Setup</h1>
      <p>Beyond mode unlocks after your first ascension. Stack modifiers for greater rewards.</p>

      <ScrollRegion label="Beyond modifiers">
        {modifiers.map((mod) => (
          <GameCard
            key={mod.id}
            title={mod.labelKey}
            state={mod.locked ? 'locked' : mod.enabled ? 'selected' : 'default'}
          >
            <p>{mod.descriptionKey}</p>
            {mod.locked && <p>Locked — complete more ascensions to unlock.</p>}
          </GameCard>
        ))}
      </ScrollRegion>

      <StatRow label="Gold multiplier" value="1.0×" />
      <StatRow label="XP multiplier" value="1.0×" />

      {onLaunch ? (
        <Button labelKey="ui.common.launch" variant="primary" onClick={onLaunch} />
      ) : null}
      <Button labelKey="ui.common.back" variant="secondary" onClick={onBack} />
    </ScreenFrame>
  );
}
