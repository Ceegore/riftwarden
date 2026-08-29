import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { JSX } from 'react';
import { Button } from '../../ui/components/Button.js';
import { ResourcePill } from '../../ui/components/ResourcePill.js';
import { StatRow } from '../../ui/components/StatRow.js';
import { ScreenFrame } from '../../ui/layout/ScreenFrame.js';
import { BottomActionBar } from '../../ui/layout/BottomActionBar.js';
import { useExpedition } from '../../features/expedition/useExpedition.js';
import { BattleCanvas } from '../../features/battle/BattleCanvas.js';
import { BattleTacticalView } from '../../features/battle/BattleTacticalView.js';
import { LiveBattleOutboundPanel } from '../../features/battle/outbound/LiveBattleOutboundPanel.js';
import type { LiveOutboundInput } from '../../features/battle/outbound/phase21-outbound-presenter.js';
import { createSimBattleHost, resolveExpeditionEncounter } from '../../features/battle/sim/sim-battle-host.js';
import { loadA11ySettings } from '../../game/settings/a11y-settings.js';
import type { UnitRenderData } from '../../features/battle/battle-renderer.js';
import type { NodeActionRequest } from '../../game/expedition/nodes/types.js';
import { applyNodeCodexDiscovery } from '../../game/expedition/settlement-bridge.js';
import { loadCodexState, saveCodexState } from '../../game/codex/codex-store.js';
import { actionTransactionId, enterTransactionId } from '../../features/expedition/transaction-ids.js';

export interface NodeScreenProps {
  readonly onResolved: (next: 'map' | 'battleResult') => void;
  readonly nextHint?: 'map' | 'battleResult';
}

interface ActionDef {
  readonly action: string;
  readonly labelKey?: string;
  readonly label?: string;
  readonly optionId?: string;
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
            optionId: opt.optionId,
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
            label: offer.labelKey,
            optionId: offer.offerId,
            available: s.gold >= offer.priceGold && offer.stock > 0,
            descriptionKey: `${String(offer.priceGold)} gold`,
          })),
          { action: 'REROLL', labelKey: 'ui.expedition.reroll', available: s.gold >= 40 && nodeSnap.rerollsUsed < 1, descriptionKey: 'Costs 40 gold' },
          { action: 'SERVICE', labelKey: 'ui.expedition.service', available: s.gold >= 30, descriptionKey: 'Costs 30 gold' },
          { action: 'DECLINE', labelKey: 'ui.common.decline', available: true },
        ];
      }
      return [{ action: 'DECLINE', labelKey: 'ui.common.decline', available: true }];
    case 'recruitment':
      if (nodeSnap?.kind === 'OFFERS') {
        return [
          ...nodeSnap.offers.map((offer) => {
            const copies = offer.troopTypeId === undefined
              ? 0
              : (s.state.troopCopies[offer.troopTypeId] ?? 0) + s.state.recruits.filter((id) => id === offer.troopTypeId).length;
            return {
              action: 'CHOOSE',
              label: offer.labelKey,
              optionId: offer.offerId,
              available: s.gold >= offer.priceGold && copies < 3,
              descriptionKey: `${String(offer.priceGold)} gold`,
            };
          }),
          { action: 'DECLINE', labelKey: 'ui.common.decline', available: true },
        ];
      }
      return [{ action: 'DECLINE', labelKey: 'ui.common.decline', available: true }];
    case 'treasure':
      return [{ action: 'TAKE', labelKey: 'ui.expedition.take', available: true }];
    case 'workshop':
      return [
        { action: 'POLISH', labelKey: 'ui.expedition.polish', available: s.gold >= 220, descriptionKey: 'Costs 220 gold' },
        { action: 'REPAIR', labelKey: 'ui.expedition.repair', available: s.gold >= 150, descriptionKey: 'Costs 150 gold' },
        { action: 'DECLINE', labelKey: 'ui.common.decline', available: true },
      ];
    case 'altar':
      return [
        { action: 'ACCEPT', labelKey: 'ui.expedition.accept', available: s.instability + 10 <= 100, descriptionKey: '+10 instability' },
        { action: 'DECLINE', labelKey: 'ui.common.decline', available: true },
      ];
    case 'scout':
      return [
        { action: 'REVEAL_PATH', labelKey: 'ui.expedition.reveal', available: true },
        { action: 'REVEAL_REWARD', labelKey: 'ui.expedition.reveal_reward', available: true },
      ];
    case 'anchor':
      return [
        { action: 'SECURE', labelKey: 'ui.expedition.secure', available: s.unsecuredLoot.length > 0 },
        { action: 'SERVICE', labelKey: 'ui.expedition.service', available: s.gold >= 30, descriptionKey: 'Costs 30 gold' },
        { action: 'RETREAT', labelKey: 'ui.expedition.retreat', available: true },
        { action: 'DECLINE', labelKey: 'ui.common.decline', available: true },
      ];
    case 'story':
      return [{ action: 'CONTINUE', labelKey: 'ui.common.continue', available: true }];
    default:
      return [];
  }
}

