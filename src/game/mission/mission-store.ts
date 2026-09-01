/**
 * Mission store (MISSION_STORE_CONTRACT): browser-local persistence for
 * mission progress. Tracks unlock status, best gold, and completion count
 * per mission. On first run, tutorial is automatically available.
 */
import { MISSIONS } from './mission-definitions.js';
import type { MissionProgress, MissionState, MissionStatus } from './types.js';

const MISSION_KEY = 'rw.missions.v1';

function emptyProgress(): Record<string, MissionProgress> {
  const map: Record<string, MissionProgress> = {};
  for (const def of MISSIONS) {
    map[def.id] = {
      missionId: def.id,
      status: def.requiredMissions.length === 0 ? 'available' : 'locked',
      bestGold: 0,
      completions: 0,
    };
  }
  return map;
}

export function loadMissionState(): MissionState {
  try {
    const raw = localStorage.getItem(MISSION_KEY);
    if (!raw) return { missions: emptyProgress() };
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const missions: Record<string, MissionProgress> = {};
    for (const def of MISSIONS) {
      const entry = parsed[def.id] as Record<string, unknown> | undefined;
      missions[def.id] = {
        missionId: def.id,
        status: validateStatus(entry?.['status']),
        bestGold: typeof entry?.['bestGold'] === 'number' ? Math.max(0, Math.floor(entry['bestGold'])) : 0,
        completions: typeof entry?.['completions'] === 'number' ? Math.max(0, Math.floor(entry['completions'])) : 0,
      };
    }
    return { missions };
  } catch {
    return { missions: emptyProgress() };
  }
}

function validateStatus(raw: unknown): MissionStatus {
  if (raw === 'locked' || raw === 'available' || raw === 'completed') return raw;
  return 'locked';
}

export function saveMissionState(state: MissionState): void {
  const json: Record<string, unknown> = {};
  for (const [id, prog] of Object.entries(state.missions)) {
    json[id] = {
      missionId: prog.missionId,
      status: prog.status,
      bestGold: prog.bestGold,
      completions: prog.completions,
    };
  }
  localStorage.setItem(MISSION_KEY, JSON.stringify(json));
}

/** Record a mission completion and cascade unlocks. */
export function recordMissionCompletion(
  state: MissionState,
  missionId: string,
  goldEarned: number,
): MissionState {
  const prog = state.missions[missionId];
  if (!prog) return state;

  const updated: MissionProgress = {
    missionId: prog.missionId,
    status: 'completed',
    bestGold: Math.max(prog.bestGold, goldEarned),
    completions: prog.completions + 1,
  };

  const newMissions = { ...state.missions, [missionId]: updated };

  // Cascade: any mission whose requirements are all completed becomes available.
  for (const def of MISSIONS) {
    const current = newMissions[def.id];
    if (current?.status !== 'locked') continue;
    const allCleared = def.requiredMissions.every((req) => {
      const reqProg = newMissions[req];
      return reqProg?.status === 'completed';
    });
    if (allCleared) {
      newMissions[def.id] = { ...current, status: 'available' };
    }
  }

  return { missions: newMissions };
}

export function clearMissionState(): void {
  localStorage.removeItem(MISSION_KEY);
}
