/**
 * Run manager (RUN_MANAGER_CONTRACT): bridges the immutable ExpeditionRunner
 * with a mutable, autosaving facade for React. The manager owns the map and
 * runner; every mutation persists through the store and notifies subscribers.
 */
import { generateMap } from './map-generator.js';
import { createAndSaveExpedition, hasStoredExpedition, restoreStoredExpedition, saveExpedition, clearStore, readMeta } from './expedition-store.js';
import { restoreExpedition, type ExpeditionRunner } from './expedition-runner.js';
import type { NodeActionRequest, NodeRunState, TransactionRecord } from './nodes/types.js';
import type { ExpeditionMap, MapProfile, NodeId, NodeType } from './types.js';
import { recordCombatMasteryKills, trackingHeroIds } from './settlement-bridge.js';
import { REGION_PROFILES } from '../content/runtime/region-profiles.js';

type Listener = () => void;

const activeListeners = new Set<() => void>();

function notifyActiveListeners(): void {
  for (const listener of activeListeners) listener();
}

const DEFAULT_PROFILE: MapProfile = {
  id: 'expedition.act1.standard',
  logicalLevels: 6,
  targetVisited: [5, 8] as const,
  mandatoryRoles: ['anchor', 'preparation', 'boss'],
  attemptCap: 50,
  fallbackTemplateId: 'fallback.v1',
};

export interface RunSnapshot {
  readonly state: NodeRunState;
  readonly currentNodeId: NodeId;
  readonly currentNodeType: NodeType;
  readonly currentNodePayloadKey: string;
  readonly reachableNodes: readonly NodeId[];
  readonly runStatus: 'active' | 'finished';
  readonly gold: number;
  readonly instability: number;
  readonly killsEarned: number;
  readonly securedLoot: readonly string[];
  readonly unsecuredLoot: readonly string[];
}

let instance: RunManager | null = null;

export class RunManager {
  private runner: ExpeditionRunner;
  readonly map: ExpeditionMap;
  private readonly listeners = new Set<Listener>();

  private constructor(runner: ExpeditionRunner, map: ExpeditionMap) {
    this.runner = runner;
    this.map = map;
  }

  static get active(): RunManager | null { return instance; }

  /** Create a fresh expedition and make it the active instance. */
  static create(seed: number, startGold = 100, mapProfileId?: string): RunManager {
    instance?.dispose();
    const profileId = mapProfileId ?? DEFAULT_PROFILE.id;
    const profile: MapProfile = { ...DEFAULT_PROFILE, id: profileId };
    const regionWeights = REGION_PROFILES[profileId]?.typeWeights;
    const map = generateMap({ seed, profileId: profile.id, contentRevision: '32.0' }, profile, regionWeights);
    const runner = createAndSaveExpedition(map, { startGold });
    instance = new RunManager(runner, map);
    notifyActiveListeners();
    return instance;
  }

  /** Restore from the stored save. Returns null when no valid save exists. */
  static restore(): RunManager | null {
    const meta = readMeta();
    if (!meta) return null;
    const profileId = meta.profileId ?? DEFAULT_PROFILE.id;
    const profile: MapProfile = { ...DEFAULT_PROFILE, id: profileId };
    const regionWeights = REGION_PROFILES[profileId]?.typeWeights;
    const map = generateMap({ seed: meta.mapSeed, profileId, contentRevision: '32.0' }, profile, regionWeights);
    const runner = restoreStoredExpedition(map);
    if (!runner) return null;
    instance = new RunManager(runner, map);
    notifyActiveListeners();
    return instance;
  }

  static hasSave(): boolean { return hasStoredExpedition(); }

  static abandon(): void {
    instance?.dispose();
    clearStore();
    instance = null;
    notifyActiveListeners();
  }

  static subscribeActive(listener: () => void): () => void {
    activeListeners.add(listener);
    return () => { activeListeners.delete(listener); };
  }

  private dispose(): void { this.listeners.clear(); }

  // -- Read-only snapshot --

  snapshot(): RunSnapshot {
    const s = this.runner.state;
    return {
      state: s,
      currentNodeId: this.runner.currentNodeId,
      currentNodeType: this.runner.definition.type,
      currentNodePayloadKey: this.runner.definition.payloadKey,
      reachableNodes: this.runner.reachableNodes,
      runStatus: s.runStatus,
      gold: s.gold,
      instability: s.instability,
      killsEarned: s.killsEarned,
      securedLoot: s.securedLoot,
      unsecuredLoot: s.unsecuredLoot,
    };
  }

  // -- Mutations --

  enter(transactionId: string): void {
    this.runner = this.runner.enter(transactionId);
    this.persistAndNotify();
  }

  act(request: NodeActionRequest): TransactionRecord {
    const before = this.runner;
    const next = before.act(request);
    let nextState = next.state;
    const record = nextState.ledger[request.transactionId];
    const isCombatEngage = request.action === 'ENGAGE' &&
      (before.definition.type === 'battle' || before.definition.type === 'elite' || before.definition.type === 'boss');
    if (isCombatEngage && record?.status === 'COMMITTED') {
      const targetKills = nextState.killsEarned;
      if (targetKills > before.state.masteryKillsApplied && recordCombatMasteryKills(
        trackingHeroIds(), targetKills, before.state.runId, request.transactionId,
      )) {
        nextState = {
          ...nextState,
          masteryKillsApplied: targetKills,
        };
      }
    }
    this.runner = nextState === next.state
      ? next
      : restoreExpedition(nextState, this.map, next.currentNodeId);
    const committedRecord = this.runner.state.ledger[request.transactionId];
    if (committedRecord === undefined) {
      throw new Error(`EXPEDITION_TRANSACTION_MISSING:${request.transactionId}`);
    }
    this.persistAndNotify();
    return committedRecord;
  }

  resolve(): void {
    this.runner = this.runner.resolve();
    this.persistAndNotify();
  }

  resolveBattle(won: boolean): void {
    this.runner = this.runner.resolveBattle(won);
    this.persistAndNotify();
  }

  advance(nextNodeId: NodeId): void {
    this.runner = this.runner.advance(nextNodeId);
    this.persistAndNotify();
  }

  finish(): void {
    this.runner = this.runner.finish();
    this.persistAndNotify();
  }

  visit(enterTxId: string, actionRequest?: NodeActionRequest): void {
    this.runner = this.runner.visit(enterTxId, actionRequest);
    this.persistAndNotify();
  }

  // -- React subscription --

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  }

  private persistAndNotify(): void {
    saveExpedition(this.runner);
    for (const listener of this.listeners) listener();
  }
}
