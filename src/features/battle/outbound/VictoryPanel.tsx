/**
 * Phase 21 §9.5 victory panel: rendered when the LIVE battle verdict is a
 * terminal VICTORY. The win path is unlocked (the deterministic sim ruled it);
 * the panel shows the objective bounty the ENGAGE will pay — the per-kind
 * contract sum over the completed objective kinds, so the reward is never a
 * surprise. Pure and small so a render test can pin the display.
 */
import type { JSX } from 'react';
import { bountyBreakdownForKinds } from '../../../game/expedition/nodes/handlers/combat.js';

export interface VictoryPanelProps {
  /** §9.5 gold bounty the victory ENGAGE pays (contract sum over completed kinds). */
  readonly bounty: number;
  /** The completed objective kinds that earned the bounty (display only). */
  readonly kinds: readonly string[];
}

export function VictoryPanel({ bounty, kinds }: VictoryPanelProps): JSX.Element {
  // §9.5 per-kind breakdown: the contract's per-kind amounts, one line each,
  // so the player sees exactly what each completed mission kind earned.
  const breakdown = bountyBreakdownForKinds(kinds);
  return (
    <div className="rw-victory-panel" role="status">
      <p>Victory — the node is cleared.</p>
      {bounty > 0 && (
        <>
          <p className="rw-victory-bounty">
            {`Objective bounty +${String(bounty)} gold (${kinds.join(', ')}) on ENGAGE.`}
          </p>
          <ul className="rw-victory-bounty-breakdown">
            {breakdown.map((entry) => (
              <li key={entry.kind}>{`${entry.kind}: +${String(entry.amount)} gold`}</li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
