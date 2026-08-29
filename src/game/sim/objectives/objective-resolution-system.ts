import { isTerminalBattlePhase } from '../core/battle-state.js';
import type { KernelSystem, TickContext } from '../core/tick-context.js';
import type { Objective } from './combat-objective.js';
import { applyEventRecordProgress, createObjectiveCollection, evaluateSurvival, objectiveAllowsBattleEnd } from './combat-objective.js';

/**
 * Phase 21 §8 objective resolution (T05). Runs in stage L and derives every
 * objective's progress from the canonical previous-tick event log — never from
 * UI state. protect_object completes only while the object's body is ACTIVE and
 * its registry entry alive; a destroyed body forces DEFEAT through
 * RESOLVING_END (priority 150 over the battle-end resolver's 140/120). Its id
 * sorts BEFORE `phase17.l1.battle_end`, so objectives are committed before the
 * generic end resolver decides (§3/§8).
 */
export function createObjectiveResolutionSystem(config: { readonly objectives?: readonly Objective[] } = {}): KernelSystem {
  return Object.freeze({
    id: 'objective.l1.resolution',
    stage: 'L',
    run(context: TickContext): void {
      const initial = config.objectives;
      if (initial === undefined) return; // not an objective mission
      const bossEntityId = context.state.bossPhase?.entityId ?? null;
      const objectives = context.state.objectives;
      const seeded = objectives ?? createObjectiveCollection(initial.map((o) => Object.freeze({ ...o, progress: 0, complete: false })));
      const records = context.state.previousTickEvents ?? Object.freeze([]);
      const aliveObjects = new Set((context.state.temporaryEntities ?? []).map((t) => t.id));
      // Boss objects are never regular units (§P21-T03): a defeated boss object
      // must not count toward kill_regulars. Both the registry entry (kind
      // BOSS_OBJECT) and any still-present combat body (origin boss_object) mark
      // the id, so the exclusion survives the body being cleaned up.
      const bossObjectIds = new Set<string>();
      for (const temp of context.state.temporaryEntities ?? []) {
        if (temp.kind === 'BOSS_OBJECT') bossObjectIds.add(temp.id);
      }
      for (const entity of context.state.entities) {
        if (entity.origin === 'boss_object') bossObjectIds.add(entity.id);
      }
      const next = seeded.map((o) => {
        const afterRecords = records.reduce((acc, record) => {
          // A boss defeat never counts toward kill_regulars.
          if (o.kind === 'kill_regulars' && bossEntityId !== null && record.targetIds.includes(bossEntityId)) return acc;
          // A defeated boss object never counts either — it is not a regular unit.
          if (o.kind === 'kill_regulars' && record.type === 'Defeated' && record.targetIds.some((id) => bossObjectIds.has(id))) return acc;
          return applyEventRecordProgress(acc, record);
        }, o);
        if (o.kind === 'survive_until') return evaluateSurvival(afterRecords, context.state.tick);
        if (o.kind === 'protect_object') {
          // §8 protect_object teeth: completes only while the object's body is
          // ACTIVE and its registry entry alive; a destroyed body forces DEFEAT
          // through RESOLVING_END (priority 150 over the resolver's 140/120).
          const bodyAlive = o.targetId !== null && context.state.entities.some((e) => e.id === o.targetId && e.phase.phase === 'ACTIVE');
          const alive = o.targetId !== null && aliveObjects.has(o.targetId) && bodyAlive;
          if (!alive && !o.complete && !isTerminalBattlePhase(context.state.phase.phase)) {
            context.commands.push({ kind: 'force_battle_outcome', outcome: 'DEFEAT', reason: 'protect_object_failed' });
            if (context.state.phase.phase === 'ACTIVE' || context.state.phase.phase === 'PHASE_TRANSITION') {
              context.commands.push({ kind: 'battle_transition', to: 'RESOLVING_END', priority: 150, reason: 'protect_object_failed' });
            }
          }
          return alive ? Object.freeze({ ...afterRecords, progress: afterRecords.required, complete: true }) : afterRecords;
        }
        return afterRecords;
      });
      // §8 survive teeth: once the survival window elapses and every objective
      // is complete, the battle must end VICTORY — the survival mandate wins
      // over the generic end resolver (mirror of protect_object's forced DEFEAT,
      // priority 150; the forcedOutcome outranks the endcap and the resolver at
      // RESOLVING_END finalize).
      const surviveDone = next.some((o) => o.kind === 'survive_until' && o.complete);
      if (surviveDone && objectiveAllowsBattleEnd(next) && !isTerminalBattlePhase(context.state.phase.phase)) {
        context.commands.push({ kind: 'force_battle_outcome', outcome: 'VICTORY', reason: 'survive_complete' });
        if (context.state.phase.phase === 'ACTIVE' || context.state.phase.phase === 'PHASE_TRANSITION') {
          context.commands.push({ kind: 'battle_transition', to: 'RESOLVING_END', priority: 150, reason: 'survive_complete' });
        }
      }
      if (objectives === undefined || JSON.stringify(next) !== JSON.stringify(seeded)) {
        context.commands.push({ kind: 'set_objectives', objectives: createObjectiveCollection(next) });
      }
    },
  });
}
