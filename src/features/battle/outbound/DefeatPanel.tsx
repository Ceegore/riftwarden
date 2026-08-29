/**
 * Phase 21 §9 defeat panel: rendered when the LIVE battle verdict is a
 * terminal DEFEAT. The win path is locked (the deterministic sim ruled it);
 * the player may either walk away (retreat) or RE-ENGAGE — a deterministic
 * rewatch of the same seed that pays nothing and levies the defeat penalty.
 * Re-engages ESCALATE (attempt k costs 5×k instability) and are capped at
 * MAX_REENGAGE_ATTEMPTS. The panel is deliberately small and pure so a render
 * test can pin both the affordance and the localized feedback.
 */
import type { JSX } from 'react';
import { Button } from '../../../ui/components/Button.js';

export interface DefeatPanelProps {
  /** Called when the player commits the ENGAGE_DEFEAT rewatch. */
  readonly onReengage: () => void;
  /** Instability the NEXT rewatch costs (the escalating contract penalty). */
  readonly instabilityDelta: number;
  /** Whether a rewatch has already been committed in this visit. */
  readonly reengaged: boolean;
  /** Re-engages left before the cap (0 disables the button). */
  readonly attemptsRemaining: number;
}

export function DefeatPanel({ onReengage, instabilityDelta, reengaged, attemptsRemaining }: DefeatPanelProps): JSX.Element {
  const capped = attemptsRemaining <= 0;
  return (
    <div className="rw-defeat-panel" role="alert">
      <p>{reengaged ? 'Re-engaged — the battle replays identically.' : 'Defeated — the node is gated; retreat or re-engage.'}</p>
      {reengaged && !capped && <p className="rw-defeat-tax">{`Re-engage costs +${String(instabilityDelta)} instability (escalating).`}</p>}
      {capped && <p className="rw-defeat-tax">No re-engages left — retreat only.</p>}
      <Button
        labelKey="ui.expedition.reengage"
        variant="secondary"
        disabled={capped}
        onClick={onReengage}
      />
    </div>
  );
}
