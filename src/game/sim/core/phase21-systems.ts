import { KernelInvariantError } from './invariant-error.js';
import type { KernelSystem, TickContext } from './tick-context.js';
import type { KernelEventInput } from '../events/event-types.js';
import type { EventType } from '../events/event-spec.js';
import type { BossPhaseSnapshot, BossPhaseState, PhaseDefinition } from '../boss/boss-phase-system.js';
import { createBossPhaseSnapshot, detectTransition, phaseInvulnerableTicks, validateBossPhases } from '../boss/boss-phase-system.js';
import type { ModifierDefinition } from '../world/modifier-system.js';
import { createModifierCollection, validateEncounter } from '../world/modifier-system.js';
import type { Hazard } from '../world/hazard-system.js';
import { createHazardCollection } from '../world/hazard-system.js';
import type { Objective } from '../objectives/combat-objective.js';
import { applyEventRecordProgress, createObjectiveCollection, evaluateSurvival } from '../objectives/combat-objective.js';
import type { Wave } from '../world/reinforcement-system.js';
import { createSpawnedWaveCursor, dueWaves, validateWave } from '../world/reinforcement-system.js';

/**
 * Phase 21 §3 runtime wiring (T02/T04/T05). Deterministic systems:
 * - stage D: `modifier.d0.commit` commits the encounter modifiers once and the
 *   encounter validator rejects neutralized mechanics; `boss.d1.transition_detect`
 *   detects boss-phase transitions and plans them (idempotent).
 * - stage C: `hazard.c1.advance` walks the scheduled→telegraph→resolve→expire
 *   lifecycle and emits the telegraph/resolve events at their boundary ticks.
 * - stage K: `reinforcement.k1.spawn` commits due waves into the wave cursor
 *   (spawn bodies remain a content port, §9 steps 4–6 deferral).
 * - stage L: `boss.l1.transition_commit` commits exactly one transition at its
 *   inclusive commit tick; `objective.l1.resolution` derives objective progress
 *   from the canonical previous-tick event log. Both ids sort BEFORE
 *   `phase17.l1.battle_end` so objectives and the boss phase are committed
 *   before the generic end resolver decides (§3/§8).
 * No renderer, array index, locale or wallclock value influences ordering.
 */

export interface Phase21RuntimeConfig {
  readonly bossPhaseDefinitions?: readonly PhaseDefinition[];
  /** Encounter modifiers committed once at battle start (§7). */
  readonly modifiers?: readonly ModifierDefinition[];
  readonly bossCoreMechanicTags?: readonly string[];
  readonly bossAnnouncedCounterTags?: readonly string[];
  /** Reinforcement waves with stable ids and spawn order (§8). */
  readonly waves?: readonly Wave[];
  /** Mission objectives with required counts; progress starts at zero (§8). */
  readonly objectives?: readonly Objective[];
}

function eventInput(type: EventType, sourceId: string | null, targetIds: readonly string[], contentIds: readonly string[], payload: Readonly<Record<string, number>>): KernelEventInput {
  return Object.freeze({ type, sourceId, targetIds: Object.freeze([...targetIds]), contentIds: Object.freeze([...contentIds]), payload: Object.freeze({ ...payload }), logTags: Object.freeze(['sim.phase21']) });
}

/** Stage D: commit encounter modifiers exactly once, gated by the encounter validator. */
export function createModifierCommitSystem(config: Phase21RuntimeConfig = {}): KernelSystem {
  return Object.freeze({
    id: 'modifier.d0.commit',
    stage: 'D',
    run(context: TickContext): void {
      if (context.state.modifiers !== undefined) return; // already committed
      const defs = config.modifiers ?? [];
      if (defs.length === 0) return;
      const issues = validateEncounter(defs, {
        coreMechanicTags: Object.freeze([...(config.bossCoreMechanicTags ?? [])]),
        announcedCounterTags: Object.freeze([...(config.bossAnnouncedCounterTags ?? [])]),
      });
      if (issues.length > 0) throw new KernelInvariantError('P21_MODIFIER_INCOMPATIBLE', { detail: issues[0]?.detail });
      context.commands.push({ kind: 'set_modifiers', modifiers: createModifierCollection(defs) });
    },
  });
}

