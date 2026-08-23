/**
 * Expedition end screen (S55): victory summary with settlement details.
 */
import { useCallback } from 'react';
import type { JSX } from 'react';
import { Button } from '../../ui/components/Button.js';
import { StatRow } from '../../ui/components/StatRow.js';
import { ScreenFrame } from '../../ui/layout/ScreenFrame.js';
import { BottomActionBar } from '../../ui/layout/BottomActionBar.js';
import { useExpedition } from '../../features/expedition/useExpedition.js';
import { settleVictory } from '../../game/expedition/run-economy.js';

export function ExpeditionEndScreen(): JSX.Element {
  const { snapshot, abandon, finish } = useExpedition();

  const handleFinish = useCallback(() => finish(), [finish]);
  const handleReturn = useCallback(() => abandon(), [abandon]);

  if (!snapshot) {
    return (
      <ScreenFrame labelledBy="end-title">
        <h1 id="end-title">Expedition Complete</h1>
        <p>No active expedition.</p>
      </ScreenFrame>
    );
  }

  const settlement = settleVictory(snapshot.state);
  const isFinished = snapshot.runStatus === 'finished';

  return (
    <ScreenFrame labelledBy="end-title">
      <h1 id="end-title">Expedition Complete</h1>
      <StatRow label="Gold kept" value={String(settlement.keptGold)} />
      <StatRow label="Secured loot" value={String(settlement.keptLoot.length)} />
      <StatRow label="Relics kept" value={String(settlement.lostRelics.length)} />
      <StatRow label="Recruits kept" value={String(settlement.lostRecruits.length)} />
      <BottomActionBar>
        {isFinished ? (
          <Button labelKey="ui.common.return_to_hq" variant="primary" onClick={handleReturn} />
        ) : (
          <Button labelKey="ui.common.finish" variant="primary" onClick={handleFinish} />
        )}
      </BottomActionBar>
    </ScreenFrame>
  );
}
