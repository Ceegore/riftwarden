import type { BattlePhase } from './battle-state.js';
import type { TransitionRequest } from './entity-state.js';
import type { KernelEntity } from './entity.js';
import type { KernelEventInput } from '../events/event-types.js';
import type { ScheduledEventInput } from '../scheduler/scheduled-event.js';
import type { Lane } from '../geometry/x100.js';
import type { LaneChange } from '../movement/lane-change.js';

export type KernelCommand =
  | Readonly<{kind:'schedule_event'; event:ScheduledEventInput}>
  | Readonly<{kind:'append_event'; event:KernelEventInput}>
  | Readonly<{kind:'entity_transition'; entityId:string; request:TransitionRequest}>
  | Readonly<{kind:'battle_transition'; to:BattlePhase; priority:number; reason:string}>
  | Readonly<{kind:'spawn_entity'; entity:KernelEntity}>
  | Readonly<{kind:'remove_entity'; entityId:string}>
  | Readonly<{kind:'set_target'; entityId:string; targetId:string|null}>
  | Readonly<{kind:'set_position'; entityId:string; lane:Lane; x100:number}>
  | Readonly<{kind:'set_movement_remainder'; entityId:string; remainder:number}>
  | Readonly<{kind:'set_lane'; entityId:string; lane:Lane}>
  | Readonly<{kind:'set_lane_change'; entityId:string; state:LaneChange|null}>
  | Readonly<{kind:'set_lane_change_cooldown'; entityId:string; untilTick:number}>
  | Readonly<{kind:'set_stuck_state'; entityId:string; noProgressTicks:number; repathTicks:readonly number[]; laneFallbackUsed:boolean}>
  | Readonly<{kind:'set_deadlock_state'; entityId:string; blockedTicks:number; buffConsumed:boolean; buffedEntityId:string|null}>
  | Readonly<{kind:'set_global_progress'; noProgressTicks:number; collapseTicks:number; warned:boolean}>
  | Readonly<{kind:'apply_lp_delta'; entityId:string; delta:number}>
  | Readonly<{kind:'set_timer'; entityId:string; timer:string; ticks:number}>
  | Readonly<{kind:'checkpoint_marker'; reason:'interval'|'terminal'}>;

export interface EntityTransitionBucket { readonly entityId:string; readonly requests:readonly TransitionRequest[]; }
export interface BattleTransitionRequest { readonly to:BattlePhase; readonly priority:number; readonly reason:string; }
