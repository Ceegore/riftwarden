/**
 * Codex details screen (S27): detailed view of a single codex entry
 * showing category, discovery date, and encounter count.
 */
import { useMemo, type JSX } from 'react';
import { Button } from '../../ui/components/Button.js';
import { StatRow } from '../../ui/components/StatRow.js';
import { ScreenFrame } from '../../ui/layout/ScreenFrame.js';
import { loadCodexState } from '../../game/codex/codex-store.js';
import type { CodexCategory } from '../../game/codex/types.js';

const CATEGORY_LABELS: Record<CodexCategory, string> = {
  enemy: 'Enemy',
  item: 'Item',
  relic: 'Relic',
  nodeType: 'Node Type',
  hero: 'Hero',
  troop: 'Troop',
};

export interface CodexDetailsScreenProps {
  readonly entryId: string;
  readonly onBack: () => void;
}

export function CodexDetailsScreen({ entryId, onBack }: CodexDetailsScreenProps): JSX.Element {
  const state = useMemo(() => loadCodexState(), []);
  const entry = state.entries[entryId];

  if (!entry?.discovered) {
    return (
      <ScreenFrame labelledBy="codex-detail-title">
        <h1 id="codex-detail-title">Not Found</h1>
        <p>This codex entry has not been discovered yet.</p>
        <Button labelKey="ui.common.back" variant="secondary" onClick={onBack} />
      </ScreenFrame>
    );
  }

  return (
    <ScreenFrame labelledBy="codex-detail-title">
      <h1 id="codex-detail-title">{entry.id}</h1>

      <StatRow label="Category" value={CATEGORY_LABELS[entry.category]} />
      <StatRow label="Times encountered" value={String(entry.timesEncountered)} />
      {entry.discoveredAt ? (
        <StatRow
          label="First discovered"
          value={new Date(entry.discoveredAt).toLocaleDateString()}
        />
      ) : null}

      <p>
        Discovered through {entry.timesEncountered} encounter{entry.timesEncountered !== 1 ? 's' : ''}.
      </p>

      <Button labelKey="ui.common.back" variant="secondary" onClick={onBack} />
    </ScreenFrame>
  );
}
