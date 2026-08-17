import type { BattlePhase } from './battle-state.js';
import type { TransitionRequest } from './entity-state.js';
import type { KernelEntity } from './entity.js';
import type { KernelEventInput } from '../events/event-types.js';
import type { ScheduledEventInput } from '../scheduler/scheduled-event.js';

export type KernelCommand =
  | Readonly<{kind:'schedule_event'; event:ScheduledEventInput}>
  | Readonly<{kind:'append_event'; event:KernelEventInput}>
  | Readonly<{kind:'entity_transition'; entityId:string; request:TransitionRequest}>
  | Readonly<{kind:'battle_transition'; to:BattlePhase; priority:number; reason:string}>
  | Readonly<{kind:'spawn_entity'; entity:KernelEntity}>
  | Readonly<{kind:'remove_entity'; entityId:string}>
  | Readonly<{kind:'set_target'; entityId:string; targetId:string|null}>
  | Readonly<{kind:'set_position'; entityId:string; lane:'top'|'middle'|'bottom'; x100:number}>
  | Readonly<{kind:'apply_lp_delta'; entityId:string; delta:number}>
  | Readonly<{kind:'set_timer'; entityId:string; timer:string; ticks:number}>
  | Readonly<{kind:'checkpoint_marker'; reason:'interval'|'terminal'}>;

export interface EntityTransitionBucket { readonly entityId:string; readonly requests:readonly TransitionRequest[]; }
export interface BattleTransitionRequest { readonly to:BattlePhase; readonly priority:number; readonly reason:string; }
