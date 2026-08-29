/**
 * Phase 21 §9 defeat panel: rendered when the LIVE battle verdict is a
 * terminal DEFEAT. The win path is locked (the deterministic sim ruled it);
 * the player may either walk away (retreat) or RE-ENGAGE — a deterministic
 * rewatch of the same seed that pays nothing and levies the +5 instability
 * defeat penalty (repeatable). The panel is deliberately small and pure so a
 * render test can pin both the affordance and the localized feedback.
 */
import type { JSX } from 'react';
import { Button } from '../../../ui/components/Button.js';

export interface DefeatPanelProps {
  /** Called when the player commits the ENGAGE_DEFEAT rewatch. */
  readonly onReengage: () => void;
  /** Instability a rewatch costs (the contract's defeat penalty). */
  readonly instabilityDelta: number;
  /** Whether a rewatch has already been committed in this visit. */
  readonly reengaged: boolean;
}

export function DefeatPanel({ onReengage, instabilityDelta, reengaged }: DefeatPanelProps): JSX.Element {
  return (
    <div className="rw-defeat-panel" role="alert">
      <p>{reengaged ? 'Re-engaged — the battle replays identically.' : 'Defeated — the node is gated; retreat or re-engage.'}</p>
      {reengaged && <p className="rw-defeat-tax">Re-engage costs +{String(instabilityDelta)} instability.</p>}
      <Button labelKey="ui.expedition.reengage" variant="secondary" onClick={onReengage} />
    </div>
  );
}
