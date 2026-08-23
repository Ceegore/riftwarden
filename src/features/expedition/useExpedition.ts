/**
 * useExpedition — React hook for the Phase 32 expedition loop.
 * Wraps RunManager with useState-driven reactivity.
 */
import { useCallback, useEffect, useState } from 'react';
import { RunManager, type RunSnapshot } from '../../game/expedition/run-manager.js';
import type { NodeActionRequest } from '../../game/expedition/nodes/types.js';
import type { ExpeditionMap, NodeId } from '../../game/expedition/types.js';
import { mainPath } from '../../game/expedition/expedition-runner.js';

export interface UseExpeditionResult {
  readonly snapshot: RunSnapshot | null;
  readonly map: ExpeditionMap | null;
  readonly mainPathNodes: readonly NodeId[];
  readonly hasSave: boolean;
  readonly loading: boolean;

  newRun(seed: number, startGold?: number): void;
  continueRun(): void;
  abandon(): void;
  enter(txId: string): void;
  act(request: NodeActionRequest): void;
  resolve(): void;
  advance(nodeId: NodeId): void;
  finish(): void;
}

export function useExpedition(): UseExpeditionResult {
  const [snapshot, setSnapshot] = useState<RunSnapshot | null>(() => RunManager.active?.snapshot() ?? null);
  const [map, setMap] = useState<ExpeditionMap | null>(() => RunManager.active?.map ?? null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const mgr = RunManager.active;
    if (!mgr) return;
    return mgr.subscribe(() => setSnapshot(mgr.snapshot()));
  }, []);

  const newRun = useCallback((seed: number, startGold = 100) => {
    setLoading(true);
    const mgr = RunManager.create(seed, startGold);
    setMap(mgr.map);
    setSnapshot(mgr.snapshot());
    setLoading(false);
  }, []);

  const continueRun = useCallback(() => {
    setLoading(true);
    const mgr = RunManager.restore();
    if (mgr) {
      setMap(mgr.map);
      setSnapshot(mgr.snapshot());
    }
    setLoading(false);
  }, []);

  const abandon = useCallback(() => {
    RunManager.abandon();
    setSnapshot(null);
    setMap(null);
  }, []);

  const enter = useCallback((txId: string) => { RunManager.active?.enter(txId); }, []);
  const act = useCallback((req: NodeActionRequest) => { RunManager.active?.act(req); }, []);
  const resolve = useCallback(() => { RunManager.active?.resolve(); }, []);
  const advance = useCallback((nid: NodeId) => { RunManager.active?.advance(nid); }, []);
  const finish = useCallback(() => { RunManager.active?.finish(); }, []);

  return {
    snapshot,
    map,
    mainPathNodes: map ? mainPath(map) : [],
    hasSave: RunManager.hasSave(),
    loading,
    newRun,
    continueRun,
    abandon,
    enter,
    act,
    resolve,
    advance,
    finish,
  };
}
