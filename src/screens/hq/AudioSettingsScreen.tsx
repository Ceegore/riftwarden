/**
 * Phase 39: Audio settings screen (S60).
 * Controls bus volumes, polyphony profile, and master mute.
 * Backed by the pure bus-mixer model — no actual audio playback.
 */
import { useState } from 'react';
import type { JSX } from 'react';
import { Button } from '../../ui/components/Button.js';
import { StatRow } from '../../ui/components/StatRow.js';
import { ScreenFrame } from '../../ui/layout/ScreenFrame.js';
import { BottomActionBar } from '../../ui/layout/BottomActionBar.js';
import { ScrollRegion } from '../../ui/layout/ScrollRegion.js';
import { SegmentedControl } from '../../ui/components/SegmentedControl.js';
import {
  createBusSettings, setBusVolume, toggleBusMute, setMasterMute,
  setPolyphonyProfile, busDisplayName,
  POLYPHONY_LIMITS,
} from '../../game/content/audio/bus-mixer.js';
import type { AudioBus, PolyphonyProfile } from '../../game/content/audio/bus-mixer.js';

export interface AudioSettingsScreenProps {
  readonly onBack: () => void;
}

const BUSES: readonly AudioBus[] = ['master', 'music', 'sfx', 'voice', 'ui', 'ambient'];

const PROFILE_OPTIONS: readonly { readonly value: PolyphonyProfile; readonly label: string }[] = [
  { value: 'high', label: `High (${String(POLYPHONY_LIMITS.high)})` },
  { value: 'medium', label: `Medium (${String(POLYPHONY_LIMITS.medium)})` },
  { value: 'low', label: `Low (${String(POLYPHONY_LIMITS.low)})` },
];

const VOLUME_OPTIONS: readonly { readonly value: number; readonly label: string }[] = [
  { value: 0, label: '0' }, { value: 20, label: '20' }, { value: 40, label: '40' },
  { value: 60, label: '60' }, { value: 80, label: '80' }, { value: 100, label: '100' },
];

export function AudioSettingsScreen({ onBack }: AudioSettingsScreenProps): JSX.Element {
  const [settings, setSettings] = useState(() => createBusSettings());

  return (
    <ScreenFrame labelledBy="audio-settings-title">
      <h1 id="audio-settings-title">Audio</h1>

      <ScrollRegion label="Audio settings">
        <section>
          <h2>Master</h2>
          <Button
            label={settings.masterMuted ? 'Muted' : 'Unmuted'}
            variant={settings.masterMuted ? 'danger' : 'primary'}
            onClick={() => { setSettings(setMasterMute(settings, !settings.masterMuted)); }}
          />
        </section>

        <section>
          <h2>Polyphony</h2>
          <SegmentedControl
            options={PROFILE_OPTIONS}
            value={settings.profile}
            onChange={(v) => { setSettings(setPolyphonyProfile(settings, v)); }}
          />
        </section>

        {BUSES.filter((b) => b !== 'master').map((bus) => (
          <section key={bus}>
            <h2>{busDisplayName(bus)}</h2>
            <StatRow label="Volume" value={`${String(settings.volume[bus])}%`} />
            <SegmentedControl
              options={VOLUME_OPTIONS}
              value={settings.volume[bus]}
              onChange={(v) => { setSettings(setBusVolume(settings, bus, v)); }}
            />
            <Button
              label={settings.muted[bus] ? `${busDisplayName(bus)}: Muted` : `${busDisplayName(bus)}: Unmuted`}
              variant={settings.muted[bus] ? 'danger' : 'secondary'}
              onClick={() => { setSettings(toggleBusMute(settings, bus)); }}
            />
          </section>
        ))}
      </ScrollRegion>

      <BottomActionBar>
        <Button labelKey="ui.common.back" variant="secondary" onClick={onBack} />
      </BottomActionBar>
    </ScreenFrame>
  );
}