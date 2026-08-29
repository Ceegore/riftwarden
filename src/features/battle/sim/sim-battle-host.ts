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
 * are byte-identical. Encounter content is the REAL fixture source
 * (content/source/world/*.json) imported directly — the same files the content
 * launcher reads — so the panel renders content, not a stand-in.
 */

import { buildEncounterLaunchConfig, type ContentBossObjectEntry, type ContentModifierSource, type EncounterObjectiveKind, type EncounterObjectiveSource, type EncounterWaveSource } from '../../../game/sim/boss/encounter-adapter.js';
import type { ContentBossPhaseSource } from '../../../game/sim/boss/boss-phase-content-adapter.js';
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
import type { LiveOutboundInput } from '../outbound/phase21-outbound-presenter.js';
import type { Lane } from '../../../game/sim/geometry/x100.js';
import type { Wave } from '../../../game/sim/world/reinforcement-system.js';

import encountersData from '../../../../content/source/world/encounters.json';
import modifiersData from '../../../../content/source/world/modifiers.json';
import unitsData from '../../../../content/source/units/units.json';

/** The flattened fixture encounter entry (the shape `encounters.json` carries). */
export interface FixtureEnemySlot {
  readonly unitId: string;
  readonly lane: Lane;
}
export interface FixtureEncounterEntry {
  readonly id: string;
  readonly objective: EncounterObjectiveKind;
  readonly enemySlots: readonly FixtureEnemySlot[];
  readonly modifierIds?: readonly string[];
  readonly reinforcementWaves?: readonly EncounterWaveSource[];
  readonly bossUnitId?: string | null;
  readonly bossUnitIdSecondary?: string | null;
  readonly survivalDurationSeconds?: number | null;
  readonly healSustainCount?: number | null;
  readonly bossPhases?: readonly ContentBossPhaseSource[];
  readonly bossPhasesSecondary?: readonly ContentBossPhaseSource[];
  readonly bossObjects?: readonly ContentBossObjectEntry[];
}
interface FixtureModifierEntry extends ContentModifierSource {
  readonly id: string;
}
interface FixtureUnitEntry {
  readonly id: string;
  readonly baseStats: { readonly maxHp: number };
  readonly collisionRadiusX100: number;
}

type EncounterEnvelope = { readonly entities: readonly FixtureEncounterEntry[] };
type ModifierEnvelope = { readonly entities: readonly FixtureModifierEntry[] };
type UnitEnvelope = { readonly entities: readonly FixtureUnitEntry[] };

const FIXTURE_ENCOUNTERS: ReadonlyMap<string, FixtureEncounterEntry> = new Map(
  (encountersData as unknown as EncounterEnvelope).entities.map((e) => [e.id, Object.freeze(e)] as const),
);
const FIXTURE_MODIFIERS: ReadonlyMap<string, ContentModifierSource> = new Map(
  (modifiersData as unknown as ModifierEnvelope).entities.map((e) => [e.id, Object.freeze(e)] as const),
);
const FIXTURE_UNITS: ReadonlyMap<string, FixtureUnitEntry> = new Map(
  (unitsData as unknown as UnitEnvelope).entities.map((e) => [e.id, Object.freeze(e)] as const),
);

const input: TickInput = Object.freeze({ paused: false, decisions: Object.freeze([]), contentVersion: 'content_fixture' });

/** Flattens the fixture entry into the adapter's `EncounterObjectiveSource` (mirrors the launcher's `sourceFor`). */
export function sourceForEncounter(entry: FixtureEncounterEntry): EncounterObjectiveSource {
  return Object.freeze({
    encounterId: entry.id,
    objective: entry.objective,
    bossObjects: Object.freeze(entry.bossObjects ?? []),
    enemySlotCount: entry.enemySlots.length,
    bossUnitId: entry.bossUnitId ?? null,
    bossUnitIdSecondary: entry.bossUnitIdSecondary ?? null,
    survivalDurationSeconds: entry.survivalDurationSeconds ?? null,
    healSustainCount: entry.healSustainCount ?? null,
    modifierIds: Object.freeze(entry.modifierIds ?? []),
    reinforcementWaves: Object.freeze(entry.reinforcementWaves ?? []),
    bossPhases: Object.freeze(entry.bossPhases ?? []),
    bossPhasesSecondary: Object.freeze(entry.bossPhasesSecondary ?? []),
  });
}

/**
 * Resolves an expedition battle node to its fixture encounter. The expedition's
 * battle nodes carry an enemy payload key; when the node type maps to a known
 * phase21 fixture encounter the host runs THAT battle, otherwise `null` (the
 * caller keeps its honest stand-in feed).
 */
export function resolveExpeditionEncounter(nodeType: string, payloadKey: string): Readonly<FixtureEncounterEntry> | null {
  if (payloadKey === '') return null;
  const byNode: Readonly<Record<string, string>> = Object.freeze({
    boss: 'encounter_fixture_boss_duo',
    elite: 'encounter_fixture_boss_object',
    battle: 'encounter_fixture_first',
  });
  const id = byNode[nodeType];
  if (id === undefined) return null;
  return FIXTURE_ENCOUNTERS.get(id) ?? null;
}

function mkEntity(id: string, side: 'player' | 'enemy', lane: Lane, x100v: number, maxLp = 1000): ReturnType<typeof migrateEntity> {
  return migrateEntity({
    entity: Object.freeze({
      id,
      side,
      phase: Object.freeze({ phase: 'ACTIVE', enteredTick: tick(0), controlledReturn: null }),
      maxLp,
      lp: maxLp,
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
  const template = FIXTURE_ENCOUNTERS.get(wave.spawnProfile);
  if (template === undefined) throw new Error(`wave spawnProfile ${wave.spawnProfile} has no encounter`);
  return Object.freeze(template.enemySlots.map((slot, index) => {
    const unit = FIXTURE_UNITS.get(slot.unitId);
    if (unit === undefined) throw new Error(`wave unit ${slot.unitId} has no unit content`);
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

function buildBattle(entry: FixtureEncounterEntry, launch: ReturnType<typeof buildEncounterLaunchConfig>): BattleModel {
  const player = mkEntity('unit_p', 'player', 'middle', 1800, 1000);
  const enemies = entry.enemySlots.map((slot, index) => mkEntity(slot.unitId, 'enemy', slot.lane, 6200 + index * 400, 1000));
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

function systemsFor(launch: ReturnType<typeof buildEncounterLaunchConfig>): readonly KernelSystem[] {
  return Object.freeze([
    ...createPhase17Systems({
      speedsX100PerSecond: {},
      bossObjectPolicies: launch.bossObjectPolicies,
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

function liveFrom(state: BattleModel, events: readonly { type: string; tick: number; contentIds: readonly string[]; resolveTick?: number }[], entry: FixtureEncounterEntry): LiveOutboundInput {
  return Object.freeze({
    encounterId: entry.id,
    objective: entry.objective,
    tick: state.tick,
    phase: Object.freeze({ phase: state.phase.phase, endReason: state.endReason }),
    bossPhase: state.bossPhase === undefined
      ? null
      : Object.freeze({ phaseId: state.bossPhase.phaseId, visited: Object.freeze([...state.bossPhase.visited]), transition: state.bossPhase.transition !== null }),
    modifierHookLog: Object.freeze((state.modifierHookLog ?? []).map((f) => Object.freeze({ modifierId: f.modifierId, hook: f.hook, atTick: f.atTick }))),
    events: Object.freeze(events.map((e) => Object.freeze({
      type: e.type,
      tick: e.tick,
      contentIds: Object.freeze([...e.contentIds]),
      ...(e.resolveTick === undefined ? {} : { resolveTick: e.resolveTick }),
    }))),
  });
}

export interface SimBattleHostConfig {
  readonly encounter: Readonly<FixtureEncounterEntry>;
  /** Tick cap (default 1500 — every fixture mission resolves within it). */
  readonly maxTicks?: number;
}

export interface SimBattleHost {
  readonly encounterId: string;
  readonly objective: string;
  /** Runs the kernel battle to its terminal (or the tick cap) and returns the live outbound input. */
  run(): LiveOutboundInput;
}

/** Runs the real kernel battle for one fixture encounter and exposes the outbound sense. */
export function createSimBattleHost(config: SimBattleHostConfig): SimBattleHost {
  const entry = config.encounter;
  const source = sourceForEncounter(entry);
  const deps = Object.freeze({
    modifiers: FIXTURE_MODIFIERS,
    encounters: new Map([...FIXTURE_ENCOUNTERS.entries()].map(([id, e]) => [id, { enemySlots: e.enemySlots }] as const)),
  });
  const launch = buildEncounterLaunchConfig(source, deps);
  const systems = systemsFor(launch);
  const maxTicks = config.maxTicks ?? 1500;
  let cached: LiveOutboundInput | null = null;
  return Object.freeze({
    encounterId: entry.id,
    objective: entry.objective,
    run(): LiveOutboundInput {
      if (cached !== null) return cached;
      const random = new RandomSession(RngStreamMap.fromRunSeed(parseRunSeed(['00000001', '00000002', '00000003', '00000004'])), new RollSlotRegistry([]), false);
      let state: BattleModel = { ...buildBattle(entry, launch), authoritativeStreams: random.streams.snapshotAuthoritative() };
      const events: { type: string; tick: number; contentIds: readonly string[]; resolveTick?: number }[] = [];
      let terminal = false;
      for (let t = 0; t < maxTicks && !terminal; t++) {
        const r = stepBattle({ state, input, random, rules: {}, content: {}, systems });
        state = r.state;
        for (const e of r.events) {
          events.push(Object.freeze({
            type: e.type,
            tick: state.tick,
            contentIds: Object.freeze([...e.contentIds]),
            ...(e.payload['resolveTick'] === undefined ? {} : { resolveTick: e.payload['resolveTick'] }),
          }));
        }
        if (['VICTORY', 'DEFEAT', 'DRAW_ABORT'].includes(state.phase.phase)) terminal = true;
      }
      cached = liveFrom(state, events, entry);
      return cached;
    },
  });
}
