/**
 * Defeat recovery screen (S56): settlement summary after a run-ending defeat.
 */
import { useCallback } from 'react';
import type { JSX } from 'react';
import { Button } from '../../ui/components/Button.js';
import { StatRow } from '../../ui/components/StatRow.js';
import { ScreenFrame } from '../../ui/layout/ScreenFrame.js';
import { BottomActionBar } from '../../ui/layout/BottomActionBar.js';
import { useExpedition } from '../../features/expedition/useExpedition.js';
import { settleDefeat } from '../../game/expedition/run-economy.js';

export function DefeatRecoveryScreen(): JSX.Element {
  const { snapshot, abandon } = useExpedition();

  const handleReturn = useCallback(() => abandon(), [abandon]);

  if (!snapshot) {
    return (
      <ScreenFrame labelledBy="defeat-title">
        <h1 id="defeat-title">Expedition Lost</h1>
        <p>No active expedition.</p>
      </ScreenFrame>
    );
  }

  const settlement = settleDefeat(snapshot.state);

  return (
    <ScreenFrame labelledBy="defeat-title">
      <h1 id="defeat-title">Expedition Lost</h1>
      <StatRow label="Gold kept" value={String(settlement.keptGold)} />
      <StatRow label="Gold lost" value={String(settlement.lostGold)} />
      <StatRow label="Loot kept" value={String(settlement.keptLoot.length)} />
      <StatRow label="Loot lost" value={String(settlement.lostLoot.length)} />
      <BottomActionBar>
        <Button labelKey="ui.common.return_to_hq" variant="primary" onClick={handleReturn} />
      </BottomActionBar>
    </ScreenFrame>
  );
}
