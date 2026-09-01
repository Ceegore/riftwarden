/**
 * Constellation screen (S33): visual meta-progression map showing
 * connected nodes the player unlocks with ascension points. Each node
 * grants a small permanent stat bonus or ability unlock.
 */
import { useMemo, type JSX } from 'react';
import { Button } from '../../ui/components/Button.js';
import { GameCard } from '../../ui/components/GameCard.js';
import { StatRow } from '../../ui/components/StatRow.js';
import { ScreenFrame } from '../../ui/layout/ScreenFrame.js';
import { ScrollRegion } from '../../ui/layout/ScrollRegion.js';

export interface ConstellationScreenProps {
  readonly onBack: () => void;
}

interface ConstellationNode {
  readonly id: string;
  readonly nameKey: string;
  readonly effectKey: string;
  readonly costPoints: number;
  readonly unlocked: boolean;
  readonly connectedFrom: readonly string[];
}

function loadConstellation(): readonly ConstellationNode[] {
  return [
    { id: 'star_center',   nameKey: 'const.center',   effectKey: '+5% Gold',          costPoints: 1, unlocked: false, connectedFrom: [] },
    { id: 'star_might',    nameKey: 'const.might',    effectKey: '+3% Damage',        costPoints: 2, unlocked: false, connectedFrom: ['star_center'] },
    { id: 'star_ward',     nameKey: 'const.ward',     effectKey: '+3% Defense',       costPoints: 2, unlocked: false, connectedFrom: ['star_center'] },
    { id: 'star_swift',    nameKey: 'const.swift',    effectKey: '+2% Speed',         costPoints: 2, unlocked: false, connectedFrom: ['star_center'] },
    { id: 'star_forge',    nameKey: 'const.forge',    effectKey: 'Item drop +5%',     costPoints: 3, unlocked: false, connectedFrom: ['star_might'] },
    { id: 'star_vault',    nameKey: 'const.vault',    effectKey: '+1 relic slot',     costPoints: 3, unlocked: false, connectedFrom: ['star_ward'] },
    { id: 'star_eye',      nameKey: 'const.eye',      effectKey: 'Map reveal +1',     costPoints: 3, unlocked: false, connectedFrom: ['star_swift'] },
    { id: 'star_apex',     nameKey: 'const.apex',     effectKey: '+1 hero slot',     costPoints: 5, unlocked: false, connectedFrom: ['star_forge', 'star_vault', 'star_eye'] },
  ];
}

export function ConstellationScreen({ onBack }: ConstellationScreenProps): JSX.Element {
  const nodes = useMemo(() => loadConstellation(), []);

  return (
    <ScreenFrame labelledBy="const-title">
      <h1 id="const-title">Constellation</h1>
      <p>Spend ascension points to unlock permanent bonuses.</p>

      <ScrollRegion label="Constellation nodes">
        {nodes.map((node) => (
          <GameCard
            key={node.id}
            title={node.nameKey}
            state={node.unlocked ? 'selected' : node.connectedFrom.some((c) => nodes.find((n) => n.id === c)?.unlocked) ? 'new' : 'locked'}
          >
            <StatRow label="Effect" value={node.effectKey} />
            <StatRow label="Cost" value={`${String(node.costPoints)} points`} />
            {node.connectedFrom.length > 0 && (
              <StatRow label="Requires" value={node.connectedFrom.join(', ')} />
            )}
          </GameCard>
        ))}
      </ScrollRegion>

      <Button labelKey="ui.common.back" variant="secondary" onClick={onBack} />
    </ScreenFrame>
  );
}
