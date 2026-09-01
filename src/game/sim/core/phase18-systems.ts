import { createPhase17Systems, type Phase17SystemsConfig } from './phase17-systems.js';
import { createStatusSystem, type StatusSystemConfig } from '../status/status-system.js';
import { createCleanseQueueSystem, createCleanseApplySystem, type CleanseDispelConfig } from '../status/cleanse-system.js';
import type { KernelSystem } from './tick-context.js';

export interface Phase18SystemsConfig extends Phase17SystemsConfig {
  /** Stage-I status/periodic configuration (T03, §7). Absent → timers advance, no LP deltas. */
  readonly status?: StatusSystemConfig;
  /** Stage-H/K cleanse/dispel configuration (T05, §9). Absent → no removal requests. */
  readonly cleanseDispel?: CleanseDispelConfig;
}

/**
 * Phase 18 A–M composition. Builds on the Phase 17 kernel and adds the status
 * subsystem: the stage-I `phase18.i1.status` system runs after the Phase-17
 * combat application (id-sorted) and owns the periodic/expiry pass, emitting
 * `EffectTick`/`EffectRemoved` and re-publishing the canonical collection via
 * `set_statuses` (allowed at stages I and K); the stage-H `cleanse_queue` and
 * stage-K `cleanse_apply` systems own the §9 cleanse/dispel removal path.
 * Status application itself stays content-driven — Phase 19 provides the
 * ability-trigger framework; this phase provides the deterministic plumbing
 * and UI-safe events (§15 step 8–11).
 */
export function createPhase18Systems(config: Phase18SystemsConfig): readonly KernelSystem[] {
  const base = createPhase17Systems(config);
  return Object.freeze([
    ...base,
    createStatusSystem(config.status),
    createCleanseQueueSystem(config.cleanseDispel),
    createCleanseApplySystem(),
  ]);
}
