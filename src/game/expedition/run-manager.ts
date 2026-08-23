/**
 * Run manager (RUN_MANAGER_CONTRACT): bridges the immutable ExpeditionRunner
 * with a mutable, autosaving facade for React. The manager owns the map and
 * runner; every mutation persists through the store and notifies subscribers.
 */
import { generateMap } from './map-generator.js';
import { createAndSaveExpedition, hasStoredExpedition, restoreStoredExpedition, saveExpedition, clearStore, readMeta } from './expedition-store.js';
import type { ExpeditionRunner } from './expedition-runner.js';
import type { NodeActionRequest, NodeRunState } from './nodes/types.js';
import type { ExpeditionMap, MapProfile, NodeId, NodeType } from './types.js';

type Listener = () => void;

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
  readonly reachableNodes: readonly NodeId[];
  readonly runStatus: 'active' | 'finished';
  readonly gold: number;
  readonly instability: number;
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
    const profile: MapProfile = mapProfileId !== undefined
      ? { ...DEFAULT_PROFILE, id: mapProfileId }
      : DEFAULT_PROFILE;
    const map = generateMap({ seed, profileId: profile.id, contentRevision: '32.0' }, profile);
    const runner = createAndSaveExpedition(map, { startGold });
    instance = new RunManager(runner, map);
    return instance;
  }

  /** Restore from the stored save. Returns null when no valid save exists. */
  static restore(): RunManager | null {
    const meta = readMeta();
    if (!meta) return null;
    const map = generateMap({ seed: meta.mapSeed, profileId: DEFAULT_PROFILE.id, contentRevision: '32.0' }, DEFAULT_PROFILE);
    const runner = restoreStoredExpedition(map);
    if (!runner) return null;
    instance = new RunManager(runner, map);
    return instance;
  }

  static hasSave(): boolean { return hasStoredExpedition(); }

  static abandon(): void {
    instance?.dispose();
    clearStore();
    instance = null;
  }

  private dispose(): void { this.listeners.clear(); }

  // -- Read-only snapshot --

  snapshot(): RunSnapshot {
    const s = this.runner.state;
    return {
      state: s,
      currentNodeId: this.runner.currentNodeId,
      currentNodeType: this.runner.definition.type,
      reachableNodes: this.runner.reachableNodes,
      runStatus: s.runStatus,
      gold: s.gold,
      instability: s.instability,
      securedLoot: s.securedLoot,
      unsecuredLoot: s.unsecuredLoot,
    };
  }

  // -- Mutations --

  enter(transactionId: string): void {
    this.runner = this.runner.enter(transactionId);
    this.persistAndNotify();
  }

  act(request: NodeActionRequest): void {
    this.runner = this.runner.act(request);
    this.persistAndNotify();
  }

  resolve(): void {
    this.runner = this.runner.resolve();
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
