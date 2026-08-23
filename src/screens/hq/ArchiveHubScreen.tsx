/**
 * Archive hub screen (S25): central hub linking to codex, story archive,
 * records, and achievements. Acts as a directory page for the player's
 * accumulated knowledge.
 */
import { useMemo, type JSX } from 'react';
import { Button } from '../../ui/components/Button.js';
import { GameCard } from '../../ui/components/GameCard.js';
import { StatRow } from '../../ui/components/StatRow.js';
import { ScreenFrame } from '../../ui/layout/ScreenFrame.js';
import { ScrollRegion } from '../../ui/layout/ScrollRegion.js';
import { loadCodexState } from '../../game/codex/codex-store.js';
import { loadStoryArchiveState } from '../../game/story/story-store.js';
import { loadRecordsState } from '../../game/records/records-store.js';
import { loadAchievementState, achievementStats } from '../../game/achievements/achievement-store.js';

export type ArchiveSection = 'codexList' | 'storyArchive' | 'records' | 'achievements';

export interface ArchiveHubScreenProps {
  readonly onNavigate: (section: ArchiveSection) => void;
  readonly onBack: () => void;
}

const SECTIONS: readonly { readonly key: ArchiveSection; readonly label: string; readonly hint: string }[] = [
  { key: 'codexList', label: 'Codex', hint: 'Encyclopedia of discovered enemies, items, and relics' },
  { key: 'storyArchive', label: 'Story Archive', hint: 'Unlocked story fragments from expeditions' },
  { key: 'records', label: 'Records & Statistics', hint: 'Your expedition history and best runs' },
  { key: 'achievements', label: 'Achievements', hint: 'Tracked goals and milestones' },
];

export function ArchiveHubScreen({ onNavigate, onBack }: ArchiveHubScreenProps): JSX.Element {
  const codex = useMemo(() => loadCodexState(), []);
  const story = useMemo(() => loadStoryArchiveState(), []);
  const records = useMemo(() => loadRecordsState(), []);
  const achievements = useMemo(() => loadAchievementState(), []);
  const achStats = useMemo(() => achievementStats(achievements), [achievements]);

  const codexDiscovered = Object.values(codex.entries).filter((e) => e.discovered).length;
  const storyUnlocked = Object.values(story.fragments).filter((f) => f.unlocked).length;
  const storyTotal = Object.keys(story.fragments).length;

  return (
    <ScreenFrame labelledBy="archive-title">
      <h1 id="archive-title">Archive</h1>

      <StatRow label="Codex entries" value={String(codexDiscovered)} />
      <StatRow label="Stories unlocked" value={`${storyUnlocked} / ${storyTotal}`} />
      <StatRow label="Expeditions recorded" value={String(records.totalExpeditions)} />
      <StatRow label="Achievements earned" value={`${achStats.earned} / ${achStats.total}`} />

      <ScrollRegion label="Archive sections">
        {SECTIONS.map((section) => (
          <GameCard
            key={section.key}
            title={section.label}
            state="default"
            onSelect={() => onNavigate(section.key)}
          >
            <p>{section.hint}</p>
          </GameCard>
        ))}
      </ScrollRegion>

      <Button labelKey="ui.common.back" variant="secondary" onClick={onBack} />
    </ScreenFrame>
  );
}
