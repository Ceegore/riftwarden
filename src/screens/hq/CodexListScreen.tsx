/**
 * Codex list screen (S26): browseable encyclopedia of discovered
 * entities organized by category.
 */
import { useMemo, useState, type JSX } from 'react';
import { Button } from '../../ui/components/Button.js';
import { GameCard } from '../../ui/components/GameCard.js';
import { StatRow } from '../../ui/components/StatRow.js';
import { ScreenFrame } from '../../ui/layout/ScreenFrame.js';
import { ScrollRegion } from '../../ui/layout/ScrollRegion.js';
import { loadCodexState } from '../../game/codex/codex-store.js';
import type { CodexCategory } from '../../game/codex/types.js';

const CATEGORY_LABELS: Record<CodexCategory, string> = {
  enemy: 'Enemies',
  item: 'Items',
  relic: 'Relics',
  nodeType: 'Node Types',
  hero: 'Heroes',
  troop: 'Troops',
};

export interface CodexListScreenProps {
  readonly onSelectEntry: (entryId: string) => void;
  readonly onBack: () => void;
}

export function CodexListScreen({ onSelectEntry, onBack }: CodexListScreenProps): JSX.Element {
  const state = useMemo(() => loadCodexState(), []);
  const [filter, setFilter] = useState<CodexCategory | 'all'>('all');

  const entries = useMemo(() => {
    const all = Object.values(state.entries);
    if (filter === 'all') return all.filter((e) => e.discovered);
    return all.filter((e) => e.discovered && e.category === filter);
  }, [state, filter]);

  const allCategories: readonly (CodexCategory | 'all')[] = ['all', 'enemy', 'item', 'relic', 'nodeType', 'hero', 'troop'];

  return (
    <ScreenFrame labelledBy="codex-title">
      <h1 id="codex-title">Codex</h1>

      <div role="tablist" aria-label="Category filter" style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {allCategories.map((cat) => (
          <Button
            key={cat}
            labelKey={`ui.codex.filter.${cat}`}
            variant={filter === cat ? 'primary' : 'secondary'}
            onClick={() => setFilter(cat)}
          />
        ))}
      </div>

      <ScrollRegion label="Codex entries">
        {entries.length === 0 ? (
          <p>No entries discovered yet. Explore expeditions to fill your codex.</p>
        ) : (
          entries.map((entry) => (
            <GameCard
              key={entry.id}
              title={entry.id}
              state="default"
              onSelect={() => onSelectEntry(entry.id)}
            >
              <StatRow label="Category" value={CATEGORY_LABELS[entry.category]} />
              <StatRow label="Encounters" value={String(entry.timesEncountered)} />
            </GameCard>
          ))
        )}
      </ScrollRegion>

      <StatRow label="Total discovered" value={String(Object.values(state.entries).filter((e) => e.discovered).length)} />

      <Button labelKey="ui.common.back" variant="secondary" onClick={onBack} />
    </ScreenFrame>
  );
}
