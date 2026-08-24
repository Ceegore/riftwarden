/**
 * Phase 35 domain tests: achievements, codex, records, mastery, story.
 * Verifies store round-trips, progress tracking, and cascading state.
 */
import { afterEach, describe, it, expect } from 'vitest';
import {
  loadAchievementState,
  saveAchievementState,
  incrementAchievement,
  achievementStats,
  clearAchievementState,
} from '../../src/game/achievements/achievement-store.js';
import { ACHIEVEMENTS } from '../../src/game/achievements/achievement-definitions.js';
import { loadCodexState, saveCodexState, discoverEntity, clearCodexState } from '../../src/game/codex/codex-store.js';
import { loadRecordsState, saveRecordsState, recordRun, clearRecordsState } from '../../src/game/records/records-store.js';
import type { RunRecord } from '../../src/game/records/types.js';
import { loadMasteryState, saveMasteryState, addMasteryKills, addMasteryExpedition, clearMasteryState } from '../../src/game/mastery/mastery-store.js';
import { masteryTier } from '../../src/game/mastery/types.js';
import { loadStoryArchiveState, saveStoryArchiveState, unlockStoryFragment, clearStoryArchiveState } from '../../src/game/story/story-store.js';

function resetStores(): void {
  clearAchievementState();
  clearCodexState();
  clearRecordsState();
  clearMasteryState();
  clearStoryArchiveState();
}

describe('Phase 35 — achievements', () => {
  afterEach(resetStores);

  it('loads empty state on first access', () => {
    const state = loadAchievementState();
    expect(Object.keys(state.achievements).length).toBe(ACHIEVEMENTS.length);
    for (const prog of Object.values(state.achievements)) {
      expect(prog.earned).toBe(false);
      expect(prog.current).toBe(0);
    }
  });

  it('round-trips through localStorage', () => {
    const state = loadAchievementState();
    saveAchievementState(state);
    const reloaded = loadAchievementState();
    expect(reloaded.achievements['kill_10']?.current).toBe(0);
  });

  it('increments progress without earning when below target', () => {
    const state = loadAchievementState();
    const { state: next, newlyEarned } = incrementAchievement(state, 'kill_10', 5);
    expect(next.achievements['kill_10']?.current).toBe(5);
    expect(next.achievements['kill_10']?.earned).toBe(false);
    expect(newlyEarned).toBe(false);
  });

  it('earns achievement when target is hit', () => {
    const state = loadAchievementState();
    const { state: next, newlyEarned } = incrementAchievement(state, 'kill_10', 10);
    expect(next.achievements['kill_10']?.earned).toBe(true);
    expect(next.achievements['kill_10']?.earnedAt).toBeGreaterThan(0);
    expect(newlyEarned).toBe(true);
  });

  it('caps progress at target', () => {
    const state = loadAchievementState();
    const { state: next } = incrementAchievement(state, 'kill_10', 999);
    expect(next.achievements['kill_10']?.current).toBe(10);
  });

  it('does not re-earn already earned achievements', () => {
    const state = loadAchievementState();
    const r1 = incrementAchievement(state, 'kill_10', 10);
    expect(r1.newlyEarned).toBe(true);
    const r2 = incrementAchievement(r1.state, 'kill_10', 5);
    expect(r2.newlyEarned).toBe(false);
    expect(r2.state.achievements['kill_10']?.current).toBe(10);
  });

  it('computes achievement stats', () => {
    let state = loadAchievementState();
    state = incrementAchievement(state, 'kill_10', 10).state;
    state = incrementAchievement(state, 'first_victory', 1).state;
    const stats = achievementStats(state);
    expect(stats.total).toBe(ACHIEVEMENTS.length);
    expect(stats.earned).toBe(2);
  });

  it('handles unknown achievement id gracefully', () => {
    const state = loadAchievementState();
    const { state: next, newlyEarned } = incrementAchievement(state, 'nonexistent', 1);
    expect(newlyEarned).toBe(false);
    expect(next).toBe(state);
  });
});

describe('Phase 35 — codex', () => {
  afterEach(resetStores);

  it('starts with empty codex', () => {
    const state = loadCodexState();
    expect(Object.keys(state.entries).length).toBe(0);
  });

  it('discovers new entities', () => {
    let state = loadCodexState();
    state = discoverEntity(state, 'goblin_scout', 'enemy');
    const entry = state.entries['goblin_scout'];
    expect(entry?.discovered).toBe(true);
    expect(entry?.category).toBe('enemy');
    expect(entry?.timesEncountered).toBe(1);
    expect(entry?.discoveredAt).toBeGreaterThan(0);
  });

  it('increments encounter count on re-encounter', () => {
    let state = loadCodexState();
    state = discoverEntity(state, 'goblin_scout', 'enemy');
    state = discoverEntity(state, 'goblin_scout', 'enemy');
    expect(state.entries['goblin_scout']?.timesEncountered).toBe(2);
  });

  it('round-trips through localStorage', () => {
    let state = loadCodexState();
    state = discoverEntity(state, 'goblin_scout', 'enemy');
    state = discoverEntity(state, 'rusted_sword', 'item');
    saveCodexState(state);
    const reloaded = loadCodexState();
    expect(Object.values(reloaded.entries).filter((e) => e.discovered).length).toBe(2);
  });
});

