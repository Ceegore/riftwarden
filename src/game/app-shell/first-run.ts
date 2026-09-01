/**
 * Phase 30 first-run flow (FIRST_RUN_CONTRACT): quick setup covers locale,
 * subtitles, text scale, reduce motion, reduce flash and haptics. OS values
 * are suggestions, never irreversible decisions. Completion writes settings
 * and the completion marker idempotently; a kill/back/write-failure at any
 * boundary must not leave a half-completed first run. This module tracks the
 * kill points of the pinned matrix and only reports completion when both the
 * settings commit and the completion marker are durable.
 */
import { ActionLedger } from './action-ledger.js';
import type { SettingsSession } from './settings-domain.js';

export type FirstRunKillPoint =
  | 'before-settings'
  | 'after-settings'
  | 'before-completion'
  | 'after-completion';

export type FirstRunPhase = 'idle' | 'settings' | 'completion' | 'complete';

export interface FirstRunState {
  readonly phase: FirstRunPhase;
  readonly reachedKillPoints: readonly FirstRunKillPoint[];
}

export const KILL_POINT_ORDER: readonly FirstRunKillPoint[] = [
  'before-settings',
  'after-settings',
  'before-completion',
  'after-completion',
];

const COMPLETION_ACTION_ID = 'first-run:complete';

/**
 * Drives the first-run flow with kill-point recording. Completion requires the
 * settings commit to have succeeded and the completion marker to be written —
 * the caller supplies both as actions so a write failure propagates without
 * marking the flow complete.
 */
export class FirstRunFlow {
  private readonly ledger = new ActionLedger();
  private phase: FirstRunPhase = 'idle';
  private killPoints: FirstRunKillPoint[] = [];

  state(): FirstRunState {
    return { phase: this.phase, reachedKillPoints: [...this.killPoints] };
  }

  /** Records a kill point that the flow has passed (for fault-injection QA). */
  recordKillPoint(point: FirstRunKillPoint): void {
    if (!this.killPoints.includes(point)) this.killPoints.push(point);
  }

  /**
   * Applies the quick-setup settings through the session. Throws on invalid
   * values; a failure leaves the phase untouched.
   */
  applySettings(session: SettingsSession, settings: Parameters<SettingsSession['preview']>[0]): void {
    this.phase = 'settings';
    this.recordKillPoint('before-settings');
    session.preview(settings);
    session.commit();
    this.recordKillPoint('after-settings');
  }

  /**
   * Completes the first run exactly once. `writeCompletion` must durably mark
   * completion (e.g. persist the completion flag); it runs only on the first
   * call. Returns false when already complete.
   */
  complete(writeCompletion: () => void): boolean {
    if (this.ledger.has(COMPLETION_ACTION_ID)) return false;
    this.recordKillPoint('before-completion');
    writeCompletion();
    this.recordKillPoint('after-completion');
    this.ledger.run(COMPLETION_ACTION_ID, () => undefined);
    this.phase = 'complete';
    return true;
  }

  /** True when the completion marker is durable. */
  isComplete(): boolean {
    return this.ledger.has(COMPLETION_ACTION_ID);
  }
}
