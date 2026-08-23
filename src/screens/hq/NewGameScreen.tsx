/**
 * New Game screen (S04): difficulty selection and mission picker.
 * On launch, generates a map through useExpedition for the selected
 * mission and navigates to the expedition map.
 */
import { useCallback, useMemo, useState } from 'react';
import type { JSX } from 'react';
import { Button } from '../../ui/components/Button.js';
import { GameCard } from '../../ui/components/GameCard.js';
import { StatRow } from '../../ui/components/StatRow.js';
import { ScreenFrame } from '../../ui/layout/ScreenFrame.js';
import { BottomActionBar } from '../../ui/layout/BottomActionBar.js';
import { ScrollRegion } from '../../ui/layout/ScrollRegion.js';
import { useExpedition } from '../../features/expedition/useExpedition.js';
import { loadMissionState } from '../../game/mission/mission-store.js';
import { MISSIONS, missionById } from '../../game/mission/mission-definitions.js';
import type { MissionDefinition } from '../../game/mission/types.js';

export interface NewGameScreenProps {
  readonly onLaunched: () => void;
  readonly onBack: () => void;
}

export function NewGameScreen({ onLaunched, onBack }: NewGameScreenProps): JSX.Element {
  const { newRun, loading } = useExpedition();
  const [selectedMission, setSelectedMission] = useState<MissionDefinition | null>(null);

  const missionState = useMemo(() => loadMissionState(), []);

  const availableMissions = useMemo(
    () =>
      MISSIONS.filter((m) => {
        const prog = missionState.missions[m.id];
        return prog?.status !== 'locked';
      }),
    [missionState],
  );

  const handleLaunch = useCallback(() => {
    if (!selectedMission) return;
    const seed = Date.now();
    newRun(seed, 100, selectedMission.mapProfileId);
    onLaunched();
  }, [selectedMission, newRun, onLaunched]);

  if (selectedMission) {
    return (
      <ScreenFrame labelledBy="newgame-detail-title">
        <h1 id="newgame-detail-title">{selectedMission.id}</h1>
        <StatRow label="Difficulty" value={selectedMission.difficulty} />
        <StatRow label="Gold multiplier" value={`×${String(selectedMission.goldMultiplier)}`} />
        <StatRow label="Instability rate" value={`×${String(selectedMission.instabilityRate)}`} />
        {selectedMission.rewardPreviewKeys.length > 0 && (
          <section>
            <h2>Rewards</h2>
            {selectedMission.rewardPreviewKeys.map((key) => (
              <StatRow key={key} label={key} value="" />
            ))}
          </section>
        )}
        {selectedMission.requiredMissions.length > 0 && (
          <section>
            <h2>Requirements</h2>
            {selectedMission.requiredMissions.map((reqId) => {
              const reqDef = missionById(reqId);
              const reqProg = missionState.missions[reqId];
              return (
                <StatRow
                  key={reqId}
                  label={reqDef?.labelKey ?? reqId}
                  value={reqProg?.status === 'completed' ? '✓ Complete' : '✗ Locked'}
                />
              );
            })}
          </section>
        )}
        <BottomActionBar>
          <Button labelKey="ui.common.launch" variant="primary" onClick={handleLaunch} disabled={loading} />
          <Button labelKey="ui.common.back" variant="secondary" onClick={() => setSelectedMission(null)} />
        </BottomActionBar>
      </ScreenFrame>
    );
  }

  return (
    <ScreenFrame labelledBy="newgame-title">
      <h1 id="newgame-title">New Expedition</h1>
      <ScrollRegion label="Available missions">
        {availableMissions.map((mission) => {
          const prog = missionState.missions[mission.id];
          return (
            <GameCard
              key={mission.id}
              title={`${mission.id} (${mission.difficulty})`}
              state="default"
              onSelect={() => setSelectedMission(mission)}
            >
              <StatRow label="Difficulty" value={mission.difficulty} />
              <StatRow label="Gold mult" value={`×${String(mission.goldMultiplier)}`} />
              {prog && prog.completions > 0 && (
                <StatRow label="Best gold" value={String(prog.bestGold)} />
              )}
            </GameCard>
          );
        })}
      </ScrollRegion>
      <BottomActionBar>
        <Button labelKey="ui.common.back" variant="secondary" onClick={onBack} />
      </BottomActionBar>
    </ScreenFrame>
  );
}
