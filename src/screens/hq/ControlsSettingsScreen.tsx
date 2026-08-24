/**
 * Phase 40: Controls settings screen (S63).
 * Shows keyboard and gamepad bindings from the input registry,
 * including repeat delay and double-tap prevention flags.
 */
import { useState } from 'react';
import type { JSX } from 'react';
import { Button } from '../../ui/components/Button.js';
import { StatRow } from '../../ui/components/StatRow.js';
import { ScreenFrame } from '../../ui/layout/ScreenFrame.js';
import { BottomActionBar } from '../../ui/layout/BottomActionBar.js';
import { ScrollRegion } from '../../ui/layout/ScrollRegion.js';
import { InputRegistry } from '../../platform/input/input-registry.js';
import type { SemanticAction } from '../../platform/input/input-registry.js';

export interface ControlsSettingsScreenProps {
  readonly onBack: () => void;
}

/** Human-readable labels for semantic actions. */
const ACTION_LABELS: Readonly<Record<SemanticAction, string>> = {
  confirm: 'Confirm',
  back: 'Back',
  cancel: 'Cancel',
  menu: 'Menu',
  up: 'Up',
  down: 'Down',
  left: 'Left',
  right: 'Right',
  nextTab: 'Next Tab',
  prevTab: 'Prev Tab',
  skip: 'Skip',
  pause: 'Pause',
  shoulderLeft: 'Shoulder L',
  shoulderRight: 'Shoulder R',
};

/** Map gamepad button index to a human label. */
function gamepadLabel(index: number): string {
  const labels: Readonly<Record<number, string>> = {
    0: 'A', 1: 'B', 2: 'X', 3: 'Y',
    4: 'LB', 5: 'RB', 6: 'LT', 7: 'RT',
    8: 'Select', 9: 'Start',
    12: 'D-Up', 13: 'D-Down', 14: 'D-Left', 15: 'D-Right',
  };
  return labels[index] ?? `Btn ${String(index)}`;
}

export function ControlsSettingsScreen({ onBack }: ControlsSettingsScreenProps): JSX.Element {
  const [registry] = useState(() => new InputRegistry());

  return (
    <ScreenFrame labelledBy="controls-title">
      <h1 id="controls-title">Controls</h1>
      <ScrollRegion label="Control bindings">
        {(['confirm', 'back', 'cancel', 'menu', 'up', 'down', 'left', 'right',
           'nextTab', 'prevTab', 'skip', 'pause', 'shoulderLeft', 'shoulderRight'] as const).map((action) => {
          const binding = registry.getBinding(action);
          if (!binding) return null;
          const keys = binding.keys.join(', ');
          const gamepad = binding.gamepadButtons.map((i) => gamepadLabel(i)).join(', ');
          return (
            <section key={action}>
              <h2>{ACTION_LABELS[action]}</h2>
              <StatRow label="Keyboard" value={keys} />
              <StatRow label="Gamepad" value={gamepad} />
              <StatRow label="Repeat Delay" value={`${String(binding.repeatDelay)}ms`} />
              <StatRow label="Double-Tap Prevention" value={binding.preventDoubleTap ? 'Yes' : 'No'} />
            </section>
          );
        })}
      </ScrollRegion>
      <BottomActionBar>
        <Button labelKey="ui.common.back" variant="secondary" onClick={onBack} />
      </BottomActionBar>
    </ScreenFrame>
  );
}