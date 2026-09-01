import type { JSX } from 'react';
import type { LiveOutboundInput, Phase21OutboundReport } from './phase21-outbound-presenter.js';
import { encounterOutboundFromBattle } from './phase21-outbound-presenter.js';
import { Phase21OutboundPanel } from './Phase21OutboundPanel.js';

/**
 * Phase 21 §9 live mount. Feeds ONE running battle's outbound sense (boss
 * phase, modifier hook log, canonical phase events) through the live bridge
 * (`encounterOutboundFromBattle`) into the panel — the same presentation a
 * static launcher report renders, from a live battle. The battle screen mounts
 * this wrapper; until the sim kernel is wired into the expedition flow the
 * caller supplies whatever live state it actually holds (an empty boss/hook
 * surface is the honest "waiting for sim" state).
 */
export interface LiveBattleOutboundPanelProps {
  readonly input: LiveOutboundInput;
}

export function LiveBattleOutboundPanel({ input }: LiveBattleOutboundPanelProps): JSX.Element {
  const entry = encounterOutboundFromBattle(input);
  const report: Phase21OutboundReport = Object.freeze({
    gate: 'G21-LIVE-BATTLE',
    status: entry.status,
    drift: 0,
    seededFailures: 0,
    perEncounter: Object.freeze({ [input.encounterId]: entry }),
  });
  return <Phase21OutboundPanel report={report} />;
}
