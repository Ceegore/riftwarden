/**
 * Formation store: localStorage persistence for formation selection
 * and hero placement.
 */
import type { FormationDefinition, FormationPosition, FormationState } from './types.js';
import { FORMATION_DEFINITIONS, FORMATION_POSITIONS } from './types.js';

const FORMATION_KEY = 'rw.formations.v1';

function withoutPosition(
  placement: Partial<Record<FormationPosition, string>> | Readonly<Partial<Record<FormationPosition, string>>>,
  excluded: FormationPosition,
): Partial<Record<FormationPosition, string>> {
  const result: Partial<Record<FormationPosition, string>> = {};
  for (const [key, value] of Object.entries(placement)) {
    if (key !== excluded && typeof value === 'string') result[key as FormationPosition] = value;
  }
  return result;
}

function unlockedFormations(): readonly FormationDefinition[] {
  return FORMATION_DEFINITIONS.map((f) => ({ ...f }));
}

export function loadFormationState(): FormationState {
  try {
    const raw = localStorage.getItem(FORMATION_KEY);
    const formations = unlockedFormations();
    if (!raw) return { formations, activeFormation: 'formation_standard', placement: {} };
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const unlockedIds = Array.isArray(parsed['unlocked'])
      ? new Set(parsed['unlocked'] as string[])
      : new Set<string>();
    for (const f of formations) {
      (f as { unlocked: boolean }).unlocked = unlockedIds.has(f.id) || f.unlocked;
    }
    const activeCandidate = typeof parsed['activeFormation'] === 'string' ? parsed['activeFormation'] : undefined;
    const activeFormation = activeCandidate !== undefined && formations.some((f) => f.id === activeCandidate && f.unlocked)
      ? activeCandidate
      : 'formation_standard';
    const placement = typeof parsed['placement'] === 'object' && parsed['placement'] !== null
      ? parsed['placement'] as Record<string, unknown>
      : {};
    const activeDefinition = formations.find((formation) => formation.id === activeFormation);
    const allowedPositions = new Set(activeDefinition?.positions ?? FORMATION_POSITIONS);
    const validatedPlacement: Record<string, string> = {};
    const placedHeroes = new Set<string>();
    for (const [pos, heroId] of Object.entries(placement)) {
      if (
        typeof heroId === 'string' && heroId.length > 0 &&
        FORMATION_POSITIONS.includes(pos as FormationPosition) &&
        allowedPositions.has(pos as FormationPosition) &&
        !placedHeroes.has(heroId)
      ) {
        validatedPlacement[pos] = heroId;
        placedHeroes.add(heroId);
      }
    }
    return { formations, activeFormation, placement: validatedPlacement };
  } catch {
    return { formations: unlockedFormations(), activeFormation: 'formation_standard', placement: {} };
  }
}

export function saveFormationState(state: FormationState): void {
  localStorage.setItem(FORMATION_KEY, JSON.stringify({
    unlocked: state.formations.filter((f) => f.unlocked).map((f) => f.id),
    activeFormation: state.activeFormation,
    placement: state.placement,
  }));
}

export function setActiveFormation(state: FormationState, formationId: string): FormationState {
  const def = state.formations.find((f) => f.id === formationId && f.unlocked);
  if (!def) return state;
  const placement: Partial<Record<FormationPosition, string>> = {};
  const placedHeroes = new Set<string>();
  for (const position of def.positions) {
    const heroId = state.placement[position];
    if (heroId !== undefined && !placedHeroes.has(heroId)) {
      placement[position] = heroId;
      placedHeroes.add(heroId);
    }
  }
  return { ...state, activeFormation: formationId, placement };
}

export function placeHero(
  state: FormationState,
  position: FormationPosition,
  heroId: string | null,
): FormationState {
  const active = state.formations.find((formation) => formation.id === state.activeFormation && formation.unlocked);
  if (!active?.positions.includes(position)) return state;
  let next: Partial<Record<FormationPosition, string>> = withoutPosition(state.placement, position);
  if (heroId !== null && heroId.length > 0) {
    const filtered: Partial<Record<FormationPosition, string>> = {};
    for (const [occupiedPosition, occupiedHeroId] of Object.entries(next)) {
      if (occupiedHeroId !== heroId && typeof occupiedHeroId === 'string') {
        filtered[occupiedPosition as FormationPosition] = occupiedHeroId;
      }
    }
    next = filtered;
    next[position] = heroId;
  }
  return { ...state, placement: next };
}

export function unlockFormation(state: FormationState, formationId: string): FormationState {
  const formations = state.formations.map((f) =>
    f.id === formationId ? { ...f, unlocked: true } : f,
  );
  return { ...state, formations };
}

export function clearFormationState(): void {
  localStorage.removeItem(FORMATION_KEY);
}
