import type { AuthoritativeStreamSnapshot } from '../random/rng-stream-map.js';
import type { BattlePhaseState } from './battle-state.js';
import type { KernelEntity } from './entity.js';
import type { EventSequence, Tick } from './primitives.js';
import type { ScheduledEvent } from '../scheduler/scheduled-event.js';
import type { ProjectileState } from '../projectile/projectile-state.js';
import type { PendingCombatApplication } from '../combat/combat-application.js';
import type { StatusInstance } from '../status/status-instance.js';
import type { CleanseDispelRequest } from './command-types.js';
import type { AbilityInstance } from '../ability/ability-system.js';
import type { EffectCommand } from '../ability/effect-command.js';
import type { EventType } from '../events/event-spec.js';
import type { TempEntity } from '../summon/temporary-entity.js';
import type { SynergyTier } from '../synergy/synergy-counter.js';

/** Compact record of an event emitted during a tick, for trigger history. */
export interface TickEventRecord {
  readonly type: EventType;
  readonly sourceId: string | null;
  readonly targetIds: readonly string[];
}

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
  // Phase 18 additive cleanse/dispel field (T05): requests queued at stage H
  // and consumed by the stage-K removal system (§4).
  readonly pendingCleanses?: readonly CleanseDispelRequest[];
  // Phase 19 additive ability field (T04): canonical ability-instance
  // collection with lifecycle state, projected into the snapshot (§11).
  readonly abilities?: readonly AbilityInstance[];
  // Phase 19 additive planned-effect field (T03): canonically ordered effect
  // commands queued by committed casts, dispatched at their target stage (§7).
  readonly plannedEffects?: readonly EffectCommand[];
  // Phase 19 additive trigger-history fields (T01, §5.2): LP of every entity
  // at the start of the previous tick and the events emitted during it. Only
  // present on ability-aware (Phase 19+) states; consumed by the stage-D
  // trigger evaluator.
  readonly previousTickLp?: Readonly<Record<string, number>>;
  readonly previousTickEvents?: readonly TickEventRecord[];
  // Phase 20 additive temporary-entity registry field (§8): canonically sorted
  // temporary entities (SUMMON/CONSTRUCT/BOSS_OBJECT), projected into the
  // snapshot. Absent on Phase 14–19 fixtures.
  readonly temporaryEntities?: readonly TempEntity[];
  // Phase 20 additive synergy field (§4 step 7): committed tier map, projected
  // into the snapshot. Absent on Phase 14–19 fixtures.
  readonly synergyTiers?: Readonly<Record<string, SynergyTier>>;
}
