import type { RandomSession } from '../random/random-session.js';
import type { ScheduledEvent } from '../scheduler/scheduled-event.js';
import type { BattleModel } from './battle-model.js';
import type { StageCommandBuffer } from './command-buffer.js';
import type { PipelineStage } from './pipeline-stage.js';
import type { TickInput } from './tick-input.js';
export interface TickContext {
  readonly stage: PipelineStage;
  readonly state: Readonly<BattleModel>;
  readonly input: Readonly<TickInput>;
  readonly dueEvents: readonly ScheduledEvent[];
  readonly random: RandomSession;
  readonly commands: StageCommandBuffer;
  readonly rules: Readonly<Record<string,unknown>>;
  readonly content: Readonly<Record<string,unknown>>;
}
export interface KernelSystem { readonly id:string; readonly stage:PipelineStage; run(context:TickContext):void; }
