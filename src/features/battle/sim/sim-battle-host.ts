/**
 * Phase 21 §9 expedition battle wiring. The expedition flow does not yet own a
 * battle sim state machine, so `NodeScreen` previously fed the outbound panel
 * an empty boss/hook surface. This host closes that gap: it runs the REAL
 * kernel battle for the node's encounter (via `buildEncounterLaunchConfig` +
 * `createPhase17Systems`/`createPhase21Systems` + `stepBattle`) and exposes the
 * live outbound sense — boss phase (both slots), modifier hook log and the
 * canonical phase event stream — as the exact `LiveOutboundInput` the panel
 * consumes.
 *
 * The host is browser-safe (the sim kernel is pure TS, no node: imports) and
 * stateless: every `run()` replays the deterministic fixture seed, so two runs
 * are byte-identical. Encounter content comes from the CONTENT RUNTIME
 * registry (`encounter-registry.ts`) — the same data the content compiler
 * emits into content/generated/* — resolved payloadKey-first from the node, so
 * the panel renders real content, not a stand-in.
 */

import { buildEncounterLaunchConfig, type EncounterObjectiveSource } from '../../../game/sim/boss/encounter-adapter.js';
import { bountyForKinds } from '../../../game/expedition/nodes/handlers/combat.js';
import type { BossPhaseSnapshot, PhaseDefinition } from '../../../game/sim/boss/boss-phase-system.js';
import { buildBossObject, buildBossObjectBody } from '../../../game/sim/boss/boss-object-manager.js';
import { migrateEntity } from '../../../game/sim/core/migrate.js';
import { roundDivHalfAwayFromZero } from '../../../game/sim/math/rounding.js';
import { stepBattle } from '../../../game/sim/core/battle-kernel.js';
import { sequence, tick } from '../../../game/sim/core/primitives.js';
import { createPhase17Systems } from '../../../game/sim/core/phase17-systems.js';
import { createPhase21Systems } from '../../../game/sim/core/phase21-systems.js';
import { asX100 } from '../../../game/sim/geometry/x100.js';
import { parseRunSeed } from '../../../game/sim/random/run-seed.js';
import { RngStreamMap } from '../../../game/sim/random/rng-stream-map.js';
import { RollSlotRegistry } from '../../../game/sim/random/roll-slot-registry.js';
import { RandomSession } from '../../../game/sim/random/random-session.js';
import type { KernelSystem } from '../../../game/sim/core/tick-context.js';
import type { TickInput } from '../../../game/sim/core/tick-input.js';
import type { BattleModel } from '../../../game/sim/core/battle-model.js';
import type { HealStreamEntry, LiveOutboundInput } from '../outbound/phase21-outbound-presenter.js';
import type { Lane } from '../../../game/sim/geometry/x100.js';
import type { Wave } from '../../../game/sim/world/reinforcement-system.js';
import {
  CONTENT_ENCOUNTERS,
  CONTENT_MODIFIERS,
  encounterById,
  isBossEncounter,
  resolveEncounterForNode,
  unitById,
  type ContentEncounterEntry,
} from '../../../game/content/runtime/encounter-registry.js';

export type { ContentEncounterEntry as FixtureEncounterEntry } from '../../../game/content/runtime/encounter-registry.js';

/**
 * §9 terminal verdict of a live outbound sense. Maps the kernel battle phase
 * to the four UI-visible verdicts. `active` means the battle has not reached a
 * terminal phase yet; the ENGAGE lockout happens on the terminal verdict (see
 * `resolveBattle` in the expedition runner).
 */
export type BattleVerdict = 'active' | 'victory' | 'defeat' | 'abort';

export function battleResultOf(input: LiveOutboundInput): BattleVerdict {
  const phase = input.phase.phase;
  if (phase === 'VICTORY') return 'victory';
  if (phase === 'DEFEAT') return 'defeat';
  if (phase === 'DRAW_ABORT') return 'abort';
  return 'active';
}

const input: TickInput = Object.freeze({ paused: false, decisions: Object.freeze([]), contentVersion: 'content_fixture' });

