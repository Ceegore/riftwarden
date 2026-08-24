/**
 * useExpedition — React hook for the Phase 32 expedition loop.
 * Wraps RunManager with useState-driven reactivity.
 */
import { useCallback, useEffect, useState } from 'react';
import { RunManager, type RunSnapshot } from '../../game/expedition/run-manager.js';
import type { NodeActionRequest, TransactionRecord } from '../../game/expedition/nodes/types.js';
import type { ExpeditionMap, NodeId } from '../../game/expedition/types.js';
import { mainPath } from '../../game/expedition/expedition-runner.js';

export interface UseExpeditionResult {
  readonly snapshot: RunSnapshot | null;
  readonly map: ExpeditionMap | null;
  readonly mainPathNodes: readonly NodeId[];
  readonly hasSave: boolean;
  readonly loading: boolean;

  readonly newRun: (seed: number, startGold?: number, mapProfileId?: string) => void;
  readonly continueRun: () => void;
  readonly abandon: () => void;
  readonly enter: (txId: string) => void;
  readonly act: (request: NodeActionRequest) => TransactionRecord | undefined;
  readonly resolve: () => void;
  readonly advance: (nodeId: NodeId) => void;
  readonly finish: () => void;
}

export function useExpedition(): UseExpeditionResult {
  const [snapshot, setSnapshot] = useState<RunSnapshot | null>(() => RunManager.active?.snapshot() ?? null);
  const [map, setMap] = useState<ExpeditionMap | null>(() => RunManager.active?.map ?? null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const refresh = (): void => {
      const mgr = RunManager.active;
      setSnapshot(mgr?.snapshot() ?? null);
      setMap(mgr?.map ?? null);
    };
    const unsubscribeActive = RunManager.subscribeActive(refresh);
    const mgr = RunManager.active;
    const unsubscribeRun = mgr?.subscribe(refresh);
    return () => {
      unsubscribeActive();
      unsubscribeRun?.();
    };
  }, []);

  const newRun = useCallback((seed: number, startGold = 100, mapProfileId?: string) => {
    setLoading(true);
    const mgr = RunManager.create(seed, startGold, mapProfileId);
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
  const act = useCallback((req: NodeActionRequest): TransactionRecord | undefined => RunManager.active?.act(req), []);
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
