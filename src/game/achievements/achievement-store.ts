/**
 * Achievement store (ACHIEVEMENT_STORE_CONTRACT): browser-local persistence
 * for achievement progress. Tracks current progress per achievement and
 * marks them earned when targets are hit.
 */
import { ACHIEVEMENTS } from './achievement-definitions.js';
import type { AchievementProgress, AchievementState } from './types.js';

const ACHIEVEMENT_KEY = 'rw.achievements.v1';

function emptyProgress(): Record<string, AchievementProgress> {
  const map: Record<string, AchievementProgress> = {};
  for (const def of ACHIEVEMENTS) {
    map[def.id] = makeProgress(def.id, false, 0);
  }
  return map;
}

function makeProgress(id: string, earned: boolean, current: number, earnedAt?: number): AchievementProgress {
  const base: AchievementProgress = { achievementId: id, earned, current };
  if (earnedAt !== undefined) (base as unknown as Record<string, unknown>)['earnedAt'] = earnedAt;
  return base;
}

export function loadAchievementState(): AchievementState {
  try {
    const raw = localStorage.getItem(ACHIEVEMENT_KEY);
    if (!raw) return { achievements: emptyProgress() };
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const achievements: Record<string, AchievementProgress> = {};
    for (const def of ACHIEVEMENTS) {
      const entry = parsed[def.id] as Record<string, unknown> | undefined;
      const ea = typeof entry?.['earnedAt'] === 'number' ? entry['earnedAt'] as number : undefined;
      achievements[def.id] = makeProgress(
        def.id,
        entry?.['earned'] === true,
        typeof entry?.['current'] === 'number' ? Math.max(0, Math.floor(entry['current'])) : 0,
        ea,
      );
    }
    return { achievements };
  } catch {
    return { achievements: emptyProgress() };
  }
}

export function saveAchievementState(state: AchievementState): void {
  const json: Record<string, unknown> = {};
  for (const [id, prog] of Object.entries(state.achievements)) {
    json[id] = {
      achievementId: prog.achievementId,
      earned: prog.earned,
      earnedAt: prog.earnedAt,
      current: prog.current,
    };
  }
  localStorage.setItem(ACHIEVEMENT_KEY, JSON.stringify(json));
}

/** Increment progress for an achievement; returns true if newly earned. */
export function incrementAchievement(
  state: AchievementState,
  achievementId: string,
  amount: number,
): { state: AchievementState; newlyEarned: boolean } {
  const def = ACHIEVEMENTS.find((a) => a.id === achievementId);
  const prog = state.achievements[achievementId];
  if (!def || !prog || prog.earned) return { state, newlyEarned: false };

  const newCurrent = Math.min(prog.current + amount, def.target);
  const earned = newCurrent >= def.target;

  const newEarnedAt = earned && !prog.earned ? Date.now() : prog.earnedAt;
  const updated = makeProgress(achievementId, earned, newCurrent, newEarnedAt);

  const newState: AchievementState = {
    achievements: { ...state.achievements, [achievementId]: updated },
  };

  return { state: newState, newlyEarned: earned && !prog.earned };
}

export function clearAchievementState(): void {
  localStorage.removeItem(ACHIEVEMENT_KEY);
}

/** Count earned achievements by tier and total. */
export function achievementStats(state: AchievementState): { total: number; earned: number; byTier: Record<number, number> } {
  let earned = 0;
  const byTier: Record<number, number> = {};
  for (const def of ACHIEVEMENTS) {
    byTier[def.tier] = (byTier[def.tier] ?? 0) + 1;
    if (state.achievements[def.id]?.earned) earned++;
  }
  return { total: ACHIEVEMENTS.length, earned, byTier };
}
