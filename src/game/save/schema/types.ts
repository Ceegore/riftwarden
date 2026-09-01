export type TextScale = 100 | 125 | 150 | 175 | 200;

export type SaveCommitReason =
  | 'profile_change'
  | 'node_entered'
  | 'decision_committed'
  | 'battle_started'
  | 'battle_snapshot'
  | 'battle_finished'
  | 'reward_committed'
  | 'run_finished'
  | 'settings_changed'
  | 'manual_backup';

export type RecoveryReason =
  | 'none'
  | 'newest_slot_invalid'
  | 'run_invalid'
  | 'content_mismatch'
  | 'migration_failed'
  | 'renderer_unavailable'
  | 'insufficient_storage';

export interface SaveHeader {
  readonly schemaVersion: number;
  readonly contentVersion: string;
  readonly simulationVersion: string;
  readonly monotonicCommitId: number;
  readonly payloadId: string;
}

export interface SettingsSave extends SaveHeader {
  readonly language: 'de' | 'en';
  readonly textScale: TextScale;
  readonly masterVolume: number;
  readonly reducedMotion: boolean;
  readonly subtitleBackdrop?: boolean;
}

export interface ProfileSave extends SaveHeader {
  readonly permanentProgress: Readonly<{ readonly level: number; readonly experience: number }>;
  readonly inventory: Readonly<Record<string, number>>;
  readonly renown: number;
  readonly unlocks: readonly string[];
  readonly achievements: readonly string[];
  readonly statistics: Readonly<Record<string, number>>;
  readonly settingsRef: string;
}

export interface RunSave extends SaveHeader {
  readonly runMode: 'standard' | 'challenge';
  readonly runStatus: 'active' | 'safe_aborted' | 'finished';
  readonly mapState: Readonly<Record<string, unknown>>;
  readonly loadout: readonly string[];
  readonly loot: readonly string[];
  readonly decisions: readonly Readonly<{ readonly nodeId: string; readonly choiceId: string }>[];
  readonly seedRef: string;
  readonly battleSnapshot?: Readonly<{ readonly tick: number; readonly snapshotRef: string }>;
}

export interface SaveMigrationReport {
  readonly from: number;
  readonly to: number;
  readonly steps: readonly string[];
}
