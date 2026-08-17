import { KernelInvariantError } from './invariant-error.js';

export const PIPELINE_STAGES = [
  ['A', 0, 'finalize_previous'],
  ['B', 10, 'timers'],
  ['C', 20, 'periodic'],
  ['D', 30, 'triggers'],
  ['E', 40, 'targeting'],
  ['F', 50, 'movement'],
  ['G', 60, 'cast_progress'],
  ['H', 70, 'resolve_committed'],
  ['I', 80, 'apply_effects'],
  ['J', 90, 'death_resolution'],
  ['K', 100, 'spawn'],
  ['L', 110, 'end_resolution'],
  ['M', 120, 'snapshot'],
] as const;

export type PipelineStage = (typeof PIPELINE_STAGES)[number][0];
export type PipelineStageKey = (typeof PIPELINE_STAGES)[number][2];

export function stagePriority(stage: PipelineStage): number {
  const entry = PIPELINE_STAGES.find((candidate) => candidate[0] === stage);
  if (!entry) throw new KernelInvariantError('P14_QUEUE_SORT', { stage });
  return entry[1];
}