function bossStateOf(snapshot: BossPhaseSnapshot, context: TickContext): BossPhaseState {
  const boss = context.state.entities.find((e) => e.id === snapshot.entityId);
  if (boss === undefined) throw new KernelInvariantError('P21_PHASE_INVALID', { reason: 'boss-missing', entityId: snapshot.entityId });
  const hpPermille = Math.floor((boss.lp * 1000) / Math.max(1, boss.maxLp));
  return Object.freeze({
    entityId: snapshot.entityId,
    bossId: snapshot.bossId,
    hpPermille,
    phaseId: snapshot.phaseId,
    transition: snapshot.transition,
    visited: snapshot.visited,
  });
}

/** Stage D: detect a boss-phase transition (idempotent; once per source phase §5). */
export function createBossPhaseDetectSystem(config: Phase21RuntimeConfig = {}): KernelSystem {
  return Object.freeze({
    id: 'boss.d1.transition_detect',
    stage: 'D',
    run(context: TickContext): void {
      const snapshot = context.state.bossPhase;
      if (snapshot === undefined) return;
      const defs = config.bossPhaseDefinitions;
      if (defs === undefined) return;
      if (defs.length === 0) return;
      if (snapshot.transition !== null) return; // one planned transition per source phase (§5)
      const state = bossStateOf(snapshot, context);
      const detected = detectTransition(state, defs, context.state.tick);
      if (detected === null) return;
      context.commands.push({ kind: 'set_boss_phase', bossPhase: createBossPhaseSnapshot({ ...snapshot, transition: detected }) });
      context.commands.push({ kind: 'append_event', event: eventInput('PhaseTransitionPlanned', snapshot.entityId, [snapshot.entityId], [snapshot.bossId, detected.from, detected.to], { commitTick: detected.commitTick }) });
      context.commands.push({ kind: 'append_event', event: eventInput('BossTelegraphStarted', snapshot.entityId, [snapshot.entityId], [snapshot.bossId, detected.to], { resolveTick: detected.commitTick }) });
    },
  });
}

/** Stage C: advance hazard lifecycle and emit telegraph/resolve boundary events (§7). */
export function createHazardAdvanceSystem(): KernelSystem {
  return Object.freeze({
    id: 'hazard.c1.advance',
    stage: 'C',
    run(context: TickContext): void {
      const hazards = context.state.hazards;
      if (hazards === undefined) return;
      if (hazards.length === 0) return;
      const tick = context.state.tick;
      let changed = false;
      const next: Hazard[] = [];
      for (const hazard of hazards) {
        if (hazard.expired) { next.push(hazard); continue; }
        if (tick === hazard.scheduledTick) {
          context.commands.push({ kind: 'append_event', event: eventInput('HazardTelegraphed', null, [hazard.id], [hazard.id], { resolveTick: hazard.resolveTick }) });
        }
        if (tick === hazard.resolveTick) {
          context.commands.push({ kind: 'append_event', event: eventInput('HazardResolved', null, [hazard.id], [hazard.id], { effectCount: 0 }) });
        }
        if (tick > hazard.resolveTick) {
          next.push(Object.freeze({ ...hazard, expired: true }));
          changed = true;
        } else {
          next.push(hazard);
        }
      }
      if (changed) context.commands.push({ kind: 'set_hazards', hazards: createHazardCollection(next) });
    },
  });
}

