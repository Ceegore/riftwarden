import { KernelInvariantError } from './invariant-error.js';
import type { KernelCommand } from './command-types.js';
import type { PipelineStage } from './pipeline-stage.js';

const ALLOWED: Readonly<Record<PipelineStage,readonly KernelCommand['kind'][]>> = Object.freeze({
  A:[], B:['set_timer'], C:['schedule_event'], D:['schedule_event'],  E:['set_target','append_event'],
  F:['set_position','set_movement_remainder','set_lane','set_lane_change','set_lane_change_cooldown','set_stuck_state','set_deadlock_state','set_global_progress','append_event'],
  G:['set_timer','schedule_event','set_attack_state','set_attack_lifecycle','set_attack_instance_seq','set_attack_interval_ready','set_projectiles','queue_combat_application','append_event'], H:['schedule_event','set_projectiles','queue_combat_application','append_event'],
  I:['apply_lp_delta','set_shields','clear_combat_applications','set_global_progress','append_event'], J:['entity_transition','remove_entity','set_global_progress','append_event'],
  K:['spawn_entity','remove_entity','set_position','set_global_progress','append_event'], L:['battle_transition','append_event'], M:['checkpoint_marker']
});
export class StageCommandBuffer {
  readonly #commands: KernelCommand[]=[];
  constructor(readonly stage:PipelineStage) {}
  push(command:KernelCommand):void {
    if (!ALLOWED[this.stage].includes(command.kind)) throw new KernelInvariantError('P14_COMMAND_STAGE',{stage:this.stage,kind:command.kind});
    this.#commands.push(command);
  }
  drain():readonly KernelCommand[]{ return Object.freeze(this.#commands.splice(0)); }
}
