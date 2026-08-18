import type { AuthoritativeStreamSnapshot } from '../random/rng-stream-map.js';
import type { BattlePhaseState } from './battle-state.js';
import type { KernelEntity } from './entity.js';
import type { EventSequence, Tick } from './primitives.js';
import type { ScheduledEvent } from '../scheduler/scheduled-event.js';
import type { ProjectileState } from '../projectile/projectile-state.js';
import type { PendingCombatApplication } from '../combat/combat-application.js';
import type { StatusInstance } from '../status/status-instance.js';

export interface BattleModel {
  readonly schemaVersion: 1;
  readonly simulationVersion: string;
  readonly battleId: string;
  readonly tick: Tick;
  readonly nextSequence: EventSequence;
  readonly emittedEventCount: number;
  readonly phase: BattlePhaseState;
  readonly entities: readonly KernelEntity[];
  readonly scheduledEvents: readonly ScheduledEvent[];
  readonly authoritativeStreams: AuthoritativeStreamSnapshot;
  readonly endReason: string|null;
  // Phase 15 additive battle-level fields (§9.4). Absent on Phase 14 fixtures;
  // when present they are authoritative and projected into the snapshot.
  readonly globalNoProgressTicks?: number;
  readonly riftCollapseTicks?: number;
  readonly riftCollapseWarningEmitted?: boolean;
  // Phase 17 additive combat fields (T02 projectiles, T04 pending applications).
  readonly projectiles?: readonly ProjectileState[];
  readonly pendingCombatApplications?: readonly PendingCombatApplication[];
  readonly combatApplicationSeq?: number;
  // Phase 17 additive battle-end field (T06): first tick of the rift-collapse
  // window; undefined before the soft limit is reached.
  readonly timeCollapseSinceTick?: number;
  // Phase 17 additive battle-end field (T06): total damage each side dealt to
  // the opposing boss(es), used by the Chapter-76 boss-damage tie-break.
  readonly bossDamageDealt?: Readonly<{ player: number; enemy: number }>;
  // Phase 18 additive status field (T01–T06): canonically sorted active status
  // instances, projected into the snapshot. Absent on Phase 14–17 fixtures.
  readonly statuses?: readonly StatusInstance[];
}
