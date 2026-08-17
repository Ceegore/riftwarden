import { StageCommandBuffer } from './command-buffer.js';
import { PIPELINE_STAGES, type PipelineStage } from './pipeline-stage.js';
import type { TickContext, KernelSystem } from './tick-context.js';
import type { BattleModel } from './battle-model.js';
import type { TickInput } from './tick-input.js';
import type { RandomSession } from '../random/random-session.js';
import type { ScheduledEvent } from '../scheduler/scheduled-event.js';
import type { KernelCommand } from './command-types.js';

export interface PipelineRunResult {
  readonly commands: Readonly<Record<PipelineStage, readonly KernelCommand[]>>;
  readonly callOrder: readonly string[];
}

export interface RunPipelineArgs {
  state: Readonly<BattleModel>;
  input: Readonly<TickInput>;
  dueEvents?: readonly ScheduledEvent[];
  random: RandomSession;
  rules: Readonly<Record<string, unknown>>;
  content: Readonly<Record<string, unknown>>;
  systems: readonly KernelSystem[];
}

export function runPipeline(args: RunPipelineArgs): PipelineRunResult {
  const commands = {} as Record<PipelineStage, readonly KernelCommand[]>;
  const callOrder: string[] = [];
  for (const [stage] of PIPELINE_STAGES) {
    const buffer = new StageCommandBuffer(stage);
    const systems = args.systems.filter((s) => s.stage === stage).sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    const context: TickContext = Object.freeze({
      stage,
      state: args.state,
      input: args.input,
      dueEvents: args.dueEvents ?? Object.freeze([]),
      random: args.random,
      commands: buffer,
      rules: args.rules,
      content: args.content,
    });
    for (const system of systems) {
      callOrder.push(`${stage}:${system.id}`);
      system.run(context);
    }
    commands[stage] = buffer.drain();
  }
  return Object.freeze({ commands: Object.freeze(commands), callOrder: Object.freeze(callOrder) });
}
