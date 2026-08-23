import { useCallback, useEffect, useState } from 'react';
import type { JSX } from 'react';
import { Button } from '../../ui/components/Button.js';
import { ResourcePill } from '../../ui/components/ResourcePill.js';
import { StatRow } from '../../ui/components/StatRow.js';
import { ScreenFrame } from '../../ui/layout/ScreenFrame.js';
import { BottomActionBar } from '../../ui/layout/BottomActionBar.js';
import { useExpedition } from '../../features/expedition/useExpedition.js';
import type { NodeActionRequest } from '../../game/expedition/nodes/types.js';

export interface NodeScreenProps {
  readonly onResolved: (next: 'map' | 'battleResult') => void;
  readonly nextHint?: 'map' | 'battleResult';
}

interface ActionDef {
  readonly action: string;
  readonly labelKey: string;
  readonly available: boolean;
  readonly descriptionKey?: string;
}

function actionsForType(type: string, snapshot: ReturnType<typeof useExpedition>['snapshot']): ActionDef[] {
  if (!snapshot) return [];
  const s = snapshot;
  const nodeSnap = s.state.snapshots[s.currentNodeId];

  switch (type) {
    case 'battle':
    case 'elite':
    case 'boss':
      return [
        { action: 'ENGAGE', labelKey: 'ui.expedition.engage', available: true },
        { action: 'DECLINE', labelKey: 'ui.common.decline', available: true },
      ];
    case 'event':
      if (nodeSnap?.kind === 'EVENT') {
        return [
          ...nodeSnap.options.map((opt) => ({
            action: 'CONFIRM',
            labelKey: `ui.event.${opt.optionId}`,
            available: opt.available,
          })),
          { action: 'DECLINE', labelKey: 'ui.common.decline', available: true },
        ];
      }
      return [{ action: 'DECLINE', labelKey: 'ui.common.decline', available: true }];
    case 'merchant':
      if (nodeSnap?.kind === 'OFFERS') {
        return [
          ...nodeSnap.offers.map((offer) => ({
            action: 'BUY',
            labelKey: `ui.merchant.${offer.offerId}`,
            available: s.gold >= offer.priceGold && offer.stock > 0,
            descriptionKey: `${String(offer.priceGold)} gold`,
          })),
          { action: 'DECLINE', labelKey: 'ui.common.decline', available: true },
        ];
      }
      return [{ action: 'DECLINE', labelKey: 'ui.common.decline', available: true }];
    case 'recruitment':
      if (nodeSnap?.kind === 'OFFERS') {
        return [
          ...nodeSnap.offers.map((offer) => ({
            action: 'CHOOSE',
            labelKey: `ui.recruit.${offer.offerId}`,
            available: true,
          })),
          { action: 'DECLINE', labelKey: 'ui.common.decline', available: true },
        ];
      }
      return [{ action: 'DECLINE', labelKey: 'ui.common.decline', available: true }];
    case 'treasure':
      return [{ action: 'TAKE', labelKey: 'ui.expedition.take', available: true }];
    case 'workshop':
      return [
        { action: 'POLISH', labelKey: 'ui.expedition.polish', available: s.gold >= 220, descriptionKey: 'Costs 220 gold' },
        { action: 'DECLINE', labelKey: 'ui.common.decline', available: true },
      ];
    case 'altar':
      return [
        { action: 'ACCEPT', labelKey: 'ui.expedition.accept', available: s.instability + 10 <= 100, descriptionKey: '+10 instability' },
        { action: 'DECLINE', labelKey: 'ui.common.decline', available: true },
      ];
    case 'scout':
      return [{ action: 'REVEAL_PATH', labelKey: 'ui.expedition.reveal', available: true }];
    case 'anchor':
      return [
        { action: 'SECURE', labelKey: 'ui.expedition.secure', available: s.unsecuredLoot.length > 0 },
        { action: 'SERVICE', labelKey: 'ui.expedition.service', available: s.gold >= 60, descriptionKey: 'Costs 60 gold' },
        { action: 'RETREAT', labelKey: 'ui.expedition.retreat', available: true },
        { action: 'DECLINE', labelKey: 'ui.common.decline', available: true },
      ];
    case 'story':
      return [{ action: 'CONTINUE', labelKey: 'ui.common.continue', available: true }];
    default:
      return [];
  }
}

