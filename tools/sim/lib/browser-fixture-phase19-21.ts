// Phase 19/20/21 browser cross-runtime oracles. This module is imported
// (side-effect) by browser-fixture.ts and bundled into the same IIFE; it
// publishes the ability (P19), synergy/summon (P20) and boss/objective/wave/
// hazard (P21) trace results on globalThis.__P19_CROSSRUNTIME__ /
// __P20_CROSSRUNTIME__ / __P21_CROSSRUNTIME__. Each trace mirrors the matching
// node loader and pinned fixture byte-for-byte, so any engine divergence is a
// real cross-runtime finding.
import { stepBattle } from '../../../src/game/sim/core/battle-kernel.js';
import { migrateEntity } from '../../../src/game/sim/core/migrate.js';
import { createPhase19Systems } from '../../../src/game/sim/core/phase19-systems.js';
import { createPhase20Systems } from '../../../src/game/sim/core/phase20-systems.js';
import { createPhase21Systems, type Phase21RuntimeConfig } from '../../../src/game/sim/core/phase21-systems.js';
import { createPhase17Systems } from '../../../src/game/sim/core/phase17-systems.js';
import { buildBossObject, buildBossObjectBody } from '../../../src/game/sim/boss/boss-object-manager.js';
import { createAbilityInstance } from '../../../src/game/sim/ability/ability-system.js';
import { sequence, tick } from '../../../src/game/sim/core/primitives.js';
import { RngStreamMap } from '../../../src/game/sim/random/rng-stream-map.js';
import { RandomSession } from '../../../src/game/sim/random/random-session.js';
import { RollSlotRegistry } from '../../../src/game/sim/random/roll-slot-registry.js';
import { parseRunSeed } from '../../../src/game/sim/random/run-seed.js';
import { createSnapshot } from '../../../src/game/sim/snapshot/snapshot.js';
import type { PhaseDefinition } from '../../../src/game/sim/boss/boss-phase-system.js';
import type { Objective } from '../../../src/game/sim/objectives/combat-objective.js';
import type { Wave } from '../../../src/game/sim/world/reinforcement-system.js';
import type { ModifierDefinition } from '../../../src/game/sim/world/modifier-system.js';
import type { Hazard } from '../../../src/game/sim/world/hazard-system.js';
import type { EffectCommand } from '../../../src/game/sim/ability/effect-command.js';
import type { AbilityRuntimeDefinition } from '../../../src/game/sim/ability/ability-runtime.js';
import type { BossObjectContent } from '../../../src/game/sim/boss/boss-object-manager.js';

const SEED = ['00000001', '00000002', '00000003', '00000004'] as const;
const input = Object.freeze({ paused: false, decisions: Object.freeze([]), contentVersion: 'content_fixture' });

function buildRandom(): RandomSession {
  const streams = RngStreamMap.fromRunSeed(parseRunSeed([...SEED]));
  return new RandomSession(streams, new RollSlotRegistry([]), false);
}

function mk(id: string, side: 'player' | 'enemy', x100: number, lane: 'top' | 'middle' | 'bottom', lp = 1000, radius = 100) {
  return migrateEntity({
    entity: Object.freeze({
      id,
      side,
      phase: Object.freeze({ phase: 'ACTIVE', enteredTick: tick(0), controlledReturn: null }),
      maxLp: 1000,
      lp,
      shield: 0,
      lane,
      x100,
      targetId: null,
      timers: Object.freeze({}),
    }),
    radiusX100: radius,
  });
}

function battleShell(simulationVersion: string, entities: readonly ReturnType<typeof mk>[], extras: Record<string, unknown> = {}) {
  const rnd = buildRandom();
  return Object.freeze({
    schemaVersion: 1,
    simulationVersion,
    battleId: 'battle_fixture',
    tick: tick(0),
    nextSequence: sequence(0),
    emittedEventCount: 0,
    phase: Object.freeze({ phase: 'ACTIVE', enteredTick: tick(0), resolvingEndTicks: 0 }),
    entities,
    scheduledEvents: Object.freeze([]),
    authoritativeStreams: rnd.streams.snapshotAuthoritative(),
    endReason: null,
    ...extras,
  });
}

