/**
 * Records store (RECORDS_STORE_CONTRACT): localStorage persistence for
 * expedition records and statistics. Updated after each expedition finishes.
 */
import type { RecordsState, RunRecord } from './types.js';

const RECORDS_KEY = 'rw.records.v1';

function empty(): RecordsState {
  return {
    totalExpeditions: 0,
    totalVictories: 0,
    totalDefeats: 0,
    totalKills: 0,
    totalGoldEarned: 0,
    totalNodesVisited: 0,
    bestGoldRun: 0,
    recentRuns: [],
    recordsPerMission: {},
  };
}

export function loadRecordsState(): RecordsState {
  try {
    const raw = localStorage.getItem(RECORDS_KEY);
    if (!raw) return empty();
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return {
      totalExpeditions: safeInt(parsed['totalExpeditions']),
      totalVictories: safeInt(parsed['totalVictories']),
      totalDefeats: safeInt(parsed['totalDefeats']),
      totalKills: safeInt(parsed['totalKills']),
      totalGoldEarned: safeInt(parsed['totalGoldEarned']),
      totalNodesVisited: safeInt(parsed['totalNodesVisited']),
      bestGoldRun: safeInt(parsed['bestGoldRun']),
      recentRuns: Array.isArray(parsed['recentRuns']) ? parsed['recentRuns'].slice(0, 20) : [],
      recordsPerMission: typeof parsed['recordsPerMission'] === 'object' && parsed['recordsPerMission'] !== null
        ? parsed['recordsPerMission'] as Record<string, { bestGold: number; completions: number }>
        : {},
    };
  } catch {
    return empty();
  }
}

function safeInt(v: unknown): number {
  return typeof v === 'number' ? Math.max(0, Math.floor(v)) : 0;
}

export function saveRecordsState(state: RecordsState): void {
  localStorage.setItem(RECORDS_KEY, JSON.stringify(state));
}

/** Record a finished run. Returns updated state. */
export function recordRun(state: RecordsState, run: RunRecord): RecordsState {
  const missionRec = state.recordsPerMission[run.missionId] ?? { bestGold: 0, completions: 0 };
  const updatedMission = {
    bestGold: Math.max(missionRec.bestGold, run.goldEarned),
    completions: missionRec.completions + 1,
  };

  return {
    totalExpeditions: state.totalExpeditions + 1,
    totalVictories: state.totalVictories + (run.result === 'victory' ? 1 : 0),
    totalDefeats: state.totalDefeats + (run.result === 'defeat' ? 1 : 0),
    totalKills: state.totalKills,
    totalGoldEarned: state.totalGoldEarned + run.goldEarned,
    totalNodesVisited: state.totalNodesVisited + run.nodesVisited,
    bestGoldRun: Math.max(state.bestGoldRun, run.goldEarned),
    recentRuns: [run, ...state.recentRuns].slice(0, 20),
    recordsPerMission: { ...state.recordsPerMission, [run.missionId]: updatedMission },
  };
}

export function clearRecordsState(): void {
  localStorage.removeItem(RECORDS_KEY);
}
