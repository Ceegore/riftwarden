/**
 * Phase 40: Accessibility settings screen (S62).
 * Controls text scale, reduced motion, high contrast, screen reader,
 * color-blind filter, touch target size, sticky keys.
 */
import { useCallback, useState } from 'react';
import type { JSX } from 'react';
import { Button } from '../../ui/components/Button.js';
import { StatRow } from '../../ui/components/StatRow.js';
import { ScreenFrame } from '../../ui/layout/ScreenFrame.js';
import { BottomActionBar } from '../../ui/layout/BottomActionBar.js';
import { ScrollRegion } from '../../ui/layout/ScrollRegion.js';
import { SegmentedControl } from '../../ui/components/SegmentedControl.js';
import { loadA11ySettings, saveA11ySettings, updateA11ySettings } from '../../game/settings/a11y-settings.js';
import type { A11ySettings, ColorBlindFilter, TextScale } from '../../game/settings/a11y-settings.js';

export interface AccessibilitySettingsScreenProps {
  readonly onBack: () => void;
}

const TEXT_SCALE_OPTIONS: readonly { readonly value: TextScale; readonly label: string }[] = [
  { value: 100, label: '100%' },
  { value: 125, label: '125%' },
  { value: 150, label: '150%' },
  { value: 175, label: '175%' },
  { value: 200, label: '200%' },
];

const FILTER_OPTIONS: readonly { readonly value: ColorBlindFilter; readonly label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'protanopia', label: 'Protanopia' },
  { value: 'deuteranopia', label: 'Deuteranopia' },
  { value: 'tritanopia', label: 'Tritanopia' },
];

export function AccessibilitySettingsScreen({ onBack }: AccessibilitySettingsScreenProps): JSX.Element {
  const [settings, setSettings] = useState<A11ySettings>(() => loadA11ySettings());

  const update = useCallback((patch: Partial<A11ySettings>) => {
    const next = updateA11ySettings(settings, patch);
    setSettings(next);
    saveA11ySettings(next);
      window.dispatchEvent(new StorageEvent('storage', { key: 'rw.a11y.v1', newValue: JSON.stringify(next) }));
  }, [settings]);

  return (
    <ScreenFrame labelledBy="a11y-title">
      <h1 id="a11y-title">Accessibility</h1>

      <ScrollRegion label="Accessibility settings">
        <section>
          <h2>Text Scale</h2>
          <SegmentedControl
            options={TEXT_SCALE_OPTIONS}
            value={settings.textScale}
            onChange={(v) => { update({ textScale: v }); }}
          />
          <StatRow label="Current" value={`${String(settings.textScale)}%`} />
        </section>

        <section>
          <h2>Motion</h2>
          <Button
            label={settings.reducedMotion ? 'Reduced Motion: ON' : 'Reduced Motion: OFF'}
            variant={settings.reducedMotion ? 'primary' : 'secondary'}
            onClick={() => { update({ reducedMotion: !settings.reducedMotion }); }}
          />
        </section>

        <section>
          <h2>Contrast</h2>
          <Button
            label={settings.highContrast ? 'High Contrast: ON' : 'High Contrast: OFF'}
            variant={settings.highContrast ? 'primary' : 'secondary'}
            onClick={() => { update({ highContrast: !settings.highContrast }); }}
          />
        </section>

        <section>
          <h2>Screen Reader</h2>
          <Button
            label={settings.screenReaderMode ? 'Screen Reader Mode: ON' : 'Screen Reader Mode: OFF'}
            variant={settings.screenReaderMode ? 'primary' : 'secondary'}
            onClick={() => { update({ screenReaderMode: !settings.screenReaderMode }); }}
          />
        </section>

        <section>
          <h2>Color-Blind Filter</h2>
          <SegmentedControl
            options={FILTER_OPTIONS}
            value={settings.colorBlindFilter}
            onChange={(v) => { update({ colorBlindFilter: v }); }}
          />
        </section>

        <section>
          <h2>Touch Targets</h2>
          <Button
            label={settings.touchTargetSize === 'large' ? 'Touch Targets: Large' : 'Touch Targets: Normal'}
            variant={settings.touchTargetSize === 'large' ? 'primary' : 'secondary'}
            onClick={() => { update({ touchTargetSize: settings.touchTargetSize === 'normal' ? 'large' : 'normal' }); }}
          />
        </section>

        <section>
          <h2>Sticky Keys</h2>
          <Button
            label={settings.stickyKeys ? 'Sticky Keys: ON' : 'Sticky Keys: OFF'}
            variant={settings.stickyKeys ? 'primary' : 'secondary'}
            onClick={() => { update({ stickyKeys: !settings.stickyKeys }); }}
          />
        </section>
      </ScrollRegion>

      <BottomActionBar>
        <Button labelKey="ui.common.back" variant="secondary" onClick={onBack} />
      </BottomActionBar>
    </ScreenFrame>
  );
}