// ---------------------------------------------------------------------------
// Phase 19 oracle: fireball ability (tick_interval trigger, nearest enemy
// target, stage-I damage), matching reference-traces-phase19.json.
// ---------------------------------------------------------------------------
function fireballDefinition(): AbilityRuntimeDefinition {
  return {
    config: {
      abilityId: 'ability_fireball',
      chargeTicks: null,
      cooldownTicks: 3,
      castTicks: 2,
      recoveryTicks: 1,
      interruptPolicy: 'interruptible',
      usesPerBattle: null,
      invalidTargetPolicy: 'wait',
      bossPhaseCancelAllowed: false,
    },
    trigger: { type: 'tick_interval', everyTicks: 15 },
    targetQuery: { space: 'enemy_entity', profile: 'nearest' },
    effects: (ctx): readonly EffectCommand[] => [
      Object.freeze({
        commandId: `${ctx.abilityInstanceId}_effect_0`,
        abilityInstanceId: ctx.abilityInstanceId,
        abilityId: ctx.abilityId,
        effectIndex: 0,
        sourceId: ctx.source.sourceId,
        targetRef: Object.freeze({ kind: 'entity' as const, entityId: ctx.target.entityId, groundKey: null, slotId: null }),
        scheduledTick: ctx.commitTick,
        stage: 'I' as const,
        sourceSnapshot: ctx.source,
        sequence: 0,
        kind: 'damage' as const,
        amount: 120,
      }),
    ],
  };
}

const p19Entities = Object.freeze([
  mk('unit_player_a', 'player', 1800, 'top'),
  mk('unit_player_b', 'player', 2400, 'middle'),
  mk('unit_enemy_a', 'enemy', 6200, 'middle'),
  mk('unit_enemy_b', 'enemy', 7600, 'bottom'),
]);
const p19State0 = battleShell('phase19-fixture-v1', p19Entities, {
  abilities: Object.freeze([createAbilityInstance(fireballDefinition().config, 'inst_fireball', 'unit_player_a')]),
});
const p19Random = buildRandom();
const p19StartHash = createSnapshot(p19State0).checksum;
const p19Checkpoints: { tick: number; checksum: string }[] = [];

let p19State = p19State0;
let p19CallOrder: readonly string[] = [];
for (let i = 0; i < 60; i++) {
  const r = stepBattle({
    state: p19State,
    input,
    random: p19Random,
    rules: {},
    content: {},
    systems: createPhase19Systems({ speedsX100PerSecond: {}, abilities: { definitions: { ability_fireball: fireballDefinition() } } }),
  });
  p19State = r.state;
  if (i === 0) p19CallOrder = r.callOrder;
  if (r.checkpoint) p19Checkpoints.push({ tick: p19State.tick, checksum: r.checkpoint.checksum });
}

const p19Result = Object.freeze({
  startHash: p19StartHash,
  tick30: p19Checkpoints.find((c) => c.tick === 30)?.checksum ?? null,
  tick60: p19Checkpoints.find((c) => c.tick === 60)?.checksum ?? null,
  endHash: createSnapshot(p19State).checksum,
  endTick: p19State.tick,
  endReason: p19State.endReason,
  eventCount: p19State.emittedEventCount,
  callOrder: p19CallOrder,
});

(globalThis as unknown as { __P19_CROSSRUNTIME__: unknown }).__P19_CROSSRUNTIME__ = p19Result;

