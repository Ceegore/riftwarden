import { PIPELINE_STAGES } from './pipeline-stage.js';
import type { KernelSystem } from './tick-context.js';

export function createNoopSystems(): readonly KernelSystem[] {
  return Object.freeze(
    PIPELINE_STAGES.map(([stage, , key]) =>
      Object.freeze({
        id: `noop.${key}`,
        stage,
        run: () => {
          // Intentional no-op: Phase 14 reserves the stage without game logic yet.
        },
      }),
    ),
  );
}
