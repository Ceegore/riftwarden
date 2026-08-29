/**
 * Phase 21 §9.5 bounty preview disclosure. Before the player commits ENGAGE,
 * the mission's potential objective bounty (the per-kind contract sum the
 * victory would pay) is disclosed next to the action — so the reward is never
 * a surprise and the amounts always come from the contract, never the UI. Pure
 * and tiny so a render test can pin the wording.
 */
import type { JSX } from 'react';

export interface MissionBountyDisclosureProps {
  /** §9.5 potential objective bounty the mission's victory pays (0 → no line). */
  readonly bounty: number;
  /** Display-safe objective names behind the bounty (advisory only). */
  readonly objectives: readonly string[];
}

export function MissionBountyDisclosure({ bounty, objectives }: MissionBountyDisclosureProps): JSX.Element {
  if (bounty <= 0 || objectives.length === 0) return <div className="rw-mission-bounty" />;
  return (
    <p className="rw-mission-bounty">
      {`On victory: +${String(bounty)} objective bounty (${objectives.join(', ')}).`}
    </p>
  );
}