// ---------------------------------------------------------------------------
// Phase 20 oracle: synergy commit (D) + summon commit/expiry (K), matching
// reference-traces-phase20.json.
// ---------------------------------------------------------------------------
const spawnEffect = (summonId: string, index: number, sourceId: string) =>
  Object.freeze({
    commandId: `spawn_${String(index)}_${summonId}`,
    abilityInstanceId: `inst_summon_${String(index)}`,
    abilityId: 'ability_summon',
    effectIndex: 0,
    sourceId,
    targetRef: Object.freeze({ kind: 'summon_slot' as const, entityId: null, groundKey: null, slotId: null }),
    scheduledTick: 0,
    stage: 'K' as const,
    sourceSnapshot: Object.freeze({ sourceId, sourceLane: 'middle', sourceX100: 1800, sourceLp: 1000, sourceMaxLp: 1000 }),
    sequence: index,
    kind: 'spawn_request' as const,
    summonId,
  });

const p20State0 = battleShell('phase20-fixture-v1', Object.freeze([
  mk('unit_player_a', 'player', 1800, 'top'),
  mk('unit_player_b', 'player', 2400, 'middle'),
  mk('unit_enemy_a', 'enemy', 6200, 'middle'),
  mk('unit_enemy_b', 'enemy', 7600, 'bottom'),
]), {
  temporaryEntities: Object.freeze([]),
  plannedEffects: Object.freeze([spawnEffect('summon_a', 0, 'unit_player_a'), spawnEffect('summon_b', 1, 'unit_player_b')]),
});
const p20Random = buildRandom();
const p20StartHash = createSnapshot(p20State0).checksum;
const p20Checkpoints: { tick: number; checksum: string }[] = [];

let p20State = p20State0;
let p20CallOrder: readonly string[] = [];
for (let i = 0; i < 60; i++) {
  const r = stepBattle({
    state: p20State,
    input,
    random: p20Random,
    rules: {},
    content: {},
    systems: createPhase20Systems({
      unitTraits: Object.freeze({
        unit_player_a: Object.freeze(['kingdom', 'faith']),
        unit_player_b: Object.freeze(['kingdom']),
        unit_enemy_a: Object.freeze(['wild']),
        unit_enemy_b: Object.freeze(['wild']),
      }),
      spawnPolicies: Object.freeze({ ability_summon: 'BLOCK' }),
      spawnLifetimes: Object.freeze({ ability_summon: 30 }),
    }),
  });
  p20State = r.state;
  if (i === 0) p20CallOrder = r.callOrder;
  if (r.checkpoint) p20Checkpoints.push({ tick: p20State.tick, checksum: r.checkpoint.checksum });
}

const p20Result = Object.freeze({
  startHash: p20StartHash,
  tick30: p20Checkpoints.find((c) => c.tick === 30)?.checksum ?? null,
  tick60: p20Checkpoints.find((c) => c.tick === 60)?.checksum ?? null,
  endHash: createSnapshot(p20State).checksum,
  endTick: p20State.tick,
  endReason: p20State.endReason,
  eventCount: p20State.emittedEventCount,
  callOrder: p20CallOrder,
});

(globalThis as unknown as { __P20_CROSSRUNTIME__: unknown }).__P20_CROSSRUNTIME__ = p20Result;

// ---------------------------------------------------------------------------
// Phase 21 oracle: boss transition + objective/wave/hazard, matching
// reference-traces-phase21.json.
// ---------------------------------------------------------------------------
const phase = (id: string, min: number, max: number, priority: number, extra: Partial<PhaseDefinition> = {}): PhaseDefinition =>
  Object.freeze({ id, bossId: 'boss_ash', priority, minHpPermille: min, maxHpPermille: max, previewKey: `preview_${id}`, ...extra });

const defs: readonly PhaseDefinition[] = Object.freeze([
  phase('p1', 501, 1001, 1),
  phase('p2', 251, 501, 2, { invulnerableTicks: 10 }),
  phase('p3', 0, 251, 3),
]);

const modifiers: readonly ModifierDefinition[] = Object.freeze([
  Object.freeze({ id: 'mod_ash_1', previewKey: 'preview_mod_ash_1', hooks: Object.freeze(['on_battle_start'] as const), incompatibilityTags: Object.freeze([]), params: Object.freeze({}) }),
  Object.freeze({ id: 'mod_ash_2', previewKey: 'preview_mod_ash_2', hooks: Object.freeze(['on_phase_entry'] as const), incompatibilityTags: Object.freeze([]), params: Object.freeze({}) }),
]);

