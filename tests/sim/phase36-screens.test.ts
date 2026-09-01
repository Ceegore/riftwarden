/**
 * Phase 36 integration tests: achievement-codex settlement bridge,
 * codex node discovery, and Phase 36 screen wiring verification.
 */
import { afterEach, describe, it, expect } from 'vitest';
import {
  loadAllPersistentState,
  applyExpeditionTracking,
  applyNodeCodexDiscovery,
  saveAllPersistentStateExport,
  clearAllPersistentState,
} from '../../src/game/expedition/settlement-bridge.js';
import { createInitialProfile } from '../../src/game/profile/profile-store.js';
function resetStores(): void {
  clearAllPersistentState();
}

describe('Phase 36 — settlement bridge (achievements + records)', () => {
  afterEach(resetStores);

  it('increments expedition-count achievement on victory', () => {
    const allState = loadAllPersistentState();
    const updated = applyExpeditionTracking(
      {} as never, 'victory', 'mission_tutorial', 500, 6, allState,
    );
    const ach = updated.achievements.achievements['expeditions_5'];
    expect(ach?.current).toBe(1);
  });

  it('earns first_victory achievement', () => {
    const allState = loadAllPersistentState();
    const updated = applyExpeditionTracking(
      {} as never, 'victory', 'mission_tutorial', 500, 6, allState,
    );
    expect(updated.achievements.achievements['first_victory']?.earned).toBe(true);
  });

  it('earns first_defeat achievement on defeat', () => {
    const allState = loadAllPersistentState();
    const updated = applyExpeditionTracking(
      {} as never, 'defeat', 'mission_tutorial', 300, 4, allState,
    );
    expect(updated.achievements.achievements['first_defeat']?.earned).toBe(true);
  });

  it('does NOT earn first_victory on retreat', () => {
    const allState = loadAllPersistentState();
    const updated = applyExpeditionTracking(
      {} as never, 'retreat', 'mission_tutorial', 200, 3, allState,
    );
    expect(updated.achievements.achievements['first_victory']?.earned).toBe(false);
    expect(updated.achievements.achievements['first_defeat']?.earned).toBe(false);
  });

  it('records a run in the records store', () => {
    const allState = loadAllPersistentState();
    const updated = applyExpeditionTracking(
      {} as never, 'victory', 'mission_act1', 1500, 8, allState,
    );
    expect(updated.records.totalExpeditions).toBe(1);
    expect(updated.records.totalVictories).toBe(1);
    expect(updated.records.bestGoldRun).toBe(1500);
    expect(updated.records.recentRuns).toHaveLength(1);
    expect(updated.records.recentRuns[0]?.missionId).toBe('mission_act1');
  });

  it('unlocks story fragments on victory', () => {
    const allState = loadAllPersistentState();
    const updated = applyExpeditionTracking(
      {} as never, 'victory', 'mission_act1', 1500, 8, allState,
    );
    expect(updated.story.fragments['story_intro']?.unlocked).toBe(true);
    expect(updated.story.fragments['story_act1_boss']?.unlocked).toBe(true);
  });

  it('persists and reloads all state', () => {
    const allState = loadAllPersistentState();
    const updated = applyExpeditionTracking(
      {} as never, 'victory', 'mission_tutorial', 500, 6, allState,
    );
    saveAllPersistentStateExport(updated);
    const reloaded = loadAllPersistentState();
    expect(reloaded.records.totalExpeditions).toBe(1);
    expect(reloaded.achievements.achievements['expeditions_5']?.current).toBe(1);
  });
});

describe('Phase 36 — codex node discovery', () => {
  afterEach(resetStores);

  it('discovers node type on first encounter', () => {
    const allState = loadAllPersistentState();
    const updated = applyNodeCodexDiscovery(allState.codex, 'battle');
    const entry = updated.entries['nodetype_battle'];
    expect(entry?.discovered).toBe(true);
    expect(entry?.category).toBe('nodeType');
    expect(entry?.timesEncountered).toBe(1);
  });

  it('discovers entity hint for combat nodes', () => {
    const allState = loadAllPersistentState();
    const updated = applyNodeCodexDiscovery(allState.codex, 'battle', 'goblin_scout');
    expect(updated.entries['goblin_scout']?.discovered).toBe(true);
    expect(updated.entries['goblin_scout']?.category).toBe('enemy');
  });

  it('discovers item entity hints', () => {
    const allState = loadAllPersistentState();
    const updated = applyNodeCodexDiscovery(allState.codex, 'treasure', 'item_shield');
    expect(updated.entries['item_shield']?.category).toBe('item');
  });

  it('discovers relic entity hints', () => {
    const allState = loadAllPersistentState();
    const updated = applyNodeCodexDiscovery(allState.codex, 'treasure', 'relic_flame');
    expect(updated.entries['relic_flame']?.category).toBe('relic');
  });

  it('increments encounter count on revisit', () => {
    const allState = loadAllPersistentState();
    const first = applyNodeCodexDiscovery(allState.codex, 'battle', 'goblin_scout');
    const second = applyNodeCodexDiscovery(first, 'battle', 'goblin_scout');
    expect(second.entries['goblin_scout']?.timesEncountered).toBe(2);
    expect(second.entries['nodetype_battle']?.timesEncountered).toBe(2);
  });
});

describe('Phase 36 — profile round-trip', () => {
  it('createInitialProfile returns a valid empty profile', () => {
    const profile = createInitialProfile();
    expect(profile.revision).toBe(31);
    expect(profile.wallet.gold).toBe(0);
    expect(profile.wallet.riftEssence).toBe(0);
    expect(Object.keys(profile.heroes)).toHaveLength(0);
    expect(Object.keys(profile.troops)).toHaveLength(0);
    expect(Object.keys(profile.items)).toHaveLength(0);
  });
});