/** Flattens the content entry into the adapter's `EncounterObjectiveSource` (mirrors the launcher's `sourceFor`). */
export function sourceForEncounter(entry: ContentEncounterEntry): EncounterObjectiveSource {
  return Object.freeze({
    encounterId: entry.id,
    objective: entry.objective,
    bossObjects: Object.freeze(entry.bossObjects ?? []),
    enemySlotCount: entry.enemySlots.length,
    bossUnitId: entry.bossUnitId ?? null,
    bossUnitIdSecondary: entry.bossUnitIdSecondary ?? null,
    survivalDurationSeconds: entry.survivalDurationSeconds ?? null,
    healSustainCount: entry.healSustainCount ?? null,
    softLimitSeconds: entry.softLimitSeconds ?? null,
    modifierIds: Object.freeze(entry.modifierIds ?? []),
    reinforcementWaves: Object.freeze(entry.reinforcementWaves ?? []),
    bossPhases: Object.freeze(entry.bossPhases ?? []),
    bossPhasesSecondary: Object.freeze(entry.bossPhasesSecondary ?? []),
  });
}

/**
 * Resolves an expedition battle node to a real content encounter via the
 * content runtime registry (payloadKey-first, then node-family classification).
 * Unknown node types and empty payload keys resolve to `null` (the caller keeps
 * its honest stand-in feed).
 */
export function resolveExpeditionEncounter(nodeType: string, payloadKey: string): Readonly<ContentEncounterEntry> | null {
  return resolveEncounterForNode(nodeType, payloadKey);
}

function mkEntity(id: string, side: 'player' | 'enemy', lane: Lane, x100v: number, maxLp = 1000, lp: number = maxLp): ReturnType<typeof migrateEntity> {
  return migrateEntity({
    entity: Object.freeze({
      id,
      side,
      phase: Object.freeze({ phase: 'ACTIVE', enteredTick: tick(0), controlledReturn: null }),
      maxLp,
      lp,
      shield: 0,
      lane,
      x100: x100v,
      targetId: null,
      timers: Object.freeze({}),
    }),
    radiusX100: 100,
  });
}

/** §8 content spawnBodies resolver (mirrors the launcher): wave bodies come from the referenced encounter's slots + unit stats. */
function spawnBodiesFor(wave: Wave): readonly { entityId: string; lane: Lane; x100: number; radiusX100: number; maxLp: number }[] {
  const template = encounterById(wave.spawnProfile);
  if (template === null) throw new Error(`wave spawnProfile ${wave.spawnProfile} has no encounter`);
  return Object.freeze(template.enemySlots.map((slot, index) => {
    const unit = unitById(slot.unitId);
    if (unit === null) throw new Error(`wave unit ${slot.unitId} has no unit content`);
    const entityId = wave.entityIds[index];
    if (entityId === undefined) throw new Error(`wave ${wave.spawnProfile} missing body id at ${String(index)}`);
    return Object.freeze({
      entityId,
      lane: slot.lane,
      x100: 6200 + index * 400,
      radiusX100: unit.collisionRadiusX100,
      maxLp: Math.max(1, roundDivHalfAwayFromZero(unit.baseStats.maxHp, 1000)),
    });
  }));
}

function bossPhaseSnapshotsFor(defs: readonly PhaseDefinition[]): readonly { entityId: string; bossId: string; phaseId: string; transition: null; visited: readonly string[]; invulnerableUntilTick: null }[] {
  const byBoss = new Map<string, PhaseDefinition[]>();
  for (const def of defs) {
    const list = byBoss.get(def.bossId) ?? [];
    byBoss.set(def.bossId, [...list, def]);
  }
  const out: { entityId: string; bossId: string; phaseId: string; transition: null; visited: readonly string[]; invulnerableUntilTick: null }[] = [];
  for (const [bossId, group] of byBoss) {
    const entry = group.find((p) => p.maxHpPermille === 1001) ?? group[0];
    if (entry === undefined) continue;
    out.push(Object.freeze({
      entityId: bossId,
      bossId,
      phaseId: entry.id,
      transition: null,
      visited: Object.freeze([entry.id]),
      invulnerableUntilTick: null,
    }));
  }
  return out;
}

