import type { KernelEventInput } from '../events/event-types.js';
import type { KernelSystem, TickContext } from '../core/tick-context.js';
import { edgeDistanceX100, type Body } from '../geometry/distance.js';
import { asX100, nonNegativeX100, type X100 } from '../geometry/x100.js';

export interface AttackPrepConfig {
  /**
   * Preferred range in X100 per entity id. Only entities with a configured
   * range participate; the check uses the inclusive edge distance (§4.2).
   */
  readonly preferredRangeX100?: Readonly<Record<string, X100>>;
}

function bodyOf(id: string, entity: { x100: number; radiusX100?: number; lane: 'top'|'middle'|'bottom' }): Body {
  return { id, x100: asX100(entity.x100), radiusX100: asX100(entity.radiusX100 ?? 0), lane: entity.lane };
}

function eventFor(type: 'AttackPrepared', entityId: string, payload: Record<string, number>): KernelEventInput {
  return Object.freeze({ type, sourceId: entityId, targetIds: Object.freeze([]), contentIds: Object.freeze([]), payload: Object.freeze(payload), logTags: Object.freeze(['sim.phase16']) });
}

/**
 * Stage-G attack preparation (§P16-T02/folgetests). The attack foundation: an
 * entity with a locked target and a configured preferred range is in range
 * when the inclusive edge distance reaches it. The transition into range is
 * edge-triggered — one `AttackPrepared` diagnostic per entry — and the state
 * is snapshot-authoritative (`inRangeSinceTick`). Damage/attack execution is
 * Phase 17; this stage only records the foundation.
 */
export function createAttackPrepSystem(config: AttackPrepConfig = {}): KernelSystem {
  const ranges: Readonly<Record<string, X100>> = config.preferredRangeX100 ?? Object.freeze({});
  return {
    id: 'phase16.g1.attack_prep',
    stage: 'G',
    run(context: TickContext): void {
      const tick = context.state.tick;
      for (const entity of context.state.entities) {
        if (entity.phase.phase !== 'ACTIVE') continue;
        const range = ranges[entity.id];
        if (range === undefined) continue;
        const targetId = entity.targetId;
        const wasInRange = entity.inRangeSinceTick !== undefined && entity.inRangeSinceTick !== null;
        if (targetId === null) {
          // A released/defeated target must not leave a stale in-range marker:
          // the attack foundation is only meaningful while a target is locked.
          if (wasInRange) context.commands.push({ kind: 'set_attack_state', entityId: entity.id, inRangeSinceTick: null });
          continue;
        }
        const target = context.state.entities.find((e) => e.id === targetId);
        if (target === undefined) continue;
        const distance = edgeDistanceX100(bodyOf(entity.id, entity), bodyOf(target.id, target));
        const inRange = distance <= nonNegativeX100(range);
        if (inRange && !wasInRange) {
          context.commands.push({ kind: 'set_attack_state', entityId: entity.id, inRangeSinceTick: tick });
          context.commands.push({ kind: 'append_event', event: eventFor('AttackPrepared', entity.id, { commitTick: tick }) });
        } else if (!inRange && wasInRange) {
          context.commands.push({ kind: 'set_attack_state', entityId: entity.id, inRangeSinceTick: null });
        }
      }
    },
  };
}
