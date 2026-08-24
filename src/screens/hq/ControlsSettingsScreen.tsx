/**
 * Phase 40: Controls settings screen (S63).
 * Shows keyboard and gamepad binding reference.
 */
import type { JSX } from 'react';
import { Button } from '../../ui/components/Button.js';
import { StatRow } from '../../ui/components/StatRow.js';
import { ScreenFrame } from '../../ui/layout/ScreenFrame.js';
import { BottomActionBar } from '../../ui/layout/BottomActionBar.js';
import { ScrollRegion } from '../../ui/layout/ScrollRegion.js';

export interface ControlsSettingsScreenProps {
  readonly onBack: () => void;
}

const BINDINGS: readonly { readonly action: string; readonly keys: string; readonly gamepad: string }[] = [
  { action: 'Confirm',   keys: 'Enter / Space',      gamepad: 'A' },
  { action: 'Back',      keys: 'Escape / Backspace',   gamepad: 'B' },
  { action: 'Menu',      keys: 'M',                    gamepad: 'Menu' },
  { action: 'Up',        keys: 'Arrow Up / W',         gamepad: 'D-Pad Up' },
  { action: 'Down',      keys: 'Arrow Down / S',       gamepad: 'D-Pad Down' },
  { action: 'Left',      keys: 'Arrow Left / A',       gamepad: 'D-Pad Left' },
  { action: 'Right',     keys: 'Arrow Right / D',      gamepad: 'D-Pad Right' },
  { action: 'Next Tab',  keys: 'Tab',                   gamepad: 'RB' },
  { action: 'Prev Tab',  keys: 'Shift + Tab',           gamepad: 'LB' },
  { action: 'Skip',      keys: 'Space',                 gamepad: 'Start' },
  { action: 'Pause',     keys: 'P',                     gamepad: 'Menu' },
  { action: 'Shoulder L',keys: 'Q',                     gamepad: 'LB' },
  { action: 'Shoulder R',keys: 'E',                     gamepad: 'RB' },
];

export function ControlsSettingsScreen({ onBack }: ControlsSettingsScreenProps): JSX.Element {
  return (
    <ScreenFrame labelledBy="controls-title">
      <h1 id="controls-title">Controls</h1>
      <ScrollRegion label="Control bindings">
        {BINDINGS.map((b) => (
          <StatRow key={b.action} label={b.action} value={`${b.keys}  |  ${b.gamepad}`} />
        ))}
      </ScrollRegion>
      <BottomActionBar>
        <Button labelKey="ui.common.back" variant="secondary" onClick={onBack} />
      </BottomActionBar>
    </ScreenFrame>
  );
}