export function NodeScreen({ onResolved, nextHint }: NodeScreenProps): JSX.Element {
  const { snapshot, enter, act, resolve } = useExpedition();
  const [phase, setPhase] = useState<'idle' | 'entering' | 'acting' | 'resolved'>('idle');
  const [enterTxId] = useState(() => `ui-${String(Date.now())}-${String(Math.random().toString(36).slice(2))}`);
  const [nextAfter, setNextAfter] = useState<'map' | 'battleResult'>(nextHint ?? 'map');
  const currentNodeType = snapshot?.currentNodeType ?? '';

  // Auto-enter when the screen mounts.
  useEffect(() => {
    if (phase === 'idle' && snapshot) {
      enter(enterTxId);
      setPhase('entering');
    }
  }, [phase, snapshot, enter, enterTxId]);

  // After enter commits, move to acting.
  useEffect(() => {
    if (phase === 'entering' && snapshot?.state.ledger[enterTxId]) {
      setPhase('acting');
    }
  }, [phase, snapshot, enterTxId]);

  const handleAction = useCallback((actionDef: ActionDef) => {
    if (!actionDef.available || !snapshot) return;
    const nodeId = snapshot.currentNodeId;
    const txId = `ui-act-${String(Date.now())}`;
    const request: NodeActionRequest = {
      transactionId: txId,
      nodeId,
      action: actionDef.action,
      ...(actionDef.action === 'CONFIRM' || actionDef.action === 'BUY' || actionDef.action === 'CHOOSE'
        ? { optionId: actionDef.labelKey }
        : {}),
    };
    act(request);
    // Resolve immediately after acting — single-action nodes complete here.
    resolve();
    setPhase('resolved');

    // Determine next screen: combat nodes go to battle result.
    const combatTypes = new Set(['battle', 'elite', 'boss']);
    setNextAfter(combatTypes.has(currentNodeType) ? 'battleResult' : 'map');
  }, [snapshot, act, resolve, currentNodeType]);

  const handleDone = useCallback(() => {
    onResolved(nextAfter);
  }, [onResolved, nextAfter]);

  if (!snapshot) {
    return (
      <ScreenFrame labelledBy="node-title">
        <h1 id="node-title">Node</h1>
        <p>No active expedition.</p>
      </ScreenFrame>
    );
  }

  const { gold, instability } = snapshot;
  const nodeActions = actionsForType(currentNodeType, snapshot);

  return (
    <ScreenFrame labelledBy="node-title">        <h1 id="node-title">{currentNodeType.charAt(0).toUpperCase() + currentNodeType.slice(1)} Node</h1>

      <div className="rw-expedition-resources">
        <ResourcePill icon="◆" value={gold} nameKey="ui.resource.gold" />
        <ResourcePill icon="⚠" value={instability} nameKey="ui.resource.instability" />
      </div>

      {phase === 'entering' && <p>Entering node…</p>}

      {phase === 'acting' && (
        <div className="rw-node-actions">
          <p>Choose your action:</p>
          {nodeActions.map((actionDef) => (
            <div key={actionDef.labelKey} className="rw-node-action">
              <Button
                labelKey={actionDef.labelKey}
                variant={actionDef.available ? 'primary' : 'secondary'}
                disabled={!actionDef.available}
                onClick={() => handleAction(actionDef)}
              />
              {actionDef.descriptionKey && (
                <span className="rw-node-action-desc">{actionDef.descriptionKey}</span>
              )}
            </div>
          ))}
        </div>
      )}

      {phase === 'resolved' && (
        <>
          <p>Action complete.</p>
          <BottomActionBar>
            <Button labelKey="ui.common.back_to_map" variant="primary" onClick={handleDone} />
          </BottomActionBar>
        </>
      )}

      <StatRow label="Gold" value={String(gold)} />
      <StatRow label="Instability" value={String(instability)} />
      <StatRow label="Secured Loot" value={String(snapshot.securedLoot.length)} />
      <StatRow label="Unsecured Loot" value={String(snapshot.unsecuredLoot.length)} />
    </ScreenFrame>
  );
}
