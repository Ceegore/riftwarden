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
import { loadMasteryState, saveMasteryState, addMasteryExpedition, addMasteryKills, clearMasteryState, processedCombatKillsForRun } from '../mastery/mastery-store.js';
import type { MasteryState } from '../mastery/types.js';
import { loadStoryArchiveState, saveStoryArchiveState, unlockStoryFragment, clearStoryArchiveState } from '../story/story-store.js';
import type { StoryArchiveState } from '../story/types.js';
import type { NodeRunState } from './nodes/types.js';
import type { ExpeditionOutcome } from './expedition-settlement.js';
import { loadOrCreateProfile } from '../profile/profile-store.js';
import { loadFormationState } from '../formations/formation-store.js';

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
export function recordCombatMasteryKills(
  heroIds: readonly string[],
  targetKills: number,
  runId: string,
  transactionId: string,
): boolean {
  if (heroIds.length === 0 || !Number.isSafeInteger(targetKills) || targetKills <= 0) return false;
  try {
    let mastery = loadMasteryState();
    const alreadyApplied = processedCombatKillsForRun(mastery, runId);
    const missing = Math.max(0, targetKills - alreadyApplied);
    if (missing > 0) {
      for (const heroId of heroIds) mastery = addMasteryKills(mastery, heroId, missing);
      const markers = {
        ...(mastery.processedCombatTransactions ?? {}),
        [`${runId}:${transactionId}`]: missing,
      };
      mastery = { ...mastery, processedCombatTransactions: markers };
      saveMasteryState(mastery);
    }
    return true;
  } catch {
    return false;
  }
}

export function trackingHeroIds(explicit?: string | readonly string[]): readonly string[] {
  if (explicit !== undefined) {
    const ids = typeof explicit === 'string' ? [explicit] : explicit;
    return [...new Set(ids.filter((id) => id.length > 0))];
  }
  const formation = loadFormationState();
  const placed = Object.values(formation.placement).filter((id): id is string => typeof id === 'string' && id.length > 0);
  if (placed.length > 0) {
    const unlocked = new Set(Object.values(loadOrCreateProfile().heroes).filter((hero) => hero.unlocked).map((hero) => hero.id));
    const validPlaced = [...new Set(placed)].filter((id) => unlocked.has(id));
    if (validPlaced.length > 0) return validPlaced;
  }
  const profile = loadOrCreateProfile();
  return Object.values(profile.heroes)
    .filter((hero) => hero.unlocked)
    .map((hero) => hero.id)
    .sort();
}

export function applyExpeditionTracking(
  state: NodeRunState,
  outcome: ExpeditionOutcome,
  missionId: string,
  goldEarned: number,
  nodesVisited: number,
  allState: AllPersistentState,
  heroIdWhom?: string | readonly string[],
): AllPersistentState {
  let { achievements, records, mastery, story } = allState;
  const codex = allState.codex; // codex doesn't change from settlement
  const killsEarned = Number.isSafeInteger(state.killsEarned) && state.killsEarned > 0 ? state.killsEarned : 0;
  const masteryKillsApplied = Math.max(
    Number.isSafeInteger(state.masteryKillsApplied) ? state.masteryKillsApplied : 0,
    processedCombatKillsForRun(mastery, state.runId),
  );
  const masteryKillsRemaining = Math.max(0, killsEarned - masteryKillsApplied);
  const heroIds = trackingHeroIds(heroIdWhom);

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
  // Nodes visited and combat kills
  achievements = incrementAchievement(achievements, 'nodes_visited_100', nodesVisited).state;
  achievements = incrementAchievement(achievements, 'kill_10', killsEarned).state;
  achievements = incrementAchievement(achievements, 'kill_50', killsEarned).state;
  achievements = incrementAchievement(achievements, 'kill_200', killsEarned).state;

  // --- Records ---
  records = recordRun(records, {
    missionId,
    goldEarned,
    killsEarned,
    result: outcome === 'retreat' ? 'retreat' : outcome,
    nodesVisited,
    timestamp: Date.now(),
  });

  // --- Mastery ---
  for (const heroId of heroIds) {
    mastery = addMasteryExpedition(mastery, heroId);
    if (masteryKillsRemaining > 0) {
      mastery = addMasteryKills(mastery, heroId, masteryKillsRemaining);
    }
  }
  if (masteryKillsRemaining > 0 && heroIds.length > 0) {
    mastery = {
      ...mastery,
      processedCombatTransactions: {
        ...(mastery.processedCombatTransactions ?? {}),
        [`${state.runId}:settlement`]: masteryKillsRemaining,
      },
    };
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
  includeNodeType = true,
): CodexState {
  let updated = codex;

  if (includeNodeType) {
    updated = discoverEntity(updated, `nodetype_${nodeType}`, 'nodeType');
  }

  if (entityHint) {
    let category: 'enemy' | 'item' | 'relic' | 'hero' | 'troop' = 'enemy';
    if (entityHint.startsWith('item_') || entityHint.startsWith('equip_') || entityHint.startsWith('reward:') || entityHint.startsWith('treasure:')) category = 'item';
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
