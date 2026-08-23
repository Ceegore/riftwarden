/**
 * Defeat recovery screen (S56): defeat settlement summary with full
 * breakdown of what was kept and lost. On continue, commits settlement
 * requests to the profile and clears the expedition.
 */
import { useCallback, useMemo } from 'react';
import type { JSX } from 'react';
import { Button } from '../../ui/components/Button.js';
import { StatRow } from '../../ui/components/StatRow.js';
import { ScreenFrame } from '../../ui/layout/ScreenFrame.js';
import { BottomActionBar } from '../../ui/layout/BottomActionBar.js';
import { useExpedition } from '../../features/expedition/useExpedition.js';
import { buildSettlementRequests } from '../../game/expedition/expedition-settlement.js';
import { commitTransaction } from '../../game/profile/transaction-service.js';
import { loadOrCreateProfile, saveProfile } from '../../game/profile/profile-store.js';

export function DefeatRecoveryScreen(): JSX.Element {
  const { snapshot, abandon } = useExpedition();

  const handleCommitAndReturn = useCallback(() => {
    if (!snapshot) return;
    const { requests } = buildSettlementRequests(snapshot.state, 'defeat');
    let profile = loadOrCreateProfile();
    for (const req of requests) {
      profile = commitTransaction(profile, req).profile;
    }
    saveProfile(profile);
    abandon();
  }, [snapshot, abandon]);

  if (!snapshot) {
    return (
      <ScreenFrame labelledBy="defeat-title">
        <h1 id="defeat-title">Expedition Lost</h1>
        <p>No active expedition.</p>
      </ScreenFrame>
    );
  }

  const { settlement, requests } = useMemo(
    () => buildSettlementRequests(snapshot.state, 'defeat'),
    [snapshot.state],
  );

  const lostGold = settlement.lostGold;
  const keptLootCount = settlement.keptLoot.length;
  const lostLootCount = settlement.lostLoot.length;

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

      <StatRow label="Profile transactions" value={String(requests.length)} />

      <BottomActionBar>
        <Button labelKey="ui.common.return_to_hq" variant="primary" onClick={handleCommitAndReturn} />
      </BottomActionBar>
    </ScreenFrame>
  );
}
