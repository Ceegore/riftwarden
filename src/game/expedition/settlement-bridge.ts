/**
 * Settlement bridge for achievements, codex, records, mastery, and story.
 * Called after an expedition finishes to update all persistent tracking
 * from the committed run state.
 */
import { loadAchievementState, saveAchievementState, incrementAchievement, clearAchievementState } from '../achievements/achievement-store.js';
import type { AchievementState } from '../achievements/types.js';
import { loadCodexState, saveCodexState, discoverEntity, clearCodexState } from '../codex/codex-store.js';
import type { CodexState } from '../codex/types.js';
import { loadRecordsState, saveRecordsState, recordRun, clearRecordsState } from '../records/records-store.js';
import type { RecordsState } from '../records/types.js';
import { loadMasteryState, saveMasteryState, addMasteryExpedition, clearMasteryState } from '../mastery/mastery-store.js';
import type { MasteryState } from '../mastery/types.js';
import { loadStoryArchiveState, saveStoryArchiveState, unlockStoryFragment, clearStoryArchiveState } from '../story/story-store.js';
import type { StoryArchiveState } from '../story/types.js';
import type { NodeRunState } from './nodes/types.js';
import type { ExpeditionOutcome } from './expedition-settlement.js';

export interface AllPersistentState {
  readonly achievements: AchievementState;
  readonly codex: CodexState;
  readonly records: RecordsState;
  readonly mastery: MasteryState;
  readonly story: StoryArchiveState;
}

/** Load all persistent tracking state at once. */
export function loadAllPersistentState(): AllPersistentState {
  return {
    achievements: loadAchievementState(),
    codex: loadCodexState(),
    records: loadRecordsState(),
    mastery: loadMasteryState(),
    story: loadStoryArchiveState(),
  };
}

/** Persist all state from a single atomic snapshot. */
function saveAll(state: AllPersistentState): void {
  saveAchievementState(state.achievements);
  saveCodexState(state.codex);
  saveRecordsState(state.records);
  saveMasteryState(state.mastery);
  saveStoryArchiveState(state.story);
}

/** Clear all persistent tracking (for testing). */
export function clearAllPersistentState(): void {
  clearAchievementState();
  clearCodexState();
  clearRecordsState();
  clearMasteryState();
  clearStoryArchiveState();
}

/** Achievement IDs derived from run outcome. */
const OUTCOME_ACHIEVEMENTS: Record<ExpeditionOutcome, string[]> = {
  victory: ['first_victory'],
  defeat: ['first_defeat'],
  retreat: [],
};

/**
 * Apply all post-expedition tracking updates.
 * - Increment expedition-count achievements
 * - Increment gold achievements (best gold per run)
 * - Record the run in the records store
 * - Unlock relevant story fragments
 * - Update hero mastery expedition counts
 */
export function applyExpeditionTracking(
  _state: NodeRunState,
  outcome: ExpeditionOutcome,
  missionId: string,
  goldEarned: number,
  nodesVisited: number,
  allState: AllPersistentState,
  heroIdWhom?: string,
): AllPersistentState {
  let { achievements, records, mastery, story } = allState;
  const codex = allState.codex; // codex doesn't change from settlement

  // --- Achievements ---
  // Expedition count
  achievements = incrementAchievement(achievements, 'expeditions_5', 1).state;
  achievements = incrementAchievement(achievements, 'expeditions_20', 1).state;
  // Gold milestones
  achievements = incrementAchievement(achievements, 'gold_1000', goldEarned).state;
  achievements = incrementAchievement(achievements, 'gold_10000', goldEarned).state;
  // Outcome milestones
  for (const achId of OUTCOME_ACHIEVEMENTS[outcome]) {
    achievements = incrementAchievement(achievements, achId, 1).state;
  }
  // Nodes visited
  achievements = incrementAchievement(achievements, 'nodes_visited_100', nodesVisited).state;

  // --- Records ---
  records = recordRun(records, {
    missionId,
    goldEarned,
    result: outcome === 'retreat' ? 'retreat' : outcome,
    nodesVisited,
    timestamp: Date.now(),
  });

  // --- Mastery ---
  if (heroIdWhom) {
    mastery = addMasteryExpedition(mastery, heroIdWhom);
  }

  // --- Story ---
  story = unlockStoryFragment(story, `story_intro`);
  if (outcome === 'victory') {
    if (missionId === 'mission_act1') {
      story = unlockStoryFragment(story, 'story_act1_boss');
    } else {
      story = unlockStoryFragment(story, `story_${missionId.replace('mission_', '')}_open`);
    }
  }

  return { achievements, codex, records, mastery, story };
}

/**
 * Apply codex discoveries from a single node encounter.
 * Call this when the player resolves a node.
 */
export function applyNodeCodexDiscovery(
  codex: CodexState,
  nodeType: string,
  entityHint?: string,
): CodexState {
  let updated = codex;

  // Discover the node type itself
  updated = discoverEntity(updated, `nodetype_${nodeType}`, 'nodeType');

  // If the node had an entity reference, discover that too
  if (entityHint) {
    let category: 'enemy' | 'item' | 'relic' | 'hero' | 'troop' = 'enemy';
    if (entityHint.startsWith('item_') || entityHint.startsWith('equip_')) category = 'item';
    else if (entityHint.startsWith('relic_')) category = 'relic';
    else if (entityHint.startsWith('hero_')) category = 'hero';
    else if (entityHint.startsWith('troop_')) category = 'troop';
    updated = discoverEntity(updated, entityHint, category);
  }

  return updated;
}

/** Save a full persistent state snapshot (used by settlement screens). */
export function saveAllPersistentStateExport(allState: AllPersistentState): void {
  saveAll(allState);
}
