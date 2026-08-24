/**
 * Phase 33 mission definitions (MISSION_CATALOG_CONTRACT): the pinned
 * list of launch missions. Each definition maps to a map profile; the
 * map generator uses the profile id to select layout rules.
 */
import type { MissionDefinition } from './types.js';

export const MISSIONS: readonly MissionDefinition[] = Object.freeze([
  {
    id: 'mission_tutorial',
    labelKey: 'mission.tutorial.label',
    descriptionKey: 'mission.tutorial.desc',
    mapProfileId: 'expedition.tutorial.v1',
    difficulty: 'normal',
    goldMultiplier: 1,
    instabilityRate: 1,
    requiredMissions: [],
    rewardPreviewKeys: ['reward.gold', 'reward.loot'],
  },
  {
    id: 'mission_act1_standard',
    labelKey: 'mission.act1_standard.label',
    descriptionKey: 'mission.act1_standard.desc',
    mapProfileId: 'expedition.act1.standard',
    difficulty: 'normal',
    goldMultiplier: 1,
    instabilityRate: 1,
    requiredMissions: [],
    rewardPreviewKeys: ['reward.gold', 'reward.loot', 'reward.relic'],
  },
  {
    id: 'mission_act1_hard',
    labelKey: 'mission.act1_hard.label',
    descriptionKey: 'mission.act1_hard.desc',
    mapProfileId: 'expedition.act1.hard',
    difficulty: 'hard',
    goldMultiplier: 1.5,
    instabilityRate: 1.5,
    requiredMissions: ['mission_act1_standard'],
    rewardPreviewKeys: ['reward.gold', 'reward.loot', 'reward.relic', 'reward.recruit'],
  },
  {
    id: 'mission_act1_ascension',
    labelKey: 'mission.act1_ascension.label',
    descriptionKey: 'mission.act1_ascension.desc',
    mapProfileId: 'expedition.act1.ascension',
    difficulty: 'ascension',
    goldMultiplier: 2,
    instabilityRate: 2,
    requiredMissions: ['mission_act1_hard'],
    rewardPreviewKeys: ['reward.gold', 'reward.loot', 'reward.relic', 'reward.recruit'],
  },
  {
    id: 'mission_act2_forest',
    labelKey: 'mission.act2_forest.label',
    descriptionKey: 'mission.act2_forest.desc',
    mapProfileId: 'expedition.act2.forest',
    difficulty: 'normal',
    goldMultiplier: 1.2,
    instabilityRate: 1.2,
    requiredMissions: ['mission_act1_standard'],
    rewardPreviewKeys: ['reward.gold', 'reward.loot', 'reward.relic'],
  },
  {
    id: 'mission_act2_caverns',
    labelKey: 'mission.act2_caverns.label',
    descriptionKey: 'mission.act2_caverns.desc',
    mapProfileId: 'expedition.act2.caverns',
    difficulty: 'hard',
    goldMultiplier: 1.5,
    instabilityRate: 1.5,
    requiredMissions: ['mission_act2_forest'],
    rewardPreviewKeys: ['reward.gold', 'reward.loot', 'reward.relic', 'reward.recruit'],
  },
] as readonly MissionDefinition[]);

/** Lookup a mission definition by id. Returns undefined for unknown ids. */
export function missionById(id: string): MissionDefinition | undefined {
  return MISSIONS.find((m) => m.id === id);
}

/** Resolve a saved expedition's map profile back to its mission identity. */
export function missionByMapProfileId(mapProfileId: string): MissionDefinition | undefined {
  return MISSIONS.find((mission) => mission.mapProfileId === mapProfileId);
}

/** All mission ids that a given mission depends on, transitively. */
export function transitiveRequirements(missionId: string): ReadonlySet<string> {
  const deps = new Set<string>();
  const queue = [missionId];
  for (const current of queue) {
    const def = missionById(current);
    if (!def) continue;
    for (const req of def.requiredMissions) {
      if (!deps.has(req)) {
        deps.add(req);
        queue.push(req);
      }
    }
  }
  return deps;
}

/** Validate the mission catalog: every referenced map profile must exist, no id collisions. */
export function validateMissionCatalog(): readonly string[] {
  const errors: string[] = [];
  const seen = new Set<string>();
  for (const m of MISSIONS) {
    if (seen.has(m.id)) {
      errors.push(`DUPLICATE_MISSION:${m.id}`);
    }
    seen.add(m.id);
    if (!m.id.startsWith('mission_')) {
      errors.push(`BAD_MISSION_ID:${m.id}`);
    }
    for (const req of m.requiredMissions) {
      if (!req.startsWith('mission_')) {
        errors.push(`BAD_REQUIREMENT:${m.id}->${req}`);
      }
    }
  }
  // Every requirement must reference a known mission.
  for (const m of MISSIONS) {
    for (const req of m.requiredMissions) {
      if (!missionById(req)) {
        errors.push(`UNKNOWN_REQUIREMENT:${m.id}->${req}`);
      }
    }
  }
  return errors;
}
