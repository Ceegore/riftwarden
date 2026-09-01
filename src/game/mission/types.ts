/**
 * Phase 33 mission domain types (MISSION_DOMAIN_CONTRACT): mission
 * definitions, progress tracking, and unlock chains. Every mission
 * references a map profile for generation; progress is per-profile,
 * persisted through the mission store.
 */

export type MissionId = string;

export type MissionDifficulty = 'normal' | 'hard' | 'ascension';

export type MissionStatus = 'locked' | 'available' | 'completed';

export interface MissionDefinition {
  readonly id: MissionId;
  readonly labelKey: string;
  readonly descriptionKey: string;
  readonly mapProfileId: string;
  readonly difficulty: MissionDifficulty;
  readonly goldMultiplier: number;
  readonly instabilityRate: number;
  /** Mission ids that must be completed before this one unlocks. */
  readonly requiredMissions: readonly MissionId[];
  readonly rewardPreviewKeys: readonly string[];
}

export interface MissionProgress {
  readonly missionId: MissionId;
  readonly status: MissionStatus;
  /** Best gold earned across all completions. */
  readonly bestGold: number;
  /** Number of times completed. */
  readonly completions: number;
}

export interface MissionState {
  readonly missions: Readonly<Record<MissionId, MissionProgress>>;
}

/** Parameters passed through to map generation when launching a mission. */
export interface MissionLaunchParams {
  readonly missionId: MissionId;
  readonly definition: MissionDefinition;
  readonly seed: number;
}

export function defaultDifficultyForMission(difficulty: MissionDifficulty): { startGold: number; goldMult: number } {
  switch (difficulty) {
    case 'normal':
      return { startGold: 100, goldMult: 1 };
    case 'hard':
      return { startGold: 80, goldMult: 1.5 };
    case 'ascension':
      return { startGold: 60, goldMult: 2 };
  }
}
