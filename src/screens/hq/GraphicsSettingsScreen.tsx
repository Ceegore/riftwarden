/**
 * Phase 41: Graphics settings screen (S61).
 * Controls quality tier and GPU settings.
 */
import { useState } from 'react';
import type { JSX } from 'react';
import { Button } from '../../ui/components/Button.js';
import { StatRow } from '../../ui/components/StatRow.js';
import { ScreenFrame } from '../../ui/layout/ScreenFrame.js';
import { BottomActionBar } from '../../ui/layout/BottomActionBar.js';
import { ScrollRegion } from '../../ui/layout/ScrollRegion.js';
import { budgetForTier } from '../../game/performance/auto-quality.js';
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
  const [tier, setTier] = useState<QualityTier>(() => {
    // Default to high; auto-quality can override at runtime
    return 'high';
  });

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
              onClick={() => { setTier(t.value); }}
            />
          ))}
        </section>

        <section>
          <h2>Performance Budget</h2>
          <StatRow label="Frame Target" value={`${String(budget.targetMs)}ms`} />
          <StatRow label="Sample Window" value={String(budget.sampleWindow)} />
          <StatRow label="Degrade At" value={`${String(Math.round(budget.degradationThreshold * 100))}%`} />
          <StatRow label="Upgrade At" value={`${String(Math.round(budget.upgradeThreshold * 100))}%`} />
        </section>
      </ScrollRegion>

      <BottomActionBar>
        <Button labelKey="ui.common.back" variant="secondary" onClick={onBack} />
      </BottomActionBar>
    </ScreenFrame>
  );
}