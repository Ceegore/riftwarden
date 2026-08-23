/**
 * Expedition end screen (S55): victory summary with full settlement
 * breakdown. On continue, commits all settlement requests to the profile,
 * applies achievement/records/mastery/story tracking, and clears the
 * expedition, then calls onReturn.
 */
import { useCallback, useMemo } from 'react';
import type { JSX } from 'react';
import { Button } from '../../ui/components/Button.js';
import { StatRow } from '../../ui/components/StatRow.js';
import { ScreenFrame } from '../../ui/layout/ScreenFrame.js';
import { BottomActionBar } from '../../ui/layout/BottomActionBar.js';
import { useExpedition } from '../../features/expedition/useExpedition.js';
import { buildSettlementRequests } from '../../game/expedition/expedition-settlement.js';
import {
  loadAllPersistentState,
  applyExpeditionTracking,
  saveAllPersistentStateExport,
} from '../../game/expedition/settlement-bridge.js';
import { commitTransaction } from '../../game/profile/transaction-service.js';
import { loadOrCreateProfile, saveProfile } from '../../game/profile/profile-store.js';

export interface ExpeditionEndScreenProps {
  readonly onReturn: () => void;
  readonly missionId?: string;
}

export function ExpeditionEndScreen({ onReturn, missionId = 'mission_tutorial' }: ExpeditionEndScreenProps): JSX.Element {
  const { snapshot, finish, abandon } = useExpedition();

  const handleFinish = useCallback(() => finish(), [finish]);

  const handleCommitAndReturn = useCallback(() => {
    if (!snapshot) return;
    // Build and commit all settlement requests to the profile.
    const { requests } = buildSettlementRequests(snapshot.state, 'victory');
    let profile = loadOrCreateProfile();
    for (const req of requests) {
      profile = commitTransaction(profile, req).profile;
    }
    saveProfile(profile);

    // Apply achievement, records, mastery, story tracking.
    const allState = loadAllPersistentState();
    const nodesVisited = Object.keys(snapshot.state.visits).length;
    const goldEarned = snapshot.state.goldEarned;
    const updated = applyExpeditionTracking(
      snapshot.state, 'victory', missionId, goldEarned, nodesVisited, allState,
    );
    saveAllPersistentStateExport(updated);

    abandon();
    onReturn();
  }, [snapshot, abandon, onReturn, missionId]);

  if (!snapshot) {
    return (
      <ScreenFrame labelledBy="end-title">
        <h1 id="end-title">Expedition Complete</h1>
        <p>No active expedition.</p>
      </ScreenFrame>
    );
  }

  const { settlement, requests } = useMemo(
    () => buildSettlementRequests(snapshot.state, 'victory'),
    [snapshot.state],
  );

  const isFinished = snapshot.runStatus === 'finished';
  const lootCount = settlement.keptLoot.length;
  const relicCount = settlement.lostRelics.length;
  const recruitCount = settlement.lostRecruits.length;

  return (
    <ScreenFrame labelledBy="end-title">
      <h1 id="end-title">Expedition Complete</h1>
      <h2>Victory!</h2>

      <StatRow label="Gold kept" value={`+${String(settlement.keptGold)}`} />
      <StatRow label="Gold lost" value={String(settlement.lostGold)} />

      {lootCount > 0 && (
        <section>
          <h3>Loot claimed ({lootCount})</h3>
          {settlement.keptLoot.map((id) => (
            <StatRow key={id} label={id} value="Acquired" />
          ))}
        </section>
      )}

      {relicCount > 0 && (
        <section>
          <h3>Relics kept ({relicCount})</h3>
          {settlement.lostRelics.map((id) => (
            <StatRow key={id} label={id} value="Acquired" />
          ))}
        </section>
      )}

      {recruitCount > 0 && (
        <section>
          <h3>Recruits joined ({recruitCount})</h3>
          {settlement.lostRecruits.map((id) => (
            <StatRow key={id} label={id} value="Recruited" />
          ))}
        </section>
      )}

      <StatRow label="Profile transactions" value={String(requests.length)} />

      <BottomActionBar>
        {isFinished ? (
          <Button labelKey="ui.common.return_to_hq" variant="primary" onClick={handleCommitAndReturn} />
        ) : (
          <Button labelKey="ui.common.finish" variant="primary" onClick={handleFinish} />
        )}
      </BottomActionBar>
    </ScreenFrame>
  );
}