/** Stage K: commit due reinforcement waves into the wave cursor (§8). */
export function createReinforcementSystem(config: Phase21RuntimeConfig = {}): KernelSystem {
  return Object.freeze({
    id: 'reinforcement.k1.spawn',
    stage: 'K',
    run(context: TickContext): void {
      const waves = config.waves;
      if (waves === undefined || waves.length === 0) return;
      for (const wave of waves) validateWave(wave);
      const spawned = new Set(context.state.spawnedWaves ?? []);
      const due = dueWaves(waves, context.state.tick, spawned);
      if (due.length === 0) return;
      for (const wave of due) {
        context.commands.push({ kind: 'append_event', event: eventInput('ReinforcementQueued', null, [wave.id], [wave.id, wave.spawnProfile], { spawnTick: wave.scheduledTick }) });
        context.commands.push({ kind: 'append_event', event: eventInput('ReinforcementSpawned', null, [wave.id], [wave.id], { count: wave.entityIds.length }) });
      }
      context.commands.push({ kind: 'set_spawned_waves', spawnedWaves: createSpawnedWaveCursor([...(context.state.spawnedWaves ?? []), ...due.map((w) => w.id)]) });
    },
  });
}

/** Stage L: commit the planned boss-phase transition at its inclusive commit tick (§5). */
export function createBossPhaseCommitSystem(config: Phase21RuntimeConfig = {}): KernelSystem {
  return Object.freeze({
    id: 'boss.l1.transition_commit',
    stage: 'L',
    run(context: TickContext): void {
      const snapshot = context.state.bossPhase;
      if (snapshot === undefined) return;
      const defs = config.bossPhaseDefinitions;
      if (snapshot.transition === null) return;
      if (defs === undefined) return;
      const tr = snapshot.transition;
      if (context.state.tick < tr.commitTick) return;
      const invuln = phaseInvulnerableTicks(defs, tr.to);
      const committed = createBossPhaseSnapshot({
        ...snapshot,
        phaseId: tr.to,
        transition: null,
        visited: [...snapshot.visited, tr.to],
        invulnerableUntilTick: invuln > 0 ? context.state.tick + invuln : null,
      });
      context.commands.push({ kind: 'set_boss_phase', bossPhase: committed });
      context.commands.push({ kind: 'append_event', event: eventInput('BossPhaseCompleted', snapshot.entityId, [snapshot.entityId], [snapshot.bossId, tr.from], {}) });
      context.commands.push({ kind: 'append_event', event: eventInput('BossPhaseStarted', snapshot.entityId, [snapshot.entityId], [snapshot.bossId, committed.phaseId], {}) });
    },
  });
}

/** Stage L: derive objective progress from the canonical previous-tick event log (§8). */
export function createObjectiveResolutionSystem(config: Phase21RuntimeConfig = {}): KernelSystem {
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
      const next = seeded.map((o) => {
        const afterRecords = records.reduce((acc, record) => {
          // A boss defeat never counts toward kill_regulars.
          if (o.kind === 'kill_regulars' && bossEntityId !== null && record.targetIds.includes(bossEntityId)) return acc;
          return applyEventRecordProgress(acc, record);
        }, o);
        if (o.kind === 'survive_until') return evaluateSurvival(afterRecords, context.state.tick);
        if (o.kind === 'protect_object') {
          const alive = o.targetId !== null && aliveObjects.has(o.targetId);
          return alive ? Object.freeze({ ...afterRecords, progress: afterRecords.required, complete: true }) : afterRecords;
        }
        return afterRecords;
      });
      if (objectives === undefined || JSON.stringify(next) !== JSON.stringify(seeded)) {
        context.commands.push({ kind: 'set_objectives', objectives: createObjectiveCollection(next) });
      }
    },
  });
}

/** Phase 21 A–M composition (§3): modifier + boss detect (D), hazard (C), wave (K), boss commit + objective (L). */
export function createPhase21Systems(config: Phase21RuntimeConfig = {}): readonly KernelSystem[] {
  if (config.bossPhaseDefinitions !== undefined) {
    const defs = config.bossPhaseDefinitions;
    if (defs.length > 0) {
      const issues = validateBossPhases(defs);
      if (issues.length > 0) throw new KernelInvariantError('P21_PHASE_GAP', { detail: issues[0]?.detail });
    }
  }
  return Object.freeze([
    createModifierCommitSystem(config),
    createBossPhaseDetectSystem(config),
    createHazardAdvanceSystem(),
    createReinforcementSystem(config),
    createBossPhaseCommitSystem(config),
    createObjectiveResolutionSystem(config),
  ]);
}
