/**
 * Codex store (CODEX_STORE_CONTRACT): localStorage persistence for
 * discovered codex entries. New entries are added as they are encountered
 * during expeditions.
 */
import type { CodexCategory, CodexEntry, CodexState } from './types.js';

const CODEX_KEY = 'rw.codex.v1';

function makeEntry(id: string, category: CodexCategory, discovered: boolean, timesEncountered: number, discoveredAt?: number): CodexEntry {
  const base: CodexEntry = { id, category, discovered, timesEncountered };
  if (discoveredAt !== undefined) (base as unknown as Record<string, unknown>)['discoveredAt'] = discoveredAt;
  return base;
}

export function loadCodexState(): CodexState {
  try {
    const raw = localStorage.getItem(CODEX_KEY);
    if (!raw) return { entries: {} };
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const entries: Record<string, CodexEntry> = {};
    for (const [id, entry] of Object.entries(parsed)) {
      if (typeof entry !== 'object' || entry === null) continue;
      const e = entry as Record<string, unknown>;
      const da = typeof e['discoveredAt'] === 'number' ? e['discoveredAt'] as number : undefined;
      entries[id] = makeEntry(
        e['id'] as string ?? id,
        e['category'] as CodexEntry['category'] ?? 'enemy',
        e['discovered'] === true,
        typeof e['timesEncountered'] === 'number' ? Math.max(0, Math.floor(e['timesEncountered'])) : 0,
        da,
      );
    }
    return { entries };
  } catch {
    return { entries: {} };
  }
}

export function saveCodexState(state: CodexState): void {
  localStorage.setItem(CODEX_KEY, JSON.stringify(state.entries));
}

/** Discover (or re-encounter) an entity. Returns updated state. */
export function discoverEntity(
  state: CodexState,
  id: string,
  category: CodexEntry['category'],
): CodexState {
  const existing = state.entries[id];
  const entry = existing
    ? makeEntry(existing.id, existing.category, existing.discovered, existing.timesEncountered + 1, existing.discoveredAt)
    : makeEntry(id, category, true, 1, Date.now());
  return { entries: { ...state.entries, [id]: entry } };
}

export function clearCodexState(): void {
  localStorage.removeItem(CODEX_KEY);
}
