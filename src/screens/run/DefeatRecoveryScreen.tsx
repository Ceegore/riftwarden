/**
 * Defeat recovery screen (S56): defeat settlement summary with full
 * breakdown of what was kept and lost. On continue, commits settlement
 * requests to the profile, applies achievement tracking, and clears
 * the expedition, then calls onReturn.
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
  trackingHeroIds,
} from '../../game/expedition/settlement-bridge.js';
import { commitTransaction } from '../../game/profile/transaction-service.js';
import { loadOrCreateProfile, saveProfile } from '../../game/profile/profile-store.js';
import { missionByMapProfileId } from '../../game/mission/mission-definitions.js';

export interface DefeatRecoveryScreenProps {
  readonly onReturn: () => void;
  readonly missionId?: string;
}

export function DefeatRecoveryScreen({ onReturn, missionId = 'mission_tutorial' }: DefeatRecoveryScreenProps): JSX.Element {
  const { snapshot, abandon } = useExpedition();

  const handleCommitAndReturn = useCallback(() => {
    if (!snapshot) return;
    const { requests } = buildSettlementRequests(snapshot.state, 'defeat');
    let profile = loadOrCreateProfile();
    for (const req of requests) {
      profile = commitTransaction(profile, req).profile;
    }
    saveProfile(profile);

    // Apply achievement, records, mastery, story tracking.
    const allState = loadAllPersistentState();
    const nodesVisited = Object.keys(snapshot.state.visits).length;
    const goldEarned = snapshot.state.goldEarned;
    const effectiveMissionId = missionId === 'mission_tutorial'
      ? missionByMapProfileId(snapshot.state.modeId)?.id ?? missionId
      : missionId;
    const updated = applyExpeditionTracking(
      snapshot.state, 'defeat', effectiveMissionId, goldEarned, nodesVisited, allState, trackingHeroIds(),
    );
    saveAllPersistentStateExport(updated);

    abandon();
    onReturn();
  }, [snapshot, abandon, onReturn, missionId]);

  const settlementData = useMemo(
    () => snapshot ? buildSettlementRequests(snapshot.state, 'defeat') : null,
    [snapshot],
  );

  if (!snapshot || settlementData === null) {
    return (
      <ScreenFrame labelledBy="defeat-title">
        <h1 id="defeat-title">Expedition Lost</h1>
        <p>No active expedition.</p>
      </ScreenFrame>
    );
  }

  const { settlement, requests } = settlementData;
  const lostGold = settlement.lostGold;
  const keptLootCount = settlement.keptLoot.length;
  const lostLootCount = settlement.lostLoot.length;
  const lostRelicCount = settlement.lostRelics.length;
  const lostRecruitCount = settlement.lostRecruits.length;

  return (
    <ScreenFrame labelledBy="defeat-title">
      <h1 id="defeat-title">Expedition Lost</h1>
      <h2>Your party was defeated.</h2>

      <StatRow label="Gold kept" value={`+${String(settlement.keptGold)}`} />
      <StatRow
        label="Gold lost"
        value={lostGold > 0 ? `-${String(lostGold)}` : '0'}
      />

      {keptLootCount > 0 && (
        <section>
          <h3>Secured loot kept ({keptLootCount})</h3>
          {settlement.keptLoot.map((id) => (
            <StatRow key={id} label={id} value="Kept" />
          ))}
        </section>
      )}

      {lostLootCount > 0 && (
        <section>
          <h3>Unsecured loot lost ({lostLootCount})</h3>
          {settlement.lostLoot.map((id) => (
            <StatRow key={id} label={id} value="Lost" />
          ))}
        </section>
      )}

      {lostRelicCount > 0 && (
        <section>
          <h3>Temporary relics lost ({lostRelicCount})</h3>
          {settlement.lostRelics.map((id) => (
            <StatRow key={id} label={id} value="Lost" />
          ))}
        </section>
      )}

      {lostRecruitCount > 0 && (
        <section>
          <h3>Temporary recruits lost ({lostRecruitCount})</h3>
          {settlement.lostRecruits.map((id) => (
            <StatRow key={id} label={id} value="Lost" />
          ))}
        </section>
      )}

      <StatRow label="Profile transactions" value={String(requests.length)} />

      <BottomActionBar>
        <Button labelKey="ui.common.return_to_hq" variant="primary" onClick={handleCommitAndReturn} />
      </BottomActionBar>
    </ScreenFrame>
  );
}
