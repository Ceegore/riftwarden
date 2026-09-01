/**
 * Story archive store (STORY_ARCHIVE_STORE_CONTRACT): localStorage
 * persistence for unlocked story fragments.
 */
import { STORY_FRAGMENTS, type StoryArchiveState } from './types.js';

const STORY_KEY = 'rw.story.v1';

export function loadStoryArchiveState(): StoryArchiveState {
  try {
    const raw = localStorage.getItem(STORY_KEY);
    if (!raw) return { fragments: fromStatic() };
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const stored = typeof parsed['fragments'] === 'object' && parsed['fragments'] !== null
      ? parsed['fragments'] as Record<string, unknown>
      : {};
    const fragments: Record<string, unknown> = {};
    for (const def of STORY_FRAGMENTS) {
      const entry = stored[def.id] as Record<string, unknown> | undefined;
      fragments[def.id] = {
        ...def,
        unlocked: entry?.['unlocked'] === true,
        unlockedAt: typeof entry?.['unlockedAt'] === 'number' ? entry['unlockedAt'] : undefined,
      };
    }
    return { fragments: fragments as StoryArchiveState['fragments'] };
  } catch {
    return { fragments: fromStatic() };
  }
}

function fromStatic(): StoryArchiveState['fragments'] {
  const map: Record<string, unknown> = {};
  for (const def of STORY_FRAGMENTS) {
    map[def.id] = { ...def };
  }
  return map as StoryArchiveState['fragments'];
}

export function saveStoryArchiveState(state: StoryArchiveState): void {
  localStorage.setItem(STORY_KEY, JSON.stringify(state));
}

export function unlockStoryFragment(state: StoryArchiveState, fragmentId: string): StoryArchiveState {
  const current = state.fragments[fragmentId];
  if (!current || current.unlocked) return state;
  const updated = { ...current, unlocked: true, unlockedAt: Date.now() };
  return { fragments: { ...state.fragments, [fragmentId]: updated } };
}

export function clearStoryArchiveState(): void {
  localStorage.removeItem(STORY_KEY);
}
