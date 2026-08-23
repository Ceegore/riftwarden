/**
 * Story archive screen (S30): browse unlocked story fragments from
 * completed expeditions.
 */
import { useMemo, type JSX } from 'react';
import { Button } from '../../ui/components/Button.js';
import { GameCard } from '../../ui/components/GameCard.js';
import { StatRow } from '../../ui/components/StatRow.js';
import { ScreenFrame } from '../../ui/layout/ScreenFrame.js';
import { ScrollRegion } from '../../ui/layout/ScrollRegion.js';
import { loadStoryArchiveState } from '../../game/story/story-store.js';

export interface StoryArchiveScreenProps {
  readonly onBack: () => void;
}

export function StoryArchiveScreen({ onBack }: StoryArchiveScreenProps): JSX.Element {
  const state = useMemo(() => loadStoryArchiveState(), []);
  const fragments = Object.values(state.fragments);

  const unlocked = fragments.filter((f) => f.unlocked);
  const locked = fragments.filter((f) => !f.unlocked);

  return (
    <ScreenFrame labelledBy="story-title">
      <h1 id="story-title">Story Archive</h1>
      <p>Fragments of history discovered during expeditions.</p>

      <StatRow
        label="Unlocked"
        value={`${unlocked.length} / ${fragments.length}`}
      />

      <ScrollRegion label="Story fragments">
        {unlocked.length === 0 && locked.length === 0 ? (
          <p>No story fragments available.</p>
        ) : null}

        {unlocked.map((frag) => (
          <GameCard
            key={frag.id}
            title={frag.titleKey}
            state="default"
          >
            <p>{frag.bodyKey}</p>
            <StatRow label="Mission" value={frag.missionId} />
            {frag.unlockedAt ? (
              <small>Unlocked {new Date(frag.unlockedAt).toLocaleDateString()}</small>
            ) : null}
          </GameCard>
        ))}

        {locked.map((frag) => (
          <GameCard
            key={frag.id}
            title="???"
            state="locked"
          >
            <p>Complete {frag.missionId} to unlock this fragment.</p>
          </GameCard>
        ))}
      </ScrollRegion>

      <Button labelKey="ui.common.back" variant="secondary" onClick={onBack} />
    </ScreenFrame>
  );
}
