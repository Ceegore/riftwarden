/**
 * Phase 33 mission tests (MISSION_CONTRACT): validates the mission
 * catalog, store persistence, unlock chains, and completion cascading.
 */
import { describe, expect, it } from 'vitest';
import { MISSIONS, missionById, transitiveRequirements, validateMissionCatalog } from '../../src/game/mission/mission-definitions.js';
import { loadMissionState, saveMissionState, recordMissionCompletion, clearMissionState } from '../../src/game/mission/mission-store.js';
import { REGION_PROFILES } from '../../src/game/content/runtime/region-profiles.js';
import { DEFAULT_TYPE_WEIGHTS } from '../../src/game/expedition/map-generator.js';
import { NODE_TYPES } from '../../src/game/expedition/types.js';

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

describe('phase38 region profile validation', () => {
  const VALID_TYPES = new Set(NODE_TYPES);

  it('every mission mapProfileId has a matching region profile', () => {
    for (const mission of MISSIONS) {
      expect(
        REGION_PROFILES[mission.mapProfileId],
        `mission ${mission.id} references missing region profile ${mission.mapProfileId}`,
      ).toBeDefined();
    }
  });

  it('every region profile weight table sums to 100', () => {
    for (const [id, region] of Object.entries(REGION_PROFILES)) {
      let sum = 0;
      for (const [, weight] of region.typeWeights) {
        sum += weight;
      }
      expect(sum, `region ${id} weights sum to ${String(sum)}, expected 100`).toBe(100);
    }
  });

  it('every region profile weight entry uses a valid NodeType', () => {
    for (const [id, region] of Object.entries(REGION_PROFILES)) {
      for (const [type] of region.typeWeights) {
        expect(VALID_TYPES.has(type), `region ${id} uses unknown NodeType ${type}`).toBe(true);
      }
    }
  });

  it('every region profile has mandatory roles', () => {
    for (const [, region] of Object.entries(REGION_PROFILES)) {
      expect(region.profile.mandatoryRoles).toContain('anchor');
      expect(region.profile.mandatoryRoles).toContain('preparation');
      expect(region.profile.mandatoryRoles).toContain('boss');
    }
  });

  it('every region profile has logicalLevels = 6', () => {
    for (const [, region] of Object.entries(REGION_PROFILES)) {
      expect(region.profile.logicalLevels).toBe(6);
    }
  });

  it('default type weights sum to 100', () => {
    let sum = 0;
    for (const [, weight] of DEFAULT_TYPE_WEIGHTS) {
      sum += weight;
    }
    expect(sum).toBe(100);
  });

  it('default type weights only use valid NodeTypes', () => {
    for (const [type] of DEFAULT_TYPE_WEIGHTS) {
      expect(VALID_TYPES.has(type), `DEFAULT_TYPE_WEIGHTS uses unknown NodeType ${type}`).toBe(true);
    }
  });

  it('region profiles are frozen', () => {
    expect(Object.isFrozen(REGION_PROFILES)).toBe(true);
  });

  it('tutorial profile is battle-heavy', () => {
    const tutorial = REGION_PROFILES['expedition.tutorial.v1'];
    expect(tutorial).toBeDefined();
    if (!tutorial) return;
    const battleEntry = tutorial.typeWeights.find(([t]) => t === 'battle');
    expect(battleEntry).toBeDefined();
    if (battleEntry === undefined) return;
    expect(battleEntry[1]).toBeGreaterThanOrEqual(40);
  });

  it('ruins profile is altar-heavy', () => {
    const ruins = REGION_PROFILES['expedition.act3.ruins'];
    expect(ruins).toBeDefined();
    if (!ruins) return;
    const altarEntry = ruins.typeWeights.find(([t]) => t === 'altar');
    expect(altarEntry).toBeDefined();
    if (altarEntry === undefined) return;
    expect(altarEntry[1]).toBe(20);
  });

  it('ascension profile has the highest elite weight', () => {
    let maxElite = 0;
    for (const region of Object.values(REGION_PROFILES)) {
      const eliteEntry = region.typeWeights.find(([t]) => t === 'elite');
      if (eliteEntry !== undefined && eliteEntry[1] > maxElite) maxElite = eliteEntry[1];
    }
    const asc = REGION_PROFILES['expedition.act1.ascension'];
    expect(asc).toBeDefined();
    if (!asc) return;
    const ascElite = asc.typeWeights.find(([t]) => t === 'elite');
    expect(ascElite).toBeDefined();
    if (ascElite === undefined) return;
    expect(ascElite[1]).toBe(maxElite);
  });
});