const waves: readonly Wave[] = Object.freeze([
  Object.freeze({ id: 'wave_ash_1', scheduledTick: 10, side: 'enemy', entityIds: Object.freeze(['unit_reinforce_a', 'unit_reinforce_b']), spawnProfile: 'profile_grunt', capPolicy: 'BLOCK' }),
]);

const objectives: readonly Objective[] = Object.freeze([
  Object.freeze({ id: 'obj_survive', kind: 'survive_until', targetId: null, required: 60, progress: 0, complete: false }),
  Object.freeze({ id: 'obj_boss', kind: 'kill_boss', targetId: 'boss_ash_unit', required: 1, progress: 0, complete: false }),
  Object.freeze({ id: 'obj_protect', kind: 'protect_object', targetId: 'obj_core', required: 1, progress: 0, complete: false }),
]);

const bossObjects: readonly BossObjectContent[] = Object.freeze([
  Object.freeze({
    entityId: 'obj_core',
    side: 'enemy',
    ownerId: 'boss_ash_unit',
    sourceId: 'content_ash',
    spec: Object.freeze({ slotId: 'boss_slot_0', lane: 'middle', x100: 5000, targetable: true, objectiveLink: null, damagePolicy: 'normal', statusPolicy: 'allow', cleanupPolicy: 'on_objective', fallback: 'FAIL' }),
    maxLp: 1000,
    radiusX100: 120,
  }),
]);

const hazards: readonly Hazard[] = Object.freeze([
  Object.freeze({ id: 'hazard_ash_1', scheduledTick: 5, telegraphTicks: 10, resolveTick: 15, expired: false, form: 'circle', edgePattern: 'edge_dashed', shapeSymbol: 'symbol_skull' }),
]);

const p21config: Phase21RuntimeConfig = Object.freeze({
  bossPhaseDefinitions: defs,
  modifiers,
  waves,
  objectives,
  bossObjects,
  bossCoreMechanicTags: Object.freeze(['core_phase']),
  bossAnnouncedCounterTags: Object.freeze(['dispel']),
});

const p21State0 = battleShell('phase21-fixture-v1', Object.freeze([
  // The node loader's P21 mk gives EVERY entity lp 400 / radius 120.
  mk('unit_player_a', 'player', 1800, 'top', 400, 120),
  mk('boss_ash_unit', 'enemy', 5000, 'middle', 400, 120),
]), {
  bossPhase: Object.freeze({
    entityId: 'boss_ash_unit',
    bossId: 'boss_ash',
    phaseId: 'p1',
    transition: null,
    visited: Object.freeze(['p1']),
    invulnerableUntilTick: null,
  }),
  hazards,
});
const p21Random = buildRandom();
const p21StartHash = createSnapshot(p21State0).checksum;
const p21Checkpoints: { tick: number; checksum: string }[] = [];

let p21State = p21State0;
let p21CallOrder: readonly string[] = [];
for (let i = 0; i < 60; i++) {
  const r = stepBattle({
    state: p21State,
    input,
    random: p21Random,
    rules: {},
    content: {},
    systems: createPhase21Systems(p21config),
  });
  p21State = r.state;
  if (i === 0) p21CallOrder = r.callOrder;
  if (r.checkpoint) p21Checkpoints.push({ tick: p21State.tick, checksum: r.checkpoint.checksum });
}

const p21Result = Object.freeze({
  startHash: p21StartHash,
  tick30: p21Checkpoints.find((c) => c.tick === 30)?.checksum ?? null,
  tick60: p21Checkpoints.find((c) => c.tick === 60)?.checksum ?? null,
  endHash: createSnapshot(p21State).checksum,
  endTick: p21State.tick,
  endReason: p21State.endReason,
  eventCount: p21State.emittedEventCount,
  callOrder: p21CallOrder,
});