function buildBattle(entry: ContentEncounterEntry, launch: ReturnType<typeof buildEncounterLaunchConfig>): BattleModel {
  // §8.3 heal_sustain: the generic battle starts the player at FULL HP, so the
  // lifesteal heals would clamp to 0 and the mission could never complete.
  // Seed the player with room to heal and the enemy as a durable TANK (no
  // enemy attack profile is wired below) — a self-healing enemy would sawtooth
  // at its lifesteal amount and never die, so the tank keeps the sustain loop
  // one-directional and the mission reaches a real VICTORY elimination. Both
  // runs stay deterministic (the fixture seed defines every HP).
  const sustain = entry.objective === 'heal_sustain';
  const player = mkEntity('unit_p', 'player', 'middle', 1800, sustain ? 5000 : 1000, sustain ? 2500 : 1000);
  const enemies = entry.enemySlots.map((slot, index) =>
    mkEntity(slot.unitId, 'enemy', slot.lane, 6200 + index * 400, sustain ? 10000 : 1000));
  const entities = [player, ...enemies];
  const temps: ReturnType<typeof buildBossObject>[] = [];
  if (launch.bossObjects.length > 0) {
    const placed = launch.bossObjects.map((b, i) => buildBossObject(b.spec, b.entityId, b.side, b.ownerId, b.sourceId, 0, i));
    temps.push(...placed);
    entities.push(...launch.bossObjects.map((b) => buildBossObjectBody(b, tick(0))));
  }
  const bossId = entry.bossUnitId ?? null;
  if (bossId !== null && !entities.some((e) => e.id === bossId)) entities.push(mkEntity(bossId, 'enemy', 'middle', 7000, 3000));
  const bossIdSecondary = entry.bossUnitIdSecondary ?? null;
  if (bossIdSecondary !== null && !entities.some((e) => e.id === bossIdSecondary)) entities.push(mkEntity(bossIdSecondary, 'enemy', 'bottom', 7000, 3000));
  const snapshots = bossPhaseSnapshotsFor(launch.bossPhaseDefinitions);
  const phases: { bossPhase?: BossPhaseSnapshot; bossPhaseSecondary?: BossPhaseSnapshot } = {};
  if (snapshots[0] !== undefined) phases.bossPhase = snapshots[0];
  if (snapshots[1] !== undefined) phases.bossPhaseSecondary = snapshots[1];
  const placeholder = new RandomSession(RngStreamMap.fromRunSeed(parseRunSeed(['00000001', '00000002', '00000003', '00000004'])), new RollSlotRegistry([]), false);
  return Object.freeze({
    schemaVersion: 1,
    simulationVersion: 'phase21-expedition-wiring-v1',
    battleId: 'battle_expedition',
    tick: tick(0),
    nextSequence: sequence(0),
    emittedEventCount: 0,
    phase: Object.freeze({ phase: 'ACTIVE', enteredTick: tick(0), resolvingEndTicks: 0 }),
    entities: Object.freeze(entities),
    temporaryEntities: Object.freeze(temps),
    abilities: Object.freeze([]),
    scheduledEvents: Object.freeze([]),
    authoritativeStreams: placeholder.streams.snapshotAuthoritative(),
    endReason: null,
    ...phases,
  });
}

function systemsFor(entry: ContentEncounterEntry, launch: ReturnType<typeof buildEncounterLaunchConfig>): readonly KernelSystem[] {
  return Object.freeze([
    ...createPhase17Systems({
      speedsX100PerSecond: {},
      bossObjectPolicies: launch.bossObjectPolicies,
      // §10 soft-limit precedence: a boss-family encounter gets the 3600 boss
      // default when no override is declared, but the encounter's content
      // `softLimitSeconds` ALWAYS wins (never overridden by the boss default).
      battleEnd: {
        ...(isBossEncounter(entry) ? { bossBattle: true } : {}),
        ...(launch.softLimitTicks === null ? {} : { softLimitTicksOverride: launch.softLimitTicks }),
      },
      basicAttack: {
        parameters: {
          unit_p: {
            attackIntervalTicks: 10,
            prepareTicks: 1,
            recoveryTicks: 3,
            preferredRangeX100: asX100(9000),
            delivery: { kind: 'direct', rawAmount: 250, damageTypeOrdinal: 0, defense: 0, bossCapBps: null },
          },
        },
      },
    }),
    ...createPhase21Systems({
      bossObjects: launch.bossObjects,
      objectives: launch.objectives,
      modifiers: launch.modifiers,
      waves: launch.waves,
      spawnBodies: spawnBodiesFor,
      bossPhaseDefinitions: launch.bossPhaseDefinitions,
    }),
  ]);
}

