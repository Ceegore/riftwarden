/**
 * Reward choice screen (S54): shows the reward options from a combat node
 * snapshot and lets the user pick one. Calls onDone when finished.
 */
import { useCallback, useMemo, useState } from 'react';
import type { JSX } from 'react';
import { Button } from '../../ui/components/Button.js';
import { ResourcePill } from '../../ui/components/ResourcePill.js';
import { StatRow } from '../../ui/components/StatRow.js';
import { ScreenFrame } from '../../ui/layout/ScreenFrame.js';
import { BottomActionBar } from '../../ui/layout/BottomActionBar.js';
import { useExpedition } from '../../features/expedition/useExpedition.js';
import type { NodeActionRequest } from '../../game/expedition/nodes/types.js';
import { bountyForKinds } from '../../game/expedition/nodes/handlers/combat.js';
import { actionTransactionId } from '../../features/expedition/transaction-ids.js';

export interface RewardChoiceScreenProps {
  readonly onDone: () => void;
}

export function RewardChoiceScreen({ onDone }: RewardChoiceScreenProps): JSX.Element {
  const { snapshot, act, resolve } = useExpedition();
  const [claimedId, setClaimedId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const alreadyClaimed = useMemo(() => {
    if (!snapshot) return false;
    return Object.values(snapshot.state.ledger).some(
      (entry) => entry.nodeId === snapshot.currentNodeId && entry.action === 'CLAIM_REWARD' && entry.status === 'COMMITTED',
    );
  }, [snapshot]);

  // §9.5 objective bounty: the victory ENGAGE persisted its completed kinds on
  // the ledger record, so the reward screen derives and shows the bounty too —
  // durably (it survives a reload; the amount is the contract's, never the UI's).
  const bounty = useMemo(() => {
    if (!snapshot) return 0;
    const engage = Object.values(snapshot.state.ledger).find(
      (entry) => entry.nodeId === snapshot.currentNodeId && entry.action === 'ENGAGE' && entry.status === 'COMMITTED',
    );
    return engage === undefined ? 0 : bountyForKinds(engage.completedKinds ?? []);
  }, [snapshot]);

  const handleClaim = useCallback((optionId: string) => {
    if (!snapshot) return;
    const txId = actionTransactionId(snapshot.state.runId, snapshot.currentNodeId, 'CLAIM_REWARD', optionId);
    const request: NodeActionRequest = {
      transactionId: txId,
      nodeId: snapshot.currentNodeId,
      action: 'CLAIM_REWARD',
      optionId,
    };
    try {
      const outcome = act(request);
      if (outcome?.status !== 'COMMITTED') {
        setActionError(outcome?.reason ?? 'Reward unavailable');
        return;
      }
      setClaimedId(optionId);
      setActionError(null);
    } catch {
      setActionError('Reward unavailable');
    }
  }, [snapshot, act]);

  const handleDone = useCallback(() => { resolve(); onDone(); }, [resolve, onDone]);

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
      {bounty > 0 && <StatRow label="Objective bounty" value={`+${String(bounty)} gold`} />}
      {actionError && <p role="alert">{actionError}</p>}
      {rewardIds.map((id) => (
        <div key={id}>
          <StatRow label={id} value={claimedId === id ? 'Claimed' : ''} />
          <Button labelKey={claimedId === id || alreadyClaimed ? 'ui.common.claimed' : 'ui.common.claim'} variant={claimedId === id || alreadyClaimed ? 'secondary' : 'primary'} onClick={() => { handleClaim(id); }} disabled={claimedId !== null || alreadyClaimed} />
        </div>
      ))}
      <BottomActionBar>
        <Button labelKey="ui.common.continue" variant="primary" onClick={handleDone} disabled={rewardIds.length > 0 && claimedId === null && !alreadyClaimed} />
      </BottomActionBar>
    </ScreenFrame>
  );
}
