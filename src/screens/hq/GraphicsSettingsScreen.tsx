/**
 * Phase 41: Graphics settings screen (S61).
 * Controls quality tier and shows the resulting frame budget.
 * Changes persist and feed the BattleCanvas initial tier.
 */
import { useCallback, useState } from 'react';
import type { JSX } from 'react';
import { Button } from '../../ui/components/Button.js';
import { roundPercent } from '../../ui/format/rounding.js';
import { StatRow } from '../../ui/components/StatRow.js';
import { ScreenFrame } from '../../ui/layout/ScreenFrame.js';
import { BottomActionBar } from '../../ui/layout/BottomActionBar.js';
import { ScrollRegion } from '../../ui/layout/ScrollRegion.js';
import { budgetForTier } from '../../game/performance/auto-quality.js';
import { loadQualityPreference, saveQualityPreference } from '../../game/performance/graphics-settings-store.js';
import type { QualityTier } from '../../game/performance/auto-quality.js';

export interface GraphicsSettingsScreenProps {
  readonly onBack: () => void;
}

const TIERS: readonly { readonly value: QualityTier; readonly label: string }[] = [
  { value: 'high', label: 'High (60 FPS)' },
  { value: 'medium', label: 'Medium (30 FPS)' },
  { value: 'low', label: 'Low (20 FPS)' },
];

export function GraphicsSettingsScreen({ onBack }: GraphicsSettingsScreenProps): JSX.Element {
  const [tier, setTier] = useState<QualityTier>(() => loadQualityPreference());

  const handleSelect = useCallback((value: QualityTier) => {
    setTier(value);
    saveQualityPreference(value);
  }, []);

  const budget = budgetForTier(tier);

  return (
    <ScreenFrame labelledBy="graphics-title">
      <h1 id="graphics-title">Graphics</h1>

      <ScrollRegion label="Graphics settings">
        <section>
          <h2>Quality Preset</h2>
          {TIERS.map((t) => (
            <Button
              key={t.value}
              label={t.label}
              variant={tier === t.value ? 'primary' : 'secondary'}
              onClick={() => { handleSelect(t.value); }}
            />
          ))}
        </section>

        <section>
          <h2>Performance Budget</h2>
          <StatRow label="Frame Target" value={`${String(budget.targetMs)}ms`} />
          <StatRow label="Sample Window" value={String(budget.sampleWindow)} />
          <StatRow label="Degrade At" value={`${String(roundPercent(budget.degradationThreshold))}%`} />
          <StatRow label="Upgrade At" value={`${String(roundPercent(budget.upgradeThreshold))}%`} />
        </section>
      </ScrollRegion>

      <BottomActionBar>
        <Button labelKey="ui.common.back" variant="secondary" onClick={onBack} />
      </BottomActionBar>
    </ScreenFrame>
  );
}
