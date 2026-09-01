/**
 * Mission details screen (S12): full mission detail with launch button.
 * Shows requirements, rewards, difficulty, and launches the expedition.
 */
import { useCallback, useMemo } from 'react';
import type { JSX } from 'react';
import { Button } from '../../ui/components/Button.js';
import { StatRow } from '../../ui/components/StatRow.js';
import { ScreenFrame } from '../../ui/layout/ScreenFrame.js';
import { BottomActionBar } from '../../ui/layout/BottomActionBar.js';
import { useExpedition } from '../../features/expedition/useExpedition.js';
import { loadMissionState } from '../../game/mission/mission-store.js';
import { ensureStarterHero, loadOrCreateProfile, saveProfile } from '../../game/profile/profile-store.js';
import { missionById } from '../../game/mission/mission-definitions.js';
import type { MissionDefinition } from '../../game/mission/types.js';
import { resolveExpeditionSeed } from '../../features/expedition/transaction-ids.js';

export interface MissionDetailsScreenProps {
  readonly mission: MissionDefinition;
  readonly onLaunched: (missionId: string) => void;
  readonly onBack: () => void;
}

export function MissionDetailsScreen({ mission, onLaunched, onBack }: MissionDetailsScreenProps): JSX.Element {
  const { newRun, loading } = useExpedition();
  const missionState = useMemo(() => loadMissionState(), []);

  const canLaunch = useMemo(() => {
    const prog = missionState.missions[mission.id];
    return prog?.status !== 'locked';
  }, [missionState, mission]);

  const handleLaunch = useCallback(() => {
    if (!canLaunch) return;
    const seed = resolveExpeditionSeed();
    saveProfile(ensureStarterHero(loadOrCreateProfile()));
    newRun(seed, 100, mission.mapProfileId);
    onLaunched(mission.id);
  }, [canLaunch, mission.id, mission.mapProfileId, newRun, onLaunched]);

  const prog = missionState.missions[mission.id];

  return (
    <ScreenFrame labelledBy="mission-detail-title">
      <h1 id="mission-detail-title">{mission.id}</h1>
      <p>{mission.descriptionKey}</p>

      <StatRow label="Difficulty" value={mission.difficulty} />
      <StatRow label="Gold multiplier" value={`×${String(mission.goldMultiplier)}`} />
      <StatRow label="Instability rate" value={`×${String(mission.instabilityRate)}`} />
      {prog && (
        <>
          <StatRow label="Status" value={prog.status} />
          {prog.completions > 0 && (
            <>
              <StatRow label="Completions" value={String(prog.completions)} />
              <StatRow label="Best gold" value={String(prog.bestGold)} />
            </>
          )}
        </>
      )}

      {mission.requiredMissions.length > 0 && (
        <section>
          <h2>Requirements</h2>
          {mission.requiredMissions.map((reqId) => {
            const reqDef = missionById(reqId);
            const reqProg = missionState.missions[reqId];
            const met = reqProg?.status === 'completed';
            return (
              <StatRow
                key={reqId}
                label={reqDef?.labelKey ?? reqId}
                value={met ? '✓' : '✗ Locked'}
              />
            );
          })}
        </section>
      )}

      {mission.rewardPreviewKeys.length > 0 && (
        <section>
          <h2>Rewards</h2>
          {mission.rewardPreviewKeys.map((key) => (
            <StatRow key={key} label={key} value="" />
          ))}
        </section>
      )}

      <BottomActionBar>
        <Button
          labelKey="ui.common.launch"
          variant="primary"
          onClick={handleLaunch}
          disabled={!canLaunch || loading}
        />
        <Button labelKey="ui.common.back" variant="secondary" onClick={onBack} />
      </BottomActionBar>
    </ScreenFrame>
  );
}
