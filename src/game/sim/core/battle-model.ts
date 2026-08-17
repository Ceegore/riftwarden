import type { AuthoritativeStreamSnapshot } from '../random/rng-stream-map.js';
import type { BattlePhaseState } from './battle-state.js';
import type { KernelEntity } from './entity.js';
import type { EventSequence, Tick } from './primitives.js';
import type { ScheduledEvent } from '../scheduler/scheduled-event.js';

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
}
