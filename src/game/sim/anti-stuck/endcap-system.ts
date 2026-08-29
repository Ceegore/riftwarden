import type { KernelEventInput } from '../events/event-types.js';
import type { KernelSystem } from '../core/tick-context.js';
import { objectiveAllowsBattleEnd } from '../objectives/combat-objective.js';
import { GLOBAL_NO_PROGRESS_RESOLVE_TICKS } from './anti-stuck.js';

function eventFor(payload: Record<string, number>): KernelEventInput {
  return Object.freeze({ type: 'RiftCollapseEndRequest', sourceId: null, targetIds: Object.freeze([]), contentIds: Object.freeze([]), payload: Object.freeze(payload), logTags: Object.freeze(['sim.phase15']) });
}

/**
 * Stage-L rift-collapse endcap (§9.4, §10). When the global no-progress endcap
 * has run the full 300+300 window, this system requests the authorized
 * time-limit resolution by transitioning the battle into RESOLVING_END. It is
 * level-safe: the ACTIVE guard means it fires exactly once — the terminal
 * outcome is decided later by the Phase 14/16 resolution logic, not here.
 */
export function createEndcapSystem(): KernelSystem {
  return {
    id: 'phase15.l.endcap',
    stage: 'L',
    run(context): void {
      if (context.state.phase.phase !== 'ACTIVE') return;
      // §8: a mission objective in progress (e.g. the survive_until window) is
      // not a mechanical stall — the endcap must not preempt the mission timer.
      const objectives = context.state.objectives;
      if (objectives !== undefined && !objectiveAllowsBattleEnd(objectives)) return;
      const collapseTicks = context.state.riftCollapseTicks;
      if (collapseTicks === undefined || collapseTicks < GLOBAL_NO_PROGRESS_RESOLVE_TICKS) return;
      context.commands.push({ kind: 'battle_transition', to: 'RESOLVING_END', priority: 120, reason: 'rift_collapse_timeout' });
      context.commands.push({ kind: 'append_event', event: eventFor({ collapseTicks }) });
    },
  };
}
