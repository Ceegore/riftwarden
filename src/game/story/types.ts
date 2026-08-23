/**
 * Phase 35 story archive domain: unlocked story fragments from
 * expedition events. Persisted in localStorage.
 */
export interface StoryFragment {
  readonly id: string;
  readonly titleKey: string;
  readonly bodyKey: string;
  readonly missionId: string;
  readonly unlocked: boolean;
  readonly unlockedAt?: number;
}

export interface StoryArchiveState {
  readonly fragments: Readonly<Record<string, StoryFragment>>;
}

/** Pinned Phase 35 story fragments — grows as new expeditions add them. */
export const STORY_FRAGMENTS: readonly StoryFragment[] = [
  { id: 'story_intro',     titleKey: 'story.intro.title',     bodyKey: 'story.intro.body',     missionId: 'mission_tutorial', unlocked: false },
  { id: 'story_act1_open', titleKey: 'story.act1_open.title', bodyKey: 'story.act1_open.body', missionId: 'mission_act1',     unlocked: false },
  { id: 'story_act1_boss', titleKey: 'story.act1_boss.title', bodyKey: 'story.act1_boss.body', missionId: 'mission_act1',     unlocked: false },
  { id: 'story_act2_open', titleKey: 'story.act2_open.title', bodyKey: 'story.act2_open.body', missionId: 'mission_act2',     unlocked: false },
];
