/**
 * Records & Statistics screen (S29): displays the player's expedition
 * history, best runs, and aggregate statistics.
 */
import { useMemo, type JSX } from 'react';
import { Button } from '../../ui/components/Button.js';
import { GameCard } from '../../ui/components/GameCard.js';
import { StatRow } from '../../ui/components/StatRow.js';
import { ScreenFrame } from '../../ui/layout/ScreenFrame.js';
import { ScrollRegion } from '../../ui/layout/ScrollRegion.js';
import { loadRecordsState } from '../../game/records/records-store.js';

export interface RecordsStatisticsScreenProps {
  readonly onBack: () => void;
}

export function RecordsStatisticsScreen({ onBack }: RecordsStatisticsScreenProps): JSX.Element {
  const records = useMemo(() => loadRecordsState(), []);

  return (
    <ScreenFrame labelledBy="records-title">
      <h1 id="records-title">Records &amp; Statistics</h1>

      <section>
        <h2>Career</h2>
        <StatRow label="Total expeditions" value={String(records.totalExpeditions)} />
        <StatRow label="Victories" value={String(records.totalVictories)} />
        <StatRow label="Defeats" value={String(records.totalDefeats)} />
        <StatRow label="Win rate" value={
          records.totalExpeditions > 0
            ? `${String(Math.round((records.totalVictories / records.totalExpeditions) * 100))}%`
            : '—'
        } />
      </section>

      <section>
        <h2>Economy</h2>
        <StatRow label="Total gold earned" value={String(records.totalGoldEarned)} />
        <StatRow label="Best single run" value={String(records.bestGoldRun)} />
        <StatRow label="Total kills" value={String(records.totalKills)} />
        <StatRow label="Nodes visited" value={String(records.totalNodesVisited)} />
      </section>

      {Object.keys(records.recordsPerMission).length > 0 ? (
        <section>
          <h2>Per Mission</h2>
          {Object.entries(records.recordsPerMission).map(([id, rec]) => (
            <StatRow key={id} label={id} value={`Best: ${String(rec.bestGold)}g · ${String(rec.completions)}×`} />
          ))}
        </section>
      ) : null}

      <section>
        <h2>Recent Runs</h2>
        <ScrollRegion label="Recent expeditions">
          {records.recentRuns.length === 0 ? (
            <p>No expeditions completed yet.</p>
          ) : (
            records.recentRuns.map((run, i) => (
              <GameCard
                key={`${String(run.timestamp)}-${String(i)}`}
                title={run.missionId}
                state={run.result === 'victory' ? 'selected' : 'default'}
              >
                <StatRow label="Result" value={run.result} />
                <StatRow label="Gold" value={String(run.goldEarned)} />
                <StatRow label="Nodes" value={String(run.nodesVisited)} />
                <small>{new Date(run.timestamp).toLocaleDateString()}</small>
              </GameCard>
            ))
          )}
        </ScrollRegion>
      </section>

      <Button labelKey="ui.common.back" variant="secondary" onClick={onBack} />
    </ScreenFrame>
  );
}
