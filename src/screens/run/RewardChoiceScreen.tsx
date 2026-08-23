/**
 * Reward choice screen (S54): shows the reward options from a combat node
 * snapshot and lets the user pick one. Uses the expedition hook directly.
 */
import { useCallback } from 'react';
import type { JSX } from 'react';
import { Button } from '../../ui/components/Button.js';
import { ResourcePill } from '../../ui/components/ResourcePill.js';
import { StatRow } from '../../ui/components/StatRow.js';
import { ScreenFrame } from '../../ui/layout/ScreenFrame.js';
import { BottomActionBar } from '../../ui/layout/BottomActionBar.js';
import { useExpedition } from '../../features/expedition/useExpedition.js';
import type { NodeActionRequest } from '../../game/expedition/nodes/types.js';

export function RewardChoiceScreen(): JSX.Element {
  const { snapshot, act, resolve } = useExpedition();

  const handleClaim = useCallback((optionId: string) => {
    if (!snapshot) return;
    const txId = `ui-claim-${String(Date.now())}`;
    const request: NodeActionRequest = {
      transactionId: txId,
      nodeId: snapshot.currentNodeId,
      action: 'CLAIM_REWARD',
      optionId,
    };
    act(request);
  }, [snapshot, act]);

  const handleDone = useCallback(() => resolve(), [resolve]);

  if (!snapshot) {
    return (
      <ScreenFrame labelledBy="reward-title">
        <h1 id="reward-title">Reward</h1>
        <p>No active expedition.</p>
      </ScreenFrame>
    );
  }

  const nodeSnap = snapshot.state.snapshots[snapshot.currentNodeId];
  const rewardIds = nodeSnap?.kind === 'REWARD' ? nodeSnap.rewardIds : [];

  return (
    <ScreenFrame labelledBy="reward-title">
      <h1 id="reward-title">Choose Reward</h1>
      <div className="rw-expedition-resources">
        <ResourcePill icon="◆" value={snapshot.gold} nameKey="ui.resource.gold" />
      </div>
      {rewardIds.map((id) => (
        <div key={id}>
          <StatRow label={id} value="" />
          <Button labelKey="ui.common.claim" variant="primary" onClick={() => handleClaim(id)} />
        </div>
      ))}
      <BottomActionBar>
        <Button labelKey="ui.common.continue" variant="primary" onClick={handleDone} />
      </BottomActionBar>
    </ScreenFrame>
  );
}
