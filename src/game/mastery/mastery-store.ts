/**
 * Mastery store (MASTERY_STORE_CONTRACT): localStorage persistence for
 * hero mastery progress. Updated after each expedition.
 */
import type { HeroMastery, MasteryState } from './types.js';

const MASTERY_KEY = 'rw.mastery.v1';

export function loadMasteryState(): MasteryState {
  try {
    const raw = localStorage.getItem(MASTERY_KEY);
    if (!raw) return { heroes: {} };
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const heroes: Record<string, HeroMastery> = {};
    const heroMap = typeof parsed['heroes'] === 'object' && parsed['heroes'] !== null
      ? parsed['heroes'] as Record<string, unknown>
      : {};
    for (const [id, entry] of Object.entries(heroMap)) {
      if (typeof entry !== 'object' || entry === null) continue;
      const e = entry as Record<string, unknown>;
      heroes[id] = {
        heroId: id,
        kills: typeof e['kills'] === 'number' ? Math.max(0, Math.floor(e['kills'])) : 0,
        expeditions: typeof e['expeditions'] === 'number' ? Math.max(0, Math.floor(e['expeditions'])) : 0,
      };
    }
    return { heroes };
  } catch {
    return { heroes: {} };
  }
}

export function saveMasteryState(state: MasteryState): void {
  localStorage.setItem(MASTERY_KEY, JSON.stringify(state));
}

export function addMasteryKills(state: MasteryState, heroId: string, kills: number): MasteryState {
  const current = state.heroes[heroId] ?? { heroId, kills: 0, expeditions: 0 };
  const updated: HeroMastery = { ...current, kills: current.kills + kills };
  return { heroes: { ...state.heroes, [heroId]: updated } };
}

export function addMasteryExpedition(state: MasteryState, heroId: string): MasteryState {
  const current = state.heroes[heroId] ?? { heroId, kills: 0, expeditions: 0 };
  const updated: HeroMastery = { ...current, expeditions: current.expeditions + 1 };
  return { heroes: { ...state.heroes, [heroId]: updated } };
}

export function ensureMasteryEntry(state: MasteryState, heroId: string): MasteryState {
  if (state.heroes[heroId]) return state;
  return {
    heroes: { ...state.heroes, [heroId]: { heroId, kills: 0, expeditions: 0 } },
  };
}

export function clearMasteryState(): void {
  localStorage.removeItem(MASTERY_KEY);
}
