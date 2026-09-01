/**
 * Endless checkpoint screen (S57): displayed between endless mode waves.
 * Shows wave summary, rewards accumulated, and options to continue or
 * cash out (retreat with secured loot).
 */
import type { JSX } from 'react';
import { Button } from '../../ui/components/Button.js';
import { ResourcePill } from '../../ui/components/ResourcePill.js';
import { StatRow } from '../../ui/components/StatRow.js';
import { ScreenFrame } from '../../ui/layout/ScreenFrame.js';
import { BottomActionBar } from '../../ui/layout/BottomActionBar.js';
import { useExpedition } from '../../features/expedition/useExpedition.js';

export interface EndlessCheckpointScreenProps {
  readonly onContinue: () => void;
  readonly onRetreat: () => void;
  readonly waveNumber: number;
}

export function EndlessCheckpointScreen({ onContinue, onRetreat, waveNumber }: EndlessCheckpointScreenProps): JSX.Element {
  const { snapshot } = useExpedition();

  const gold = snapshot?.gold ?? 0;
  const instability = snapshot?.instability ?? 0;
  const securedLoot = snapshot?.securedLoot.length ?? 0;
  const unsecuredLoot = snapshot?.unsecuredLoot.length ?? 0;

  return (
    <ScreenFrame labelledBy="checkpoint-title">
      <h1 id="checkpoint-title">Wave {String(waveNumber)} Complete</h1>

      <div className="rw-expedition-resources">
        <ResourcePill icon="◆" value={gold} nameKey="ui.resource.gold" />
        <ResourcePill icon="⚠" value={instability} nameKey="ui.resource.instability" />
      </div>

      <StatRow label="Wave" value={`${String(waveNumber)} cleared`} />
      <StatRow label="Secured loot" value={String(securedLoot)} />
      <StatRow label="Unsecured loot" value={String(unsecuredLoot)} />

      <p>The next wave will be harder. You can retreat now and keep secured loot and gold, or continue for greater rewards — but risk losing unsecured items.</p>

      <BottomActionBar>
        <Button labelKey="ui.common.continue" variant="primary" onClick={onContinue} />
        <Button labelKey="ui.expedition.retreat" variant="secondary" onClick={onRetreat} />
      </BottomActionBar>
    </ScreenFrame>
  );
}
