/**
 * Phase 35 achievements domain: tracked goals that unlock as the player
 * progresses through expeditions. Achievements are idempotent — once
 * earned, they stay earned. Progress is stored in localStorage.
 */
export interface AchievementDef {
  readonly id: string;
  readonly titleKey: string;
  readonly descriptionKey: string;
  readonly category: 'combat' | 'collection' | 'mastery' | 'exploration' | 'milestone';
  readonly tier: 1 | 2 | 3;
  readonly target: number;
}

export interface AchievementProgress {
  readonly achievementId: string;
  readonly earned: boolean;
  readonly earnedAt?: number; // Date.now() when earned
  readonly current: number;   // Current progress toward target
}

export interface AchievementState {
  readonly achievements: Readonly<Record<string, AchievementProgress>>;
}

export type AchievementCategory = AchievementDef['category'];
