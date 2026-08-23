/**
 * Phase 35 records domain: run statistics and records persisted across
 * expeditions. Tracks best gold, fastest victories, total kills, and
 * aggregate expedition metrics.
 */
export interface RunRecord {
  readonly missionId: string;
  readonly goldEarned: number;
  readonly result: 'victory' | 'defeat' | 'retreat';
  readonly nodesVisited: number;
  readonly timestamp: number;
}

export interface RecordsState {
  readonly totalExpeditions: number;
  readonly totalVictories: number;
  readonly totalDefeats: number;
  readonly totalKills: number;
  readonly totalGoldEarned: number;
  readonly totalNodesVisited: number;
  readonly bestGoldRun: number;
  readonly recentRuns: readonly RunRecord[]; // last 20
  readonly recordsPerMission: Readonly<Record<string, { bestGold: number; completions: number }>>;
}