function liveFrom(state: BattleModel, events: readonly { type: string; tick: number; contentIds: readonly string[]; resolveTick?: number }[], entry: ContentEncounterEntry, healStream: readonly HealStreamEntry[]): LiveOutboundInput {
  return Object.freeze({
    encounterId: entry.id,
    objective: entry.objective,
    tick: state.tick,
    phase: Object.freeze({ phase: state.phase.phase, endReason: state.endReason }),
    bossPhase: state.bossPhase === undefined
      ? null
      : Object.freeze({ phaseId: state.bossPhase.phaseId, visited: Object.freeze([...state.bossPhase.visited]), transition: state.bossPhase.transition !== null }),
    bossPhaseSecondary: state.bossPhaseSecondary === undefined
      ? null
      : Object.freeze({ phaseId: state.bossPhaseSecondary.phaseId, visited: Object.freeze([...state.bossPhaseSecondary.visited]), transition: state.bossPhaseSecondary.transition !== null }),
    modifierHookLog: Object.freeze((state.modifierHookLog ?? []).map((f) => Object.freeze({ modifierId: f.modifierId, hook: f.hook, atTick: f.atTick }))),
    events: Object.freeze(events.map((e) => Object.freeze({
      type: e.type,
      tick: e.tick,
      contentIds: Object.freeze([...e.contentIds]),
      ...(e.resolveTick === undefined ? {} : { resolveTick: e.resolveTick }),
    }))),
    // §10 rift-collapse surface: the window start and the §9.4 no-progress
    // endcap counters, so the panel can render the collapse warning / healing-
    // halved readout live (the window key stays absent until the soft limit).
    ...(state.timeCollapseSinceTick === undefined ? {} : { timeCollapseSinceTick: state.timeCollapseSinceTick }),
    noProgressTicks: state.globalNoProgressTicks ?? 0,
    riftCollapseTicks: state.riftCollapseTicks ?? 0,
    riftCollapseWarningEmitted: state.riftCollapseWarningEmitted ?? false,
    // §8 mission-objective progress, so the live panel path streams a
    // heal_sustain / survive / waves mission to completion tick by tick.
    ...(state.objectives === undefined ? {} : {
      objectives: Object.freeze(state.objectives.map((o) => Object.freeze({
        id: o.id,
        kind: o.kind,
        progress: o.progress,
        required: o.required,
        complete: o.complete,
      }))),
    }),
    // §7 heal stream: applied heals (HealApplied deltas) + §6 suppressed
    // lifesteal heals (LifestealBlocked), so the panel renders blocked-vs-
    // applied heals live with {healDelta, target} params.
    healStream: Object.freeze(healStream.map((h) => Object.freeze({ ...h }))),
    // §9.5 objective bounty: the gold the victory ENGAGE pays (per-kind sum
    // over the completed objective kinds) — the contract amount, shown on the
    // battle result so the reward is never a surprise.
    bounty: bountyForKinds((state.objectives ?? []).filter((o) => o.complete).map((o) => o.kind)),
  });
}

export interface SimBattleHostConfig {
  readonly encounter: Readonly<ContentEncounterEntry>;
  /** Tick cap (default 1500 — every fixture mission resolves within it). */
  readonly maxTicks?: number;
}

export interface SimBattleHost {
  readonly encounterId: string;
  readonly objective: string;
  /** Runs the kernel battle to its terminal (or the tick cap) and returns the live outbound input. */
  run(): LiveOutboundInput;
}

/**
 * Live battle handle: owns ONE kernel battle and steps it one tick at a time,
 * so the battle screen can run/pause/step a real fight and the outbound sense
 * (boss phase, telegraph countdowns, hook log) streams tick by tick instead of
 * a single replay on mount. `step()` past the terminal is a no-op (same
 * snapshot), matching `stepBattle`'s terminal guard.
 */
export interface LiveSimBattleHandle {
  readonly encounterId: string;
  readonly objective: string;
  /** Current outbound sense without advancing the battle. */
  snapshot(): LiveOutboundInput;
  /** Advances the battle exactly one tick and returns the new outbound sense. */
  step(): LiveOutboundInput;
}