function codexHints(snapshot: NonNullable<ReturnType<typeof useExpedition>['snapshot']>): readonly string[] {
  const nodeSnapshot = snapshot.state.snapshots[snapshot.currentNodeId];
  const hints: string[] = [];
  if (nodeSnapshot?.kind === 'OFFERS') {
    for (const offer of nodeSnapshot.offers) {
      if (offer.rewardId) hints.push(offer.rewardId);
      if (offer.troopTypeId) hints.push(`troop_${offer.troopTypeId}`);
    }
  }
  if (nodeSnapshot?.kind === 'REWARD') hints.push(...nodeSnapshot.rewardIds);
  if (snapshot.currentNodeType === 'battle' || snapshot.currentNodeType === 'elite' || snapshot.currentNodeType === 'boss') {
    hints.push(`enemy_${snapshot.currentNodePayloadKey}`);
  }
  if (snapshot.currentNodeType === 'treasure') {
    hints.push(`item_treasure:${snapshot.currentNodeId}`);
  }
  return hints.filter((hint) => hint.length > 0);
}

function discoverNodeInCodex(snapshot: NonNullable<ReturnType<typeof useExpedition>['snapshot']>): void {
  try {
    let codex = applyNodeCodexDiscovery(loadCodexState(), snapshot.currentNodeType);
    const hints = codexHints(snapshot);
    for (const hint of hints) {
      codex = applyNodeCodexDiscovery(codex, snapshot.currentNodeType, hint, false);
    }
    saveCodexState(codex);
  } catch {
    // Codex discovery is best-effort; never blocks gameplay.
  }
}

function battleUnits(snapshot: NonNullable<ReturnType<typeof useExpedition>['snapshot']>): readonly UnitRenderData[] {
  const s = snapshot.state;
  const enemyCount = snapshot.currentNodeType === 'boss' ? 3 : snapshot.currentNodeType === 'elite' ? 3 : 2;

  // Allies: troop copies + recruits from the run state.
  const troopIds = Object.keys(s.troopCopies).filter((id) => (s.troopCopies[id] ?? 0) > 0);
  const allyCount = Math.min(3, Math.max(1, troopIds.length + s.recruits.length));
  const units: UnitRenderData[] = [];
  for (let index = 0; index < allyCount; index += 1) {
    const troopId = troopIds[index];
    const label = troopId ?? `Ally ${String(index + 1)}`;
    units.push({ id: `ally-${String(index)}`, label, hp: 100, maxHp: 100, side: 'ally', x: 120 + index * 72, y: 250 });
  }

  const enemyLabel = snapshot.currentNodePayloadKey !== ''
    ? snapshot.currentNodePayloadKey
    : snapshot.currentNodeType;
  for (let index = 0; index < enemyCount; index += 1) {
    units.push({ id: `enemy-${String(index)}`, label: `${enemyLabel} ${String(index + 1)}`, hp: 100, maxHp: 100, side: 'enemy', x: 460 + index * 72, y: 250 });
  }
  return units;
}

