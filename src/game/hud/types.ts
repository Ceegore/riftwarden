// Phase 26 HUD contract layer: pure read-only presentation types for the
// battle HUD, pause/speed lifecycle, inspector selection, accessibility tree
// and tactical text view. Simulation snapshots/events stay authoritative;
// these values are plain projections consumed by presentation layers.

export type Side = 'PLAYER' | 'ENEMY';

export type Lane = 'TOP' | 'MIDDLE' | 'BOTTOM';

/** Exactly 50/100/200/300 percent (PAUSE_SPEED_LIFECYCLE_CONTRACT). */
export type SpeedPercent = 50 | 100 | 200 | 300;

export type PauseState = 'RUNNING' | 'PAUSE_REQUESTED' | 'PAUSED' | 'RESUME_REQUESTED' | 'BLOCKED_UNTIL_READY';

export interface PresentedEntity {
  readonly id: string;
  readonly side: Side;
  readonly lane: Lane;
  readonly x: number;
  readonly hp: number;
  readonly maxHp: number;
  readonly shield: number;
}

export interface WarningItem {
  readonly id: string;
  readonly dueTick: number;
  readonly severity: number;
  readonly lane: Lane;
  readonly x: number;
}

/**
 * Closed announcement kinds. Exactly four kinds may reach a live region;
 * damage/heal/shield/target/status-tick events are never announced.
 */
export type AnnouncementKind =
  | 'BATTLE_PHASE'
  | 'PLAYER_UNIT_LOST'
  | 'CRITICAL_BOSS_WARNING'
  | 'BATTLE_ENDED'
  | 'DAMAGE'
  | 'HEAL'
  | 'SHIELD_CHANGED'
  | 'TARGET_CHANGED'
  | 'STATUS_TICK';

export interface AnnouncementEvent {
  readonly id: string;
  readonly kind: AnnouncementKind;
  readonly text: string;
  readonly tick: number;
}