interface BattleRunner {
  readonly snapshot: () => LiveOutboundInput;
  readonly step: () => LiveOutboundInput;
}

function launchFor(entry: ContentEncounterEntry): { readonly launch: ReturnType<typeof buildEncounterLaunchConfig>; readonly systems: readonly KernelSystem[] } {
  const source = sourceForEncounter(entry);
  const deps = Object.freeze({
    modifiers: CONTENT_MODIFIERS,
    encounters: new Map([...CONTENT_ENCOUNTERS.entries()].map(([id, e]) => [id, { enemySlots: e.enemySlots }] as const)),
  });
  const launch = buildEncounterLaunchConfig(source, deps);
  return Object.freeze({ launch, systems: systemsFor(entry, launch) });
}

/** Deterministic per-tick runner shared by the monolithic run and the live handle. */
function createBattleRunner(entry: ContentEncounterEntry, launch: ReturnType<typeof buildEncounterLaunchConfig>, systems: readonly KernelSystem[]): BattleRunner {
  const random = new RandomSession(RngStreamMap.fromRunSeed(parseRunSeed(['00000001', '00000002', '00000003', '00000004'])), new RollSlotRegistry([]), false);
  let state: BattleModel = { ...buildBattle(entry, launch), authoritativeStreams: random.streams.snapshotAuthoritative() };
  const events: { type: string; tick: number; contentIds: readonly string[]; resolveTick?: number }[] = [];
  const healStream: HealStreamEntry[] = [];
  let terminal = false;
  let cached: LiveOutboundInput | null = null;
  const live = (): LiveOutboundInput => {
    if (cached === null) cached = liveFrom(state, events, entry, healStream);
    return cached;
  };
  return Object.freeze({
    snapshot: (): LiveOutboundInput => live(),
    step: (): LiveOutboundInput => {
      if (terminal) return live();
      const r = stepBattle({ state, input, random, rules: {}, content: {}, systems });
      state = r.state;
      for (const e of r.events) {
        events.push(Object.freeze({
          type: e.type,
          tick: state.tick,
          contentIds: Object.freeze([...e.contentIds]),
          ...(e.payload['resolveTick'] === undefined ? {} : { resolveTick: e.payload['resolveTick'] }),
        }));
        if (e.type === 'HealApplied') {
          healStream.push(Object.freeze({
            tick: state.tick,
            targetId: e.targetIds[0] ?? e.sourceId ?? '',
            delta: e.payload['finalHpDelta'] ?? 0,
            blocked: false,
          }));
        } else if (e.type === 'LifestealBlocked') {
          healStream.push(Object.freeze({
            tick: state.tick,
            targetId: e.targetIds[0] ?? '',
            delta: e.payload['targetAmount'] ?? 0,
            blocked: true,
          }));
        }
      }
      if (['VICTORY', 'DEFEAT', 'DRAW_ABORT'].includes(state.phase.phase)) terminal = true;
      cached = null;
      return live();
    },
  });
}

/** Runs the real kernel battle for one content encounter and exposes the outbound sense. */
export function createSimBattleHost(config: SimBattleHostConfig): SimBattleHost {
  const entry = config.encounter;
  const { launch, systems } = launchFor(entry);
  const runner = createBattleRunner(entry, launch, systems);
  const maxTicks = config.maxTicks ?? 1500;
  return Object.freeze({
    encounterId: entry.id,
    objective: entry.objective,
    run(): LiveOutboundInput {
      let out = runner.snapshot();
      for (let t = 0; t < maxTicks && !['VICTORY', 'DEFEAT', 'DRAW_ABORT'].includes(out.phase.phase); t++) {
        out = runner.step();
      }
      return out;
    },
  });
}

/** Live variant: the caller owns the battle and steps it tick by tick (run/pause/step). */
export function createLiveSimBattle(config: SimBattleHostConfig): LiveSimBattleHandle {
  const entry = config.encounter;
  const { launch, systems } = launchFor(entry);
  const runner = createBattleRunner(entry, launch, systems);
  return Object.freeze({
    encounterId: entry.id,
    objective: entry.objective,
    snapshot: runner.snapshot,
    step: runner.step,
  });
}
