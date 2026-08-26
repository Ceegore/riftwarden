import type { BattlePhase } from './battle-state.js';
import type { TransitionRequest } from './entity-state.js';
import type { KernelEntity } from './entity.js';
import type { KernelEventInput } from '../events/event-types.js';
import type { AttackState } from '../attack/attack-state.js';
import type { ShieldSource } from '../combat/shield-ledger.js';
import type { PendingCombatApplication } from '../combat/combat-application.js';
import type { ProjectileState } from '../projectile/projectile-state.js';
import type { ScheduledEventInput } from '../scheduler/scheduled-event.js';
import type { Lane } from '../geometry/x100.js';
import type { LaneChange } from '../movement/lane-change.js';
import type { StatusInstance } from '../status/status-instance.js';
import type { CleanseDispelKind } from '../status/cleanse-dispel.js';
import type { AbilityInstance } from '../ability/ability-system.js';
import type { EffectCommand } from '../ability/effect-command.js';
import type { TempEntity } from '../summon/temporary-entity.js';
import type { SynergyTier } from '../synergy/synergy-counter.js';
import type { BossPhaseSnapshot } from '../boss/boss-phase-system.js';
import type { ModifierDefinition } from '../world/modifier-system.js';
import type { Hazard } from '../world/hazard-system.js';
import type { Objective } from '../objectives/combat-objective.js';

export type KernelCommand =
  | Readonly<{kind:'schedule_event'; event:ScheduledEventInput}>
  | Readonly<{kind:'append_event'; event:KernelEventInput}>
  | Readonly<{kind:'entity_transition'; entityId:string; request:TransitionRequest}>
  | Readonly<{kind:'battle_transition'; to:BattlePhase; priority:number; reason:string}>
  | Readonly<{kind:'force_battle_outcome'; outcome:'VICTORY'|'DEFEAT'|'DRAW_ABORT'; reason:string}>
  | Readonly<{kind:'spawn_entity'; entity:KernelEntity}>
  | Readonly<{kind:'remove_entity'; entityId:string}>
  | Readonly<{kind:'set_target'; entityId:string; targetId:string|null}>
  | Readonly<{kind:'set_position'; entityId:string; lane:Lane; x100:number}>
  | Readonly<{kind:'set_movement_remainder'; entityId:string; remainder:number}>
  | Readonly<{kind:'set_lane'; entityId:string; lane:Lane}>
  | Readonly<{kind:'set_lane_change'; entityId:string; state:LaneChange|null}>
  | Readonly<{kind:'set_lane_change_cooldown'; entityId:string; untilTick:number}>
  | Readonly<{kind:'set_attack_state'; entityId:string; inRangeSinceTick:number|null}>
  | Readonly<{kind:'set_attack_lifecycle'; entityId:string; state:AttackState|null; recoveryMovementLockedUntilTick:number}>
  | Readonly<{kind:'set_attack_instance_seq'; entityId:string; seq:number}>
  | Readonly<{kind:'set_attack_interval_ready'; entityId:string; readyTick:number}>
  | Readonly<{kind:'set_stuck_state'; entityId:string; noProgressTicks:number; repathTicks:readonly number[]; laneFallbackUsed:boolean; stopGapBonusUntilTick:number}>
  | Readonly<{kind:'set_deadlock_state'; entityId:string; blockedTicks:number; buffConsumed:boolean; buffedEntityId:string|null}>
  | Readonly<{kind:'set_global_progress'; noProgressTicks:number; collapseTicks:number; warned:boolean}>
  | Readonly<{kind:'apply_lp_delta'; entityId:string; delta:number; sourceId?:string|null}>
  | Readonly<{kind:'set_shields'; entityId:string; shields:readonly ShieldSource[]}>
  | Readonly<{kind:'queue_combat_application'; application:PendingCombatApplication}>
  | Readonly<{kind:'clear_combat_applications'}>
  | Readonly<{kind:'set_projectiles'; projectiles:readonly ProjectileState[]}>
  | Readonly<{kind:'set_pending_overkill'; entityId:string; overkill:number}>
  | Readonly<{kind:'set_revive_count'; entityId:string; count:number}>
  | Readonly<{kind:'set_time_collapse'; sinceTick:number|null}>
  | Readonly<{kind:'record_boss_damage'; side:'player'|'enemy'; amount:number}>
  | Readonly<{kind:'set_timer'; entityId:string; timer:string; ticks:number}>
  | Readonly<{kind:'set_statuses'; statuses:readonly StatusInstance[]}>
  | Readonly<{kind:'queue_cleanse_dispel'; targetId:string; request:CleanseDispelKind}>
  | Readonly<{kind:'clear_pending_cleanses'}>
  | Readonly<{kind:'set_abilities'; abilities:readonly AbilityInstance[]}>
  | Readonly<{kind:'set_planned_effects'; effects:readonly EffectCommand[]}>
  | Readonly<{kind:'set_temporary_entities'; entities:readonly TempEntity[]}>
  | Readonly<{kind:'set_synergy_tiers'; tiers:Readonly<Record<string, SynergyTier>>}>
  | Readonly<{kind:'set_boss_phase'; bossPhase:BossPhaseSnapshot}>
  | Readonly<{kind:'set_modifiers'; modifiers:readonly ModifierDefinition[]}>
  | Readonly<{kind:'set_hazards'; hazards:readonly Hazard[]}>
  | Readonly<{kind:'set_objectives'; objectives:readonly Objective[]}>
  | Readonly<{kind:'set_spawned_waves'; spawnedWaves:readonly string[]}>
  | Readonly<{kind:'checkpoint_marker'; reason:'interval'|'terminal'}>;

export interface CleanseDispelRequest { readonly targetId:string; readonly kind:CleanseDispelKind; }

export interface EntityTransitionBucket { readonly entityId:string; readonly requests:readonly TransitionRequest[]; }
export interface BattleTransitionRequest { readonly to:BattlePhase; readonly priority:number; readonly reason:string; }
