/**
 * Battle result screen (S53): shows the outcome of a combat node
 * after the action resolves. Reads gold earned, loot found, and
 * instability from the most recent committed transaction.
 */
import { useMemo } from 'react';
import type { JSX } from 'react';
import { Button } from '../../ui/components/Button.js';
import { ResourcePill } from '../../ui/components/ResourcePill.js';
import { StatRow } from '../../ui/components/StatRow.js';
import { ScreenFrame } from '../../ui/layout/ScreenFrame.js';
import { BottomActionBar } from '../../ui/layout/BottomActionBar.js';
import { useExpedition } from '../../features/expedition/useExpedition.js';

export interface BattleResultScreenProps {
  readonly onContinue: () => void;
}

export function BattleResultScreen({ onContinue }: BattleResultScreenProps): JSX.Element {
  const { snapshot } = useExpedition();

  const result = useMemo(() => {
    if (!snapshot) return null;
    const nodeId = snapshot.currentNodeId;
    const visit = snapshot.state.visits[nodeId];
    if (!visit) return null;

    // Find the most recent committed transaction for this node.
    const ledgerEntries = Object.values(snapshot.state.ledger)
      .filter((r) => r.nodeId === nodeId && r.status === 'COMMITTED')
      .sort((a, b) => {
        // Sort by id for deterministic ordering.
        if (a.transactionId < b.transactionId) return -1;
        if (a.transactionId > b.transactionId) return 1;
        return 0;
      });

    const lastTx = ledgerEntries[ledgerEntries.length - 1];
    const hasRewards =
      snapshot.state.snapshots[nodeId]?.kind === 'REWARD' &&
      snapshot.state.snapshots[nodeId]?.rewardIds !== undefined &&
      (snapshot.state.snapshots[nodeId] as { rewardIds: readonly string[] }).rewardIds.length > 0;

    return {
      action: lastTx?.action ?? 'NONE',
      status: lastTx?.status ?? 'UNKNOWN',
      gold: snapshot.gold,
      instability: snapshot.instability,
      securedCount: snapshot.securedLoot.length,
      unsecuredCount: snapshot.unsecuredLoot.length,
      hasRewards,
    };
  }, [snapshot]);

  if (!snapshot || !result) {
    return (
      <ScreenFrame labelledBy="result-title">
        <h1 id="result-title">Battle Result</h1>
        <p>No active expedition.</p>
      </ScreenFrame>
    );
  }

  return (
    <ScreenFrame labelledBy="result-title">
      <h1 id="result-title">Battle Result</h1>

      <div className="rw-expedition-resources">
        <ResourcePill icon="◆" value={result.gold} nameKey="ui.resource.gold" />
        <ResourcePill icon="⚠" value={result.instability} nameKey="ui.resource.instability" />
      </div>

      <StatRow label="Action" value={result.action} />
      <StatRow label="Result" value={result.status} />
      <StatRow label="Secured loot" value={String(result.securedCount)} />
      <StatRow label="Unsecured loot" value={String(result.unsecuredCount)} />

      <BottomActionBar>
        <Button labelKey="ui.common.continue" variant="primary" onClick={onContinue} />
      </BottomActionBar>
    </ScreenFrame>
  );
}