export function NodeScreen({ onResolved, nextHint }: NodeScreenProps): JSX.Element {
  const { snapshot, enter, act, resolve } = useExpedition();
  const [actionError, setActionError] = useState<string | null>(null);
  const enterRequested = useRef(false);
  const discoveryApplied = useRef(false);
  const currentNodeType = snapshot?.currentNodeType ?? '';
  const enterTxId = snapshot === null ? '' : enterTransactionId(snapshot.state.runId, snapshot.currentNodeId);
  const enterCommitted = snapshot?.state.ledger[enterTxId]?.status === 'COMMITTED';
  const committedAction = snapshot === null
    ? undefined
    : Object.values(snapshot.state.ledger).find(
      (entry) => entry.nodeId === snapshot.currentNodeId && entry.status === 'COMMITTED' && entry.action !== 'ENTER',
    );
  const phase = snapshot === null || !enterCommitted
    ? 'entering'
    : committedAction === undefined
      ? 'acting'
      : 'resolved';
  const nextAfter: 'map' | 'battleResult' = committedAction?.action === 'ENGAGE'
    ? 'battleResult'
    : nextHint ?? 'map';

  useEffect(() => {
    if (snapshot !== null && !enterCommitted && !enterRequested.current) {
      enterRequested.current = true;
      enter(enterTxId);
    }
  }, [enter, enterCommitted, enterTxId, snapshot]);

  useEffect(() => {
    if (snapshot !== null && enterCommitted && !discoveryApplied.current) {
      discoveryApplied.current = true;
      discoverNodeInCodex(snapshot);
    }
  }, [enterCommitted, snapshot]);

  const handleAction = useCallback((actionDef: ActionDef) => {
    if (!actionDef.available || snapshot === null) return;
    const nodeId = snapshot.currentNodeId;
    const optionKey = actionDef.optionId ?? 'none';
    const txId = actionTransactionId(snapshot.state.runId, nodeId, actionDef.action, optionKey);
    const request: NodeActionRequest = {
      transactionId: txId,
      nodeId,
      action: actionDef.action,
      ...(actionDef.optionId === undefined ? {} : { optionId: actionDef.optionId }),
    };
    try {
      const outcome = act(request);
      if (outcome?.status !== 'COMMITTED') {
        setActionError(outcome?.reason ?? 'Action rejected');
        return;
      }
      const keepsRewardPending = actionDef.action === 'ENGAGE' && ['battle', 'elite', 'boss'].includes(currentNodeType);
      if (!keepsRewardPending) resolve();
      setActionError(null);
    } catch {
      setActionError('Action unavailable');
    }
  }, [act, currentNodeType, resolve, snapshot]);

  const handleDone = useCallback(() => {
    onResolved(nextAfter);
  }, [nextAfter, onResolved]);

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
  const combat = currentNodeType === 'battle' || currentNodeType === 'elite' || currentNodeType === 'boss';
  const reducedMotion = loadA11ySettings().reducedMotion;
  // §9 live outbound feed: run the REAL kernel battle for the node's encounter
  // (via the sim battle host) and feed its boss phase, modifier hook log and
  // canonical events into the live bridge. When the node cannot resolve to a
  // fixture encounter (e.g. non-battle nodes), the honest stand-in surface is
  // kept — the expedition does not own a battle sim state machine yet.
  const nodePayloadKey = snapshot?.currentNodePayloadKey ?? '';
  const nodeId = snapshot?.currentNodeId ?? '';
  const liveOutbound = useMemo<LiveOutboundInput>(() => {
    const fallback: LiveOutboundInput = Object.freeze({
      encounterId: nodeId,
      objective: currentNodeType === 'boss' || currentNodeType === 'elite' ? 'defeat_boss' : 'defeat_all',
      tick: 0,
      phase: Object.freeze({ phase: 'ACTIVE', endReason: null }),
      bossPhase: null,
      modifierHookLog: Object.freeze([]),
      events: Object.freeze([]),
    });
    const encounter = resolveExpeditionEncounter(currentNodeType, nodePayloadKey);
    if (encounter === null) return fallback;
    try {
      return createSimBattleHost({ encounter }).run();
    } catch {
      // A content-launch error must never block the expedition screen.
      return fallback;
    }
  }, [currentNodeType, nodePayloadKey, nodeId]);

  return (
    <ScreenFrame labelledBy="node-title">
      <h1 id="node-title">{currentNodeType.charAt(0).toUpperCase() + currentNodeType.slice(1)} Node</h1>

      <div className="rw-expedition-resources">
        <ResourcePill icon="◆" value={gold} nameKey="ui.resource.gold" />
        <ResourcePill icon="⚠" value={instability} nameKey="ui.resource.instability" />
      </div>

      {combat && phase !== 'resolved' && (
        reducedMotion
          ? <BattleTacticalView units={battleUnits(snapshot)} />
          : <BattleCanvas units={battleUnits(snapshot)} />
      )}
      {combat && phase !== 'resolved' && <LiveBattleOutboundPanel input={liveOutbound} />}
      {phase === 'entering' && <p>Entering node...</p>}

      {phase === 'acting' && (
        <div className="rw-node-actions">
          {actionError && <p role="alert">{actionError}</p>}
          <p>Choose your action:</p>
          {nodeActions.map((actionDef) => (
            <div key={`${actionDef.action}-${actionDef.optionId ?? actionDef.labelKey ?? actionDef.label ?? actionDef.action}`} className="rw-node-action">
              <Button
                {...(actionDef.labelKey !== undefined ? { labelKey: actionDef.labelKey } : {})}
                {...(actionDef.label !== undefined ? { label: actionDef.label } : {})}
                variant={actionDef.available ? 'primary' : 'secondary'}
                disabled={!actionDef.available}
                onClick={() => { handleAction(actionDef); }}
              />
              {actionDef.descriptionKey && <span className="rw-node-action-desc">{actionDef.descriptionKey}</span>}
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
