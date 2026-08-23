import { useCallback, useState } from 'react';
import type { JSX } from 'react';
import { Button } from '../../ui/components/Button.js';
import { GameCard } from '../../ui/components/GameCard.js';
import { ResourcePill } from '../../ui/components/ResourcePill.js';
import { StatRow } from '../../ui/components/StatRow.js';
import { ScreenFrame } from '../../ui/layout/ScreenFrame.js';
import { BottomActionBar } from '../../ui/layout/BottomActionBar.js';
import { ScrollRegion } from '../../ui/layout/ScrollRegion.js';
import { useExpedition } from '../../features/expedition/useExpedition.js';
import type { NodeId } from '../../game/expedition/types.js';

function nodeLabel(type: string): string {
  const labels: Record<string, string> = {
    battle: 'Battle', elite: 'Elite', boss: 'Boss',
    event: 'Event', merchant: 'Merchant', treasure: 'Treasure',
    recruitment: 'Recruitment', workshop: 'Workshop', altar: 'Altar',
    scout: 'Scout', anchor: 'Anchor', story: 'Story', start: 'Start',
  };
  return labels[type] ?? type;
}

export function DungeonMapScreen(): JSX.Element {
  const { snapshot, map, mainPathNodes, advance, finish, abandon, newRun, loading } = useExpedition();
  const [selectedNode, setSelectedNode] = useState<NodeId | null>(null);

  const handleStart = useCallback(() => newRun(Date.now()), [newRun]);

  const handleAdvance = useCallback(() => {
    if (!selectedNode || !snapshot) return;
    if (snapshot.runStatus === 'active') {
      advance(selectedNode);
      setSelectedNode(null);
    }
  }, [selectedNode, snapshot, advance]);

  const handleFinish = useCallback(() => finish(), [finish]);
  const handleAbandon = useCallback(() => abandon(), [abandon]);

  if (!map || !snapshot) {
    return (
      <ScreenFrame labelledBy="expedition-title">
        <h1 id="expedition-title">Expedition</h1>
        <p>No active expedition. Start a new run or continue a saved one.</p>
        <Button labelKey="ui.common.start" variant="primary" onClick={handleStart} disabled={loading} />
      </ScreenFrame>
    );
  }

  const current = snapshot.currentNodeId;
  const reachable = new Set(snapshot.reachableNodes);

  return (
    <ScreenFrame labelledBy="expedition-title">
      <h1 id="expedition-title">Expedition Map</h1>

      <div className="rw-expedition-resources">
        <ResourcePill icon="◆" value={snapshot.gold} nameKey="ui.resource.gold" />
        <ResourcePill icon="⚠" value={snapshot.instability} nameKey="ui.resource.instability" />
      </div>

      <ScrollRegion label="Expedition path">
        <div className="rw-expedition-path">
          {mainPathNodes.map((nodeId, index) => {
            const node = map.nodes.find((n) => n.id === nodeId);
            if (!node) return null;
            const isCurrent = nodeId === current;
            const isReachable = reachable.has(nodeId);
            const selectable = isReachable && !isCurrent;
            return selectable ? (
              <GameCard
                key={nodeId}
                title={`${String(index + 1)}. ${nodeLabel(node.type)}`}
                state="default"
                onSelect={() => setSelectedNode(nodeId)}
              >
                <StatRow label="Type" value={nodeLabel(node.type)} />
                <StatRow label="Level" value={String(node.level)} />
              </GameCard>
            ) : (
              <GameCard
                key={nodeId}
                title={`${String(index + 1)}. ${nodeLabel(node.type)}`}
                state={isCurrent ? 'selected' : 'locked'}
              >
                <StatRow label="Type" value={nodeLabel(node.type)} />
                <StatRow label="Level" value={String(node.level)} />
              </GameCard>
            );
          })}
        </div>
      </ScrollRegion>

      {snapshot.runStatus === 'finished' ? (
        <BottomActionBar>
          <Button labelKey="ui.common.exit" variant="primary" onClick={handleAbandon} />
        </BottomActionBar>
      ) : (
        <BottomActionBar>
          {selectedNode !== null && (
            <Button labelKey="ui.common.advance" variant="primary" onClick={handleAdvance} />
          )}
          <Button labelKey="ui.common.finish" variant="secondary" onClick={handleFinish} />
        </BottomActionBar>
      )}
    </ScreenFrame>
  );
}
