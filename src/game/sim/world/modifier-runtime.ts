import type { KernelSystem, TickContext } from '../core/tick-context.js';
import type { KernelEventInput } from '../events/event-types.js';
import type { EventType } from '../events/event-spec.js';
import type { ModifierDefinition } from './modifier-system.js';
import { applyHookBps, battleStartHooks, createModifierHookCollection, evaluateModifierHooks, hookBpsScale, type ModifierHookFiring } from './modifier-system.js';

/**
 * Phase 21 §7 modifier-hook runtime (T04). The authority defines hooks but the
 * execution surface lives here:
 * - stage D `modifier.h0.hook_eval` fires the committed hooks — `on_battle_start`
 *   at the tick the modifier set is committed, the rest from the canonical
 *   previous-tick event log (one firing per modifier/hook per tick, mirroring
 *   the objective resolver's record folding) — records each firing in
 *   `state.modifierHookLog` with the §7-announced params and emits a
 *   deterministic `ModifierTriggered` event carrying the firing's 1-based
 *   ordinal in the log;
 * - stage H `modifier.z9.damage_scale` translates `on_damage_applied` into a
 *   real effect: it rewrites the queued damage applications by the committed
 *   hooks' composite `damage_bps`. Its id sorts after `phase17.h1.projectile`
 *   and `phase19.h2.ability_effects`, so direct, projectile and ability damage
 *   queued this tick are all scaled before the stage-I pipeline consumes them.
 */

function eventInput(type: EventType, sourceId: string | null, targetIds: readonly string[], contentIds: readonly string[], payload: Readonly<Record<string, number>>): KernelEventInput {
  return Object.freeze({ type, sourceId, targetIds: Object.freeze([...targetIds]), contentIds: Object.freeze([...contentIds]), payload: Object.freeze({ ...payload }), logTags: Object.freeze(['sim.phase21']) });
}

export interface ModifierHookRuntimeConfig {
  /** The modifier set being committed this tick (only read while `state.modifiers` is undefined). */
  readonly modifiers?: readonly ModifierDefinition[];
}

/** Stage D: §7 modifier-hook runtime — fires and records every committed hook. */
export function createModifierHookSystem(config: ModifierHookRuntimeConfig = {}): KernelSystem {
  return Object.freeze({
    id: 'modifier.h0.hook_eval',
    stage: 'D',
    run(context: TickContext): void {
      const existing = context.state.modifierHookLog ?? Object.freeze([]);
      const defs = context.state.modifiers ?? config.modifiers;
      if (defs === undefined || defs.length === 0) return;
      const next: ModifierHookFiring[] = [...existing];
      const seen = new Set(existing.map((f) => `${f.modifierId}:${f.hook}:${String(f.atTick)}`));
      // §7 on_battle_start fires the tick the modifier set is committed (battle
      // start) — the commit system's stage-D guard is `state.modifiers === undefined`.
      if (context.state.modifiers === undefined) {
        for (const firing of battleStartHooks(config.modifiers ?? Object.freeze([]), context.state.tick)) {
          const key = `${firing.modifierId}:${firing.hook}:${String(firing.atTick)}`;
          if (seen.has(key)) continue;
          seen.add(key);
          next.push(firing);
        }
      }
      const records = context.state.previousTickEvents ?? Object.freeze([]);
      for (const firing of evaluateModifierHooks(defs, records, context.state.tick)) {
        const key = `${firing.modifierId}:${firing.hook}:${String(firing.atTick)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        next.push(firing);
      }
      if (next.length === existing.length) return;
      const log = createModifierHookCollection(next);
      for (const firing of next.slice(existing.length)) {
        const ordinal = log.findIndex((f) => f.modifierId === firing.modifierId && f.hook === firing.hook && f.atTick === firing.atTick);
        context.commands.push({ kind: 'append_event', event: eventInput('ModifierTriggered', null, Object.freeze([firing.modifierId]), Object.freeze([firing.modifierId, firing.hook]), { triggerOrdinal: ordinal + 1 }) });
      }
      context.commands.push({ kind: 'set_modifiers', modifiers: defs, hookLog: log });
    },
  });
}

/** Stage H: §7 `on_damage_applied` effect — scales every queued damage application. */
export function createModifierDamageScaleSystem(config: ModifierHookRuntimeConfig = {}): KernelSystem {
  return Object.freeze({
    id: 'phase19.z9.modifier_damage_scale',
    stage: 'H',
    run(context: TickContext): void {
      const defs: readonly ModifierDefinition[] | undefined = context.state.modifiers ?? config.modifiers;
      if (defs === undefined || defs.length === 0) return;
      const scale = hookBpsScale(defs, 'on_damage_applied', 'damage_bps');
      if (scale === 10000) return;
      const pending = context.state.pendingCombatApplications;
      if (pending === undefined || pending.length === 0) return;
      let changed = false;
      const next = pending.map((application) => {
        if (application.kind !== 'damage' || application.rawAmount === 0) return application;
        const scaled = applyHookBps(application.rawAmount, scale);
        if (scaled === application.rawAmount) return application;
        changed = true;
        return Object.freeze({ ...application, rawAmount: scaled });
      });
      if (changed) context.commands.push({ kind: 'set_combat_applications', applications: Object.freeze(next) });
    },
  });
}