(globalThis as unknown as { __P21_CROSSRUNTIME__: unknown }).__P21_CROSSRUNTIME__ = p21Result;

// ---------------------------------------------------------------------------
// Phase 21 protect_object FAILURE oracle: the player's direct hit kills the
// protected boss-object body on tick 0, the protect_object objective flips to
// incomplete, the forced DEFEAT (protect_object_failed) sends the battle
// through RESOLVING_END, and the on_battle_end cleanup removes the destroyed
// body so the terminal snapshot is clean. Mirrors reference-traces-phase21-
// fail.json byte-for-byte (Node + desktop engines hash-identical).
// ---------------------------------------------------------------------------
const p21FailObjectives: readonly Objective[] = Object.freeze([
  Object.freeze({ id: 'obj_protect', kind: 'protect_object', targetId: 'obj_protected', required: 1, progress: 0, complete: false }),
]);

const p21FailObject: BossObjectContent = Object.freeze({
  entityId: 'obj_protected',
  side: 'player',
  ownerId: 'boss_ash_unit',
  sourceId: 'content_ash_fail',
  spec: Object.freeze({ slotId: 'boss_slot_0', lane: 'middle', x100: 4400, targetable: true, objectiveLink: null, damagePolicy: 'normal', statusPolicy: 'allow', cleanupPolicy: 'on_battle_end', fallback: 'FAIL' }),
  maxLp: 100,
  radiusX100: 120,
});

const p21FailBody = buildBossObjectBody(p21FailObject, tick(0));
const p21FailTemp = buildBossObject(p21FailObject.spec, 'obj_protected', 'player', 'boss_ash_unit', 'content_ash_fail', 0, 0);
const p21FailState0 = battleShell('phase21-fail-fixture-v1', Object.freeze([
  mk('unit_player_a', 'player', 1800, 'top'),
  mk('unit_player_b', 'player', 2400, 'middle'),
  mk('boss_ash_unit', 'enemy', 8200, 'bottom', 1000),
  p21FailBody,
]), {
  temporaryEntities: Object.freeze([p21FailTemp]),
  pendingCombatApplications: Object.freeze([
    Object.freeze({ kind: 'damage', sourceId: 'unit_enemy_attacker', targetId: 'obj_protected', effectId: 'ef_kill', attackInstanceId: 1, effectIndex: 0, rawAmount: 200, damageTypeOrdinal: 0, defense: 0, coverReductionBps: 0, bossCapBps: null }),
  ]),
  objectives: p21FailObjectives,
});
const p21FailRandom = buildRandom();
const p21FailStartHash = createSnapshot(p21FailState0).checksum;

let p21FailState = p21FailState0;
let p21FailTerminal = false;
let p21FailCallOrder: readonly string[] = [];
for (let i = 0; i < 60; i++) {
  const r = stepBattle({
    state: p21FailState,
    input,
    random: p21FailRandom,
    rules: {},
    content: {},
    systems: Object.freeze([
      ...createPhase17Systems({ speedsX100PerSecond: {} }),
      ...createPhase21Systems({ objectives: p21FailObjectives, bossObjects: Object.freeze([p21FailObject]) }),
    ]),
  });
  p21FailState = r.state;
  if (i === 0) p21FailCallOrder = r.callOrder;
  if (['VICTORY', 'DEFEAT', 'DRAW_ABORT'].includes(p21FailState.phase.phase)) { p21FailTerminal = true; break; }
}

const p21FailResult = Object.freeze({
  startHash: p21FailStartHash,
  endHash: createSnapshot(p21FailState).checksum,
  endTick: p21FailState.tick,
  endReason: p21FailState.endReason,
  eventCount: p21FailState.emittedEventCount,
  terminal: p21FailTerminal,
  callOrder: p21FailCallOrder,
});

(globalThis as unknown as { __P21_FAIL_CROSSRUNTIME__: unknown }).__P21_FAIL_CROSSRUNTIME__ = p21FailResult;
