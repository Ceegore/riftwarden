/**
 * Phase 33 mission tests (MISSION_CONTRACT): validates the mission
 * catalog, store persistence, unlock chains, and completion cascading.
 */
import { describe, expect, it } from 'vitest';
import { MISSIONS, missionById, transitiveRequirements, validateMissionCatalog } from '../../src/game/mission/mission-definitions.js';
import { loadMissionState, saveMissionState, recordMissionCompletion, clearMissionState } from '../../src/game/mission/mission-store.js';

describe('phase33 mission catalog', () => {
  it('validates the mission catalog with no errors', () => {
    const errors = validateMissionCatalog();
    expect(errors).toEqual([]);
  });

  it('has at least 4 launch missions', () => {
    expect(MISSIONS.length).toBeGreaterThanOrEqual(4);
  });

  it('every mission has a valid map profile id', () => {
    for (const mission of MISSIONS) {
      expect(mission.mapProfileId).toBeTruthy();
      expect(mission.mapProfileId.startsWith('expedition.')).toBe(true);
    }
  });

  it('tutorial mission has no requirements', () => {
    const tutorial = missionById('mission_tutorial');
    expect(tutorial).toBeDefined();
    expect(tutorial?.requiredMissions).toEqual([]);
  });

  it('act1 standard has no requirements', () => {
    const mission = missionById('mission_act1_standard');
    expect(mission).toBeDefined();
    expect(mission?.requiredMissions).toEqual([]);
  });

  it('hard missions require their standard counterpart', () => {
    const hard = missionById('mission_act1_hard');
    expect(hard?.requiredMissions).toContain('mission_act1_standard');
  });

  it('ascension requires hard', () => {
    const asc = missionById('mission_act1_ascension');
    expect(asc?.requiredMissions).toContain('mission_act1_hard');
  });

  it('transitive requirements include all prerequisites', () => {
    const reqs = transitiveRequirements('mission_act1_ascension');
    expect(reqs.has('mission_act1_hard')).toBe(true);
    expect(reqs.has('mission_act1_standard')).toBe(true);
  });

  it('all mission ids start with mission_ prefix', () => {
    for (const mission of MISSIONS) {
      expect(mission.id.startsWith('mission_')).toBe(true);
    }
  });

  it('all difficulties are valid', () => {
    const valid = new Set(['normal', 'hard', 'ascension']);
    for (const mission of MISSIONS) {
      expect(valid.has(mission.difficulty), `invalid difficulty for ${mission.id}`).toBe(true);
    }
  });

  it('gold multiplier is non-negative', () => {
    for (const mission of MISSIONS) {
      expect(mission.goldMultiplier).toBeGreaterThan(0);
    }
  });

  it('missionById returns undefined for unknown id', () => {
    expect(missionById('nonexistent')).toBeUndefined();
  });
});

describe('phase33 mission store', () => {
  it('initializes with tutorial and act1_standard available', () => {
    clearMissionState();
    const state = loadMissionState();
    expect(state.missions['mission_tutorial']?.status).toBe('available');
    expect(state.missions['mission_act1_standard']?.status).toBe('available');
  });

  it('locks missions whose requirements are unmet', () => {
    clearMissionState();
    const state = loadMissionState();
    expect(state.missions['mission_act1_hard']?.status).toBe('locked');
    expect(state.missions['mission_act1_ascension']?.status).toBe('locked');
  });

  it('persists and restores mission state', () => {
    clearMissionState();
    let state = loadMissionState();
    state = recordMissionCompletion(state, 'mission_act1_standard', 255);
    saveMissionState(state);

    const restored = loadMissionState();
    const prog = restored.missions['mission_act1_standard'];
    expect(prog?.status).toBe('completed');
    expect(prog?.bestGold).toBe(255);
    expect(prog?.completions).toBe(1);
  });

  it('completing act1_standard unlocks act1_hard and act2_forest', () => {
    clearMissionState();
    let state = loadMissionState();
    state = recordMissionCompletion(state, 'mission_act1_standard', 200);

    expect(state.missions['mission_act1_hard']?.status).toBe('available');
    expect(state.missions['mission_act2_forest']?.status).toBe('available');
  });

  it('completing hard does not yet unlock ascension until hard too', () => {
    clearMissionState();
    let state = loadMissionState();
    // First complete standard, but don't cascade further.
    state = recordMissionCompletion(state, 'mission_act1_standard', 200);
    // hard should now be available.
    expect(state.missions['mission_act1_hard']?.status).toBe('available');
    // ascension still locked because hard is not completed.
    expect(state.missions['mission_act1_ascension']?.status).toBe('locked');

    // Now complete hard.
    state = recordMissionCompletion(state, 'mission_act1_hard', 300);
    expect(state.missions['mission_act1_ascension']?.status).toBe('available');
  });

  it('best gold only increases, never decreases', () => {
    clearMissionState();
    let state = loadMissionState();
    state = recordMissionCompletion(state, 'mission_act1_standard', 100);
    expect(state.missions['mission_act1_standard']?.bestGold).toBe(100);

    state = recordMissionCompletion(state, 'mission_act1_standard', 50);
    expect(state.missions['mission_act1_standard']?.bestGold).toBe(100);

    state = recordMissionCompletion(state, 'mission_act1_standard', 300);
    expect(state.missions['mission_act1_standard']?.bestGold).toBe(300);
  });

  it('completions counter increments', () => {
    clearMissionState();
    let state = loadMissionState();
    state = recordMissionCompletion(state, 'mission_act1_standard', 100);
    expect(state.missions['mission_act1_standard']?.completions).toBe(1);
    state = recordMissionCompletion(state, 'mission_act1_standard', 200);
    expect(state.missions['mission_act1_standard']?.completions).toBe(2);
  });

  it('handles completion of unknown mission gracefully', () => {
    clearMissionState();
    const state = loadMissionState();
    const after = recordMissionCompletion(state, 'nonexistent', 0);
    expect(after).toBe(state); // unchanged
  });

  it('save and load preserves all mission statuses', () => {
    clearMissionState();
    let state = loadMissionState();
    state = recordMissionCompletion(state, 'mission_tutorial', 150);
    state = recordMissionCompletion(state, 'mission_act1_standard', 200);
    saveMissionState(state);

    const restored = loadMissionState();
    for (const def of MISSIONS) {
      const orig = state.missions[def.id];
      const restored_prog = restored.missions[def.id];
      expect(restored_prog?.status).toBe(orig?.status);
      expect(restored_prog?.bestGold).toBe(orig?.bestGold);
      expect(restored_prog?.completions).toBe(orig?.completions);
    }
  });

  it('clearMissionState resets everything', () => {
    clearMissionState();
    let state = loadMissionState();
    state = recordMissionCompletion(state, 'mission_tutorial', 150);
    saveMissionState(state);

    clearMissionState();
    const fresh = loadMissionState();
    expect(fresh.missions['mission_tutorial']?.status).toBe('available');
    expect(fresh.missions['mission_tutorial']?.completions).toBe(0);
  });
});
