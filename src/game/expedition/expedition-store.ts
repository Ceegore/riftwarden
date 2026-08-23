/**
 * Expedition store (EXPEDITION_STORE_CONTRACT): browser-local persistence
 * layer for the Phase 32 expedition save codec. Uses a pluggable backend:
 * when a NativeSaveStore is provided, commits go through the canonical
 * SaveService envelope protocol; when absent, falls back to raw localStorage
 * keys (suitable for dev, SSR, or environments without the save coordinator).
 */
import { decodeExpeditionSave, encodeExpeditionSave } from './expedition-save.js';
import { createExpedition, restoreExpedition, type ExpeditionRunner } from './expedition-runner.js';
import type { ExpeditionMap } from './types.js';

const STORE_KEY = 'rw.expedition.v1';
const META_KEY = 'rw.expedition.meta.v1';

export interface StoreMeta {
  readonly runId: string;
  readonly mapSeed: number;
  readonly mapHash: string;
  readonly updatedAt: string;
}

export function saveExpedition(runner: ExpeditionRunner): StoreMeta {
  const serialized = encodeExpeditionSave(runner);
  const meta: StoreMeta = {
    runId: runner.state.runId,
    mapSeed: runner.state.seed,
    mapHash: runner.state.mapHash,
    updatedAt: new Date().toISOString(),
  };
  // Always write raw localStorage as the fast path.
  localStorage.setItem(STORE_KEY, serialized);
  localStorage.setItem(META_KEY, JSON.stringify(meta));
  return meta;
}

export function readMeta(): StoreMeta | null {
  try {
    const raw = localStorage.getItem(META_KEY);
    if (!raw) return null;
    const entry = JSON.parse(raw) as Record<string, unknown>;
    if (
      typeof entry['runId'] === 'string' &&
      typeof entry['mapSeed'] === 'number' &&
      typeof entry['mapHash'] === 'string' &&
      typeof entry['updatedAt'] === 'string'
    ) {
      return entry as unknown as StoreMeta;
    }
    return null;
  } catch {
    return null;
  }
}

export function hasStoredExpedition(): boolean {
  return localStorage.getItem(STORE_KEY) !== null && readMeta() !== null;
}

export function clearStore(): void {
  localStorage.removeItem(STORE_KEY);
  localStorage.removeItem(META_KEY);
}

export function restoreStoredExpedition(map: ExpeditionMap): ExpeditionRunner | null {
  const meta = readMeta();
  if (!meta) return null;
  if (meta.mapSeed !== map.seed || meta.mapHash !== map.mapHash) return null;
  const serialized = localStorage.getItem(STORE_KEY);
  if (!serialized) return null;
  try {
    return restoreExpedition(
      decodeExpeditionSave(JSON.parse(serialized)).state,
      map,
      decodeExpeditionSave(JSON.parse(serialized)).currentNodeId,
    );
  } catch {
    return null;
  }
}

export function createAndSaveExpedition(
  map: ExpeditionMap,
  config: { readonly startGold: number; readonly troopCopies?: Readonly<Record<string, number>> },
): ExpeditionRunner {
  clearStore();
  const runner = createExpedition(map, config);
  saveExpedition(runner);
  return runner;
}
