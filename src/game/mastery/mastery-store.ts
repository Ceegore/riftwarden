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
    const processedCombatTransactions: Record<string, number> = {};
    const processed = typeof parsed['processedCombatTransactions'] === 'object' && parsed['processedCombatTransactions'] !== null
      ? parsed['processedCombatTransactions'] as Record<string, unknown>
      : {};
    for (const [transactionId, value] of Object.entries(processed)) {
      if (typeof value === 'number' && Number.isSafeInteger(value) && value > 0) processedCombatTransactions[transactionId] = value;
    }
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
    return Object.keys(processedCombatTransactions).length > 0
      ? { heroes, processedCombatTransactions }
      : { heroes };
  } catch {
    return { heroes: {} };
  }
}

export function saveMasteryState(state: MasteryState): void {
  localStorage.setItem(MASTERY_KEY, JSON.stringify(state));
}

export function processedCombatKillsForRun(state: MasteryState, runId: string): number {
  const prefix = `${runId}:`;
  return Object.entries(state.processedCombatTransactions ?? {})
    .filter(([transactionId]) => transactionId.startsWith(prefix))
    .reduce((sum, [, kills]) => sum + kills, 0);
}

export function addMasteryKills(state: MasteryState, heroId: string, kills: number): MasteryState {
  if (heroId.length === 0 || !Number.isSafeInteger(kills) || kills < 0) return state;
  const current = state.heroes[heroId] ?? { heroId, kills: 0, expeditions: 0 };
  const updated: HeroMastery = { ...current, kills: current.kills + kills };
  return {
    heroes: { ...state.heroes, [heroId]: updated },
    ...(state.processedCombatTransactions === undefined ? {} : { processedCombatTransactions: state.processedCombatTransactions }),
  };
}

export function addMasteryExpedition(state: MasteryState, heroId: string): MasteryState {
  if (heroId.length === 0) return state;
  const current = state.heroes[heroId] ?? { heroId, kills: 0, expeditions: 0 };
  const updated: HeroMastery = { ...current, expeditions: current.expeditions + 1 };
  return {
    heroes: { ...state.heroes, [heroId]: updated },
    ...(state.processedCombatTransactions === undefined ? {} : { processedCombatTransactions: state.processedCombatTransactions }),
  };
}

export function ensureMasteryEntry(state: MasteryState, heroId: string): MasteryState {
  if (state.heroes[heroId]) return state;
  return {
    heroes: { ...state.heroes, [heroId]: { heroId, kills: 0, expeditions: 0 } },
    ...(state.processedCombatTransactions === undefined ? {} : { processedCombatTransactions: state.processedCombatTransactions }),
  };
}

export function clearMasteryState(): void {
  localStorage.removeItem(MASTERY_KEY);
}
