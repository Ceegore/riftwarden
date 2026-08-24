/**
 * Codex store (CODEX_STORE_CONTRACT): localStorage persistence for
 * discovered codex entries. New entries are added as they are encountered
 * during expeditions.
 */
import type { CodexCategory, CodexEntry, CodexState } from './types.js';

const CODEX_KEY = 'rw.codex.v1';
const CODEX_CATEGORIES: readonly CodexCategory[] = ['enemy', 'item', 'relic', 'nodeType', 'hero', 'troop'];

function isCodexCategory(value: unknown): value is CodexCategory {
  return typeof value === 'string' && CODEX_CATEGORIES.includes(value as CodexCategory);
}

function makeEntry(id: string, category: CodexCategory, discovered: boolean, timesEncountered: number, discoveredAt?: number): CodexEntry {
  const base: CodexEntry = { id, category, discovered, timesEncountered };
  if (discoveredAt !== undefined) (base as unknown as Record<string, unknown>)['discoveredAt'] = discoveredAt;
  return base;
}

export function loadCodexState(): CodexState {
  try {
    const raw = localStorage.getItem(CODEX_KEY);
    if (!raw) return { entries: {} };
    const parsed = JSON.parse(raw) as unknown;
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return { entries: {} };
    const entries: Record<string, CodexEntry> = {};
    for (const [id, entry] of Object.entries(parsed)) {
      if (id.length === 0 || typeof entry !== 'object' || entry === null || Array.isArray(entry)) continue;
      const e = entry as Record<string, unknown>;
      const entryId = typeof e['id'] === 'string' && e['id'].length > 0 ? e['id'] : id;
      const category = isCodexCategory(e['category']) ? e['category'] : 'enemy';
      const timesEncountered = typeof e['timesEncountered'] === 'number' && Number.isSafeInteger(e['timesEncountered'])
        ? Math.max(0, e['timesEncountered'])
        : 0;
      const discoveredAt = typeof e['discoveredAt'] === 'number' && Number.isSafeInteger(e['discoveredAt']) && e['discoveredAt'] > 0
        ? e['discoveredAt']
        : undefined;
      entries[id] = makeEntry(entryId, category, e['discovered'] === true, timesEncountered, discoveredAt);
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
  if (id.length === 0 || !isCodexCategory(category)) return state;
  const existing = state.entries[id];
  const entry = existing
    ? makeEntry(existing.id, existing.category, true, existing.timesEncountered + 1, existing.discoveredAt ?? Date.now())
    : makeEntry(id, category, true, 1, Date.now());
  return { entries: { ...state.entries, [id]: entry } };
}

export function clearCodexState(): void {
  localStorage.removeItem(CODEX_KEY);
}
