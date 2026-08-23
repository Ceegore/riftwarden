/**
 * Mission board screen (S11): grid of available missions with
 * status indicators. Selecting a mission navigates to its detail view.
 */
import { useMemo, useState } from 'react';
import type { JSX } from 'react';
import { Button } from '../../ui/components/Button.js';
import { GameCard } from '../../ui/components/GameCard.js';
import { StatRow } from '../../ui/components/StatRow.js';
import { ScreenFrame } from '../../ui/layout/ScreenFrame.js';
import { BottomActionBar } from '../../ui/layout/BottomActionBar.js';
import { ScrollRegion } from '../../ui/layout/ScrollRegion.js';
import { MISSIONS } from '../../game/mission/mission-definitions.js';
import { loadMissionState } from '../../game/mission/mission-store.js';
import type { MissionDefinition } from '../../game/mission/types.js';

export interface MissionBoardScreenProps {
  readonly onSelectMission: (mission: MissionDefinition) => void;
  readonly onBack: () => void;
}

const STATUS_LABELS: Readonly<Record<string, string>> = {
  locked: '🔒 Locked',
  available: '📋 Available',
  completed: '✅ Completed',
};

const DIFFICULTY_LABELS: Readonly<Record<string, string>> = {
  normal: 'Normal',
  hard: 'Hard',
  ascension: 'Ascension',
};

export function MissionBoardScreen({ onSelectMission, onBack }: MissionBoardScreenProps): JSX.Element {
  const [missionState] = useState(() => loadMissionState());

  const missionsWithStatus = useMemo(
    () =>
      MISSIONS.map((def) => {
        const prog = missionState.missions[def.id];
        return {
          definition: def,
          progress: prog ?? {
            missionId: def.id,
            status: 'locked' as const,
            bestGold: 0,
            completions: 0,
          },
        };
      }),
    [missionState],
  );

  return (
    <ScreenFrame labelledBy="missions-title">
      <h1 id="missions-title">Mission Board</h1>
      <ScrollRegion label="Missions">
        {missionsWithStatus.map(({ definition, progress }) => {
          const selectable = progress.status !== 'locked';
          return selectable ? (
            <GameCard
              key={definition.id}
              title={definition.id}
              state={progress.status === 'completed' ? 'selected' : 'default'}
              onSelect={() => onSelectMission(definition)}
            >
              <StatRow label="Status" value={STATUS_LABELS[progress.status] ?? progress.status} />
              <StatRow label="Difficulty" value={DIFFICULTY_LABELS[definition.difficulty] ?? definition.difficulty} />
              {progress.completions > 0 && (
                <StatRow label="Best gold" value={String(progress.bestGold)} />
              )}
            </GameCard>
          ) : (
            <GameCard key={definition.id} title={definition.id} state="locked">
              <StatRow label="Status" value={STATUS_LABELS[progress.status] ?? progress.status} />
              <StatRow label="Requires" value={definition.requiredMissions.join(', ')} />
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