describe('Phase 35 — records', () => {
  afterEach(resetStores);

  it('starts with zeroed records', () => {
    const state = loadRecordsState();
    expect(state.totalExpeditions).toBe(0);
    expect(state.bestGoldRun).toBe(0);
    expect(state.recentRuns).toHaveLength(0);
  });

  it('records a victory run', () => {
    const run: RunRecord = {
      missionId: 'mission_tutorial',
      goldEarned: 500,
      killsEarned: 3,
      result: 'victory',
      nodesVisited: 6,
      timestamp: Date.now(),
    };
    let state = loadRecordsState();
    state = recordRun(state, run);
    expect(state.totalExpeditions).toBe(1);
    expect(state.totalVictories).toBe(1);
    expect(state.totalDefeats).toBe(0);
    expect(state.totalGoldEarned).toBe(500);
    expect(state.bestGoldRun).toBe(500);
    expect(state.recentRuns).toHaveLength(1);
    expect(state.recentRuns[0]?.missionId).toBe('mission_tutorial');
  });

  it('tracks per-mission best gold', () => {
    let state = loadRecordsState();
    state = recordRun(state, { missionId: 'mission_tutorial', goldEarned: 300, killsEarned: 0, result: 'victory', nodesVisited: 6, timestamp: 1 });
    state = recordRun(state, { missionId: 'mission_tutorial', goldEarned: 700, killsEarned: 0, result: 'victory', nodesVisited: 6, timestamp: 2 });
    expect(state.recordsPerMission['mission_tutorial']?.bestGold).toBe(700);
    expect(state.recordsPerMission['mission_tutorial']?.completions).toBe(2);
  });

  it('caps recent runs at 20', () => {
    let state = loadRecordsState();
    for (let i = 0; i < 25; i++) {
      state = recordRun(state, { missionId: 'mission_tutorial', goldEarned: 100, killsEarned: 0, result: 'victory', nodesVisited: 6, timestamp: i });
    }
    expect(state.recentRuns.length).toBeLessThanOrEqual(20);
  });

  it('round-trips through localStorage', () => {
    let state = loadRecordsState();
    state = recordRun(state, { missionId: 'mission_tutorial', goldEarned: 500, killsEarned: 3, result: 'victory', nodesVisited: 6, timestamp: 1 });
    saveRecordsState(state);
    const reloaded = loadRecordsState();
    expect(reloaded.totalExpeditions).toBe(1);
  });
});

describe('Phase 35 — mastery', () => {
  afterEach(resetStores);

  it('starts with empty mastery', () => {
    const state = loadMasteryState();
    expect(Object.keys(state.heroes).length).toBe(0);
  });

  it('adds kills to a hero', () => {
    let state = loadMasteryState();
    state = addMasteryKills(state, 'hero_001', 5);
    expect(state.heroes['hero_001']?.kills).toBe(5);
    expect(state.heroes['hero_001']?.expeditions).toBe(0);
  });

  it('adds expeditions to a hero', () => {
    let state = loadMasteryState();
    state = addMasteryExpedition(state, 'hero_001');
    state = addMasteryExpedition(state, 'hero_001');
    expect(state.heroes['hero_001']?.expeditions).toBe(2);
  });

  it('accumulates kills across calls', () => {
    let state = loadMasteryState();
    state = addMasteryKills(state, 'hero_001', 3);
    state = addMasteryKills(state, 'hero_001', 7);
    expect(state.heroes['hero_001']?.kills).toBe(10);
  });

  it('computes mastery tier correctly', () => {
    expect(masteryTier({ heroId: 'h', kills: 0, expeditions: 0 })).toBe(0);
    expect(masteryTier({ heroId: 'h', kills: 5, expeditions: 0 })).toBe(1);
    expect(masteryTier({ heroId: 'h', kills: 15, expeditions: 0 })).toBe(2);
    expect(masteryTier({ heroId: 'h', kills: 50, expeditions: 0 })).toBe(3);
    expect(masteryTier({ heroId: 'h', kills: 100, expeditions: 0 })).toBe(4);
    expect(masteryTier({ heroId: 'h', kills: 500, expeditions: 0 })).toBe(4);
  });

  it('round-trips through localStorage', () => {
    let state = loadMasteryState();
    state = addMasteryKills(state, 'hero_001', 10);
    saveMasteryState(state);
    const reloaded = loadMasteryState();
    expect(reloaded.heroes['hero_001']?.kills).toBe(10);
  });
});

describe('Phase 35 — story archive', () => {
  afterEach(resetStores);

  it('loads all story fragments as locked initially', () => {
    const state = loadStoryArchiveState();
    const frags = Object.values(state.fragments);
    expect(frags.length).toBeGreaterThan(0);
    for (const frag of frags) {
      expect(frag.unlocked).toBe(false);
    }
  });

  it('unlocks a story fragment', () => {
    let state = loadStoryArchiveState();
    state = unlockStoryFragment(state, 'story_intro');
    const frag = state.fragments['story_intro'];
    expect(frag?.unlocked).toBe(true);
    expect(frag?.unlockedAt).toBeGreaterThan(0);
  });

  it('does not re-unlock an already unlocked fragment', () => {
    let state = loadStoryArchiveState();
    state = unlockStoryFragment(state, 'story_intro');
    const firstAt = state.fragments['story_intro']?.unlockedAt;
    state = unlockStoryFragment(state, 'story_intro');
    expect(state.fragments['story_intro']?.unlockedAt).toBe(firstAt);
  });

  it('round-trips through localStorage', () => {
    let state = loadStoryArchiveState();
    state = unlockStoryFragment(state, 'story_intro');
    saveStoryArchiveState(state);
    const reloaded = loadStoryArchiveState();
    expect(reloaded.fragments['story_intro']?.unlocked).toBe(true);
  });
});
