import { KernelInvariantError } from './invariant-error.js';
import type { KernelSystem, TickContext } from './tick-context.js';
import type { KernelEventInput } from '../events/event-types.js';
import type { EventType } from '../events/event-spec.js';
import type { BossPhaseSnapshot, BossPhaseState, PhaseDefinition } from '../boss/boss-phase-system.js';
import { createBossPhaseSnapshot, detectTransition, phaseInvulnerableTicks, validateBossPhases } from '../boss/boss-phase-system.js';
import type { ModifierDefinition } from '../world/modifier-system.js';
import { applyHookBps, createModifierCollection, hookBpsScale, validateEncounter } from '../world/modifier-system.js';
import { createModifierDamageScaleSystem, createModifierHookSystem } from '../world/modifier-runtime.js';
import type { Hazard } from '../world/hazard-system.js';
import { createHazardCollection } from '../world/hazard-system.js';
import type { Objective } from '../objectives/combat-objective.js';
import { createObjectiveResolutionSystem } from '../objectives/objective-resolution-system.js';
import type { Wave, ReinforcementBody } from '../world/reinforcement-system.js';
import { buildReinforcementEntity, createSpawnedWaveCursor, dueWaves, validateReinforcementBody, validateWave } from '../world/reinforcement-system.js';
import type { BossObjectContent } from '../boss/boss-object-manager.js';
import { createBossObjectCleanupSystem, createBossObjectPlacementSystem } from '../boss/boss-object-manager.js';

/**
 * Phase 21 §3 runtime wiring (T02/T04/T05). Deterministic systems:
 * - stage D: `modifier.d0.commit` commits the encounter modifiers once and the
 *   encounter validator rejects neutralized mechanics; `modifier.h0.hook_eval`
 *   fires the committed hooks (`on_battle_start` at battle start, the rest from
 *   the canonical previous-tick event log) and records them in state;
 *   `boss.d1.transition_detect` detects boss-phase transitions and plans them
 *   (idempotent).
 * - stage H: `modifier.z9.damage_scale` rewrites the queued damage applications
 *   by the committed `on_damage_applied` hooks' composite `damage_bps` — it
 *   sorts after the projectile/ability dispatchers so every queued hit is
 *   scaled before the stage-I pipeline consumes it (§7).
 * - stage C: `hazard.c1.advance` walks the scheduled→telegraph→resolve→expire
 *   lifecycle and emits the telegraph/resolve events at their boundary ticks.
 * - stage K: `reinforcement.k1.spawn` commits due waves into the wave cursor
 *   and — when content wires a `spawnBodies` resolver — spawns the wave's
 *   combat bodies in its fixed order (content-port completion, §8);
 *   `boss.object.k1.place` commits content-defined boss objects into the
 *   temporary registry once at battle start (§6).
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
  /**
   * Content: resolves a wave's spawn profile to real combat bodies (stats +
   * placement). When present, due waves spawn actual entities in the wave's
   * fixed order and count as §9.4 qualifying progress; when absent, waves only
   * advance the cursor and emit queue/spawn events (content-port deferral).
   */
  readonly spawnBodies?: (wave: Wave) => readonly ReinforcementBody[];
  /** Content: encounter boss objects placed into the temporary registry at battle start (§6). */
  readonly bossObjects?: readonly BossObjectContent[];
  /** Mission objectives with required counts; progress starts at zero (§8). */
  readonly objectives?: readonly Objective[];
}

export type { ReinforcementBody } from '../world/reinforcement-system.js';

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

/**
 * Stage K: commit due reinforcement waves into the wave cursor (§8). When the
 * content `spawnBodies` resolver is wired, each due wave additionally spawns
 * real entities in its fixed order and counts as §9.4 qualifying progress
 * (like the Phase-15 spawn system); without it, waves only emit events and
 * advance the cursor (documented content-port deferral).
 */
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
      const existingIds = new Set(context.state.entities.map((e) => e.id));
      let spawnedAny = false;
      for (const wave of due) {
        context.commands.push({ kind: 'append_event', event: eventInput('ReinforcementQueued', null, [wave.id], [wave.id, wave.spawnProfile], { spawnTick: wave.scheduledTick }) });
        context.commands.push({ kind: 'append_event', event: eventInput('ReinforcementSpawned', null, [wave.id], [wave.id], { count: wave.entityIds.length }) });
        const bodies = config.spawnBodies ? config.spawnBodies(wave) : null;
        if (bodies === null) continue;
        // §7 on_spawn effect: the committed hooks' composite max_hp_bps scales
        // the wave bodies' max LP (identity when no on_spawn modifier is active).
        const spawnScale = hookBpsScale(context.state.modifiers ?? Object.freeze([]), 'on_spawn', 'max_hp_bps');
        const scaledBodies = spawnScale === 10000 ? bodies : bodies.map((body) => Object.freeze({ ...body, maxLp: Math.max(1, applyHookBps(body.maxLp, spawnScale)) }));
        const bodyById = new Map<string, ReinforcementBody>();
        for (const body of scaledBodies) {
          validateReinforcementBody(body, wave.id);
          if (bodyById.has(body.entityId)) throw new KernelInvariantError('P21_WAVE_INVALID', { waveId: wave.id, reason: 'duplicate-body', entityId: body.entityId });
          bodyById.set(body.entityId, body);
        }
        if (bodyById.size !== wave.entityIds.length || !wave.entityIds.every((id) => bodyById.has(id))) {
          throw new KernelInvariantError('P21_WAVE_INVALID', { waveId: wave.id, reason: 'body-coverage-mismatch', entityIds: wave.entityIds.length, bodies: bodyById.size });
        }
        // Fixed spawn order (§8): commit bodies in exactly the wave's order.
        for (const entityId of wave.entityIds) {
          const body = bodyById.get(entityId);
          if (body === undefined) throw new KernelInvariantError('P21_WAVE_INVALID', { waveId: wave.id, reason: 'missing-body', entityId });
          if (existingIds.has(body.entityId)) throw new KernelInvariantError('P14_DUPLICATE_ENTITY', { id: body.entityId });
          existingIds.add(body.entityId);
          context.commands.push({ kind: 'spawn_entity', entity: buildReinforcementEntity(body, wave.side, context.state.tick) });
          spawnedAny = true;
        }
      }
      // §9.4: a committed wave that actually spawns bodies is qualifying
      // progress and resets both global counters (mirrors the Phase-15 spawn).
      if (spawnedAny) {
        context.commands.push({ kind: 'set_global_progress', noProgressTicks: 0, collapseTicks: 0, warned: false });
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
    createModifierHookSystem(config),
    createModifierDamageScaleSystem(config),
    createBossPhaseDetectSystem(config),
    createHazardAdvanceSystem(),
    createReinforcementSystem(config),
    createBossObjectPlacementSystem(config.bossObjects === undefined ? {} : { bossObjects: config.bossObjects }),
    createBossObjectCleanupSystem(config.bossObjects === undefined ? {} : { bossObjects: config.bossObjects }),
    createBossPhaseCommitSystem(config),
    createObjectiveResolutionSystem(config),
  ]);
}
