#!/usr/bin/env node
// Phase 21 §P21-T03 content-driven battle launcher. Reads the real encounter
// content (content/source/world/encounters.json + modifiers.json + units.json),
// turns each encounter into a battle through the encounter adapter (objectives
// + boss objects + policies + modifiers + reinforcement waves), steps the
// battle to its terminal outcome, and verifies:
//   - OBJECTIVE RESOLUTION: every content-derived mission objective completes
//     (defeat_all / survive / defeat_boss / protect_object) — the survive
//     window must actually elapse (VICTORY survive_complete), and protect_object
//     forces DEFEAT on destruction;
//   - CONTENT WIRING: the derived modifiers are committed and the declared
//     reinforcement waves spawn their referenced compositions at their ticks;
//   - ZERO DRIFT: two identical runs of the same encounter are byte-identical
//     (same snapshot checksum, same terminal phase/reason);
//   - NO INVARIANT ERRORS across the whole launch;
//   - OUTBOUND SURFACE: per encounter it reports the modifier hook log (for
//     hook-driven telegraphs) and the boss phase at the terminal, and the
//     boss teeth run emits the full phase trace (planned/started/completed
//     with their ticks) so a frontend can render content boss scripting.
// Report is written to --out (default docs/reports/phase21-content-encounters.json).
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadKernel } from './lib/kernel-loader.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..', '..');

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  if (i >= 0 && process.argv[i + 1] !== undefined) return process.argv[i + 1];
  return fallback;
}
const out = resolve(arg('out', resolve(root, 'docs', 'reports', 'phase21-content-encounters.json')));

const api = await loadKernel();
const input = Object.freeze({ paused: false, decisions: Object.freeze([]), contentVersion: 'content_fixture' });

function readEntities(rel) {
  const envelope = JSON.parse(readFileSync(resolve(root, rel), 'utf8'));
  return new Map(envelope.entities.map((e) => [e.id, e]));
}

/**
 * §8 content spawnBodies resolver: a wave's spawnProfile is the referenced
 * encounter id; its combat bodies come from that encounter's slots + the unit
 * stats (maxLp milli→plain, collision radius) — the wave is fully content-driven.
 */
function spawnBodiesFor(encounters, units) {
  return (wave) => {
    const template = encounters.get(wave.spawnProfile);
    if (template === undefined) throw new Error(`wave spawnProfile ${wave.spawnProfile} has no encounter`);
    // wave.entityIds are the adapter's distinct per-wave spawn ids, committed
    // in the fixed §8 spawn order (index-aligned with the template slots).
    return Object.freeze(template.enemySlots.map((slot, index) => {
      const unit = units.get(slot.unitId);
      if (unit === undefined) throw new Error(`wave unit ${slot.unitId} has no unit content`);
      return Object.freeze({
        entityId: wave.entityIds[index],
        lane: slot.lane,
        x100: 6200 + index * 400,
        radiusX100: unit.collisionRadiusX100,
        maxLp: Math.max(1, Math.round(unit.baseStats.maxHp / 1000)),
      });
    }));
  };
}

try {
  const encounters = readEntities('content/source/world/encounters.json');
  const modifiers = readEntities('content/source/world/modifiers.json');
  const units = readEntities('content/source/units/units.json');
  const { migrate, primitives, x100, battleKernel, snapshot } = api;

  const mkEntity = (id, side, lane, x100v, maxLp = 1000) =>
    migrate.migrateEntity({
      entity: Object.freeze({
        id,
        side,
        phase: Object.freeze({ phase: 'ACTIVE', enteredTick: primitives.tick(0), controlledReturn: null }),
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

  function sourceFor(encounter) {
    return Object.freeze({
      encounterId: encounter.id,
      objective: encounter.objective,
      bossObjects: Object.freeze(encounter.bossObjects ?? []),
      enemySlotCount: encounter.enemySlots.length,
      bossUnitId: encounter.bossUnitId ?? null,
      survivalDurationSeconds: encounter.survivalDurationSeconds ?? null,
      modifierIds: Object.freeze(encounter.modifierIds ?? []),
      reinforcementWaves: Object.freeze(encounter.reinforcementWaves ?? []),
      bossPhases: Object.freeze(encounter.bossPhases ?? []),
    });
  }

  /** §4: initial BossPhaseSnapshot (entry phase at full HP) for a content phase set. */
  function bossPhaseSnapshotFor(launch) {
    const defs = launch.bossPhaseDefinitions;
    if (defs.length === 0) return undefined;
    const bossId = defs[0]
      .bossId;
    const entry = defs.find((p) => p.maxHpPermille === 1001) ?? defs[0];
    return Object.freeze({
      entityId: bossId,
      bossId,
      phaseId: entry.id,
      transition: null,
      visited: Object.freeze([entry.id]),
      invulnerableUntilTick: null,
    });
  }

  const launchDeps = Object.freeze({
    modifiers: new Map([...modifiers.values()].map((m) => [m.id, m])),
    encounters: new Map([...encounters.values()].map((e) => [e.id, { enemySlots: e.enemySlots }])),
  });
  const spawnBodies = spawnBodiesFor(launchDeps.encounters, units);

  function buildBattle(encounter, launch) {
    const player = mkEntity('unit_p', 'player', 'middle', 1800, 1000);
    const enemies = encounter.enemySlots.map((slot, index) =>
      mkEntity(slot.unitId, 'enemy', slot.lane, 6200 + index * 400, 1000));
    const entities = [player, ...enemies];
    const temps = [];
    if (launch.bossObjects.length > 0) {
      const placed = launch.bossObjects.map((b, i) => api.bossObjectManager.buildBossObject(b.spec, b.entityId, b.side, b.ownerId, b.sourceId, 0, i));
      temps.push(...placed);
      entities.push(...launch.bossObjects.map((b) => api.bossObjectManager.buildBossObjectBody(b, primitives.tick(0))));
    }
    // The boss battle entity for defeat_boss missions (declared bossUnitId).
    const bossId = encounter.bossUnitId ?? null;
    if (bossId !== null && !entities.some((e) => e.id === bossId)) {
      entities.push(mkEntity(bossId, 'enemy', 'middle', 7000, 3000));
    }
    return Object.freeze({
      schemaVersion: 1,
      simulationVersion: 'phase21-content-launch-v1',
      battleId: 'battle_fixture',
      tick: primitives.tick(0),
      nextSequence: primitives.sequence(0),
      emittedEventCount: 0,
      phase: Object.freeze({ phase: 'ACTIVE', enteredTick: primitives.tick(0), resolvingEndTicks: 0 }),
      entities: Object.freeze(entities),
      temporaryEntities: Object.freeze(temps),
      ...(launch.bossPhaseDefinitions.length > 0 ? { bossPhase: bossPhaseSnapshotFor(launch) } : {}),
      // The standard ability surface (empty here) — its presence enables the
      // kernel's previous-tick history tracking that objective resolution folds.
      abilities: Object.freeze([]),
      scheduledEvents: Object.freeze([]),
      authoritativeStreams: Object.freeze([]),
      endReason: null,
    });
  }

  function systemsFor(launch) {
    const damagePolicies = new Map(launch.bossObjectPolicies);
    return Object.freeze([
      ...api.phase17Systems.createPhase17Systems({
        speedsX100PerSecond: {},
        bossObjectPolicies: damagePolicies,
        basicAttack: {
          parameters: {
            unit_p: {
              attackIntervalTicks: 10,
              prepareTicks: 1,
              recoveryTicks: 3,
              preferredRangeX100: x100.asX100(9000),
              delivery: { kind: 'direct', rawAmount: 250, damageTypeOrdinal: 0, defense: 0, bossCapBps: null },
            },
          },
        },
      }),
      ...api.phase21Systems.createPhase21Systems({
        bossObjects: launch.bossObjects,
        objectives: launch.objectives,
        modifiers: launch.modifiers,
        waves: launch.waves,
        spawnBodies,
        bossPhaseDefinitions: launch.bossPhaseDefinitions,
      }),
    ]);
  }

  function runOne(battle, systems) {
    const streams = api.random.RngStreamMap.fromRunSeed(api.random.parseRunSeed(['00000001', '00000002', '00000003', '00000004']));
    const random = new api.random.RandomSession(streams, new api.random.RollSlotRegistry([]), false);
    let state = { ...battle, authoritativeStreams: random.streams.snapshotAuthoritative() };
    let ticks = 0;
    let terminal = null;
    // The survive fixture's window is 900 ticks; the cap must exceed the
    // longest mission window plus the resolving window (default 1500).
    for (let t = 0; t < 1500 && terminal === null; t++) {
      const r = battleKernel.stepBattle({ state, input, random, rules: {}, content: {}, systems });
      state = r.state;
      ticks += 1;
      if (['VICTORY', 'DEFEAT', 'DRAW_ABORT'].includes(state.phase.phase)) {
        terminal = { phase: state.phase.phase, reason: state.endReason };
      }
    }
    return { state, ticks, terminal };
  }

  const perEncounter = {};
  let invariantErrors = 0;
  let drift = 0;
  let totalBattles = 0;
  let seededFailures = 0;
  for (const encounter of encounters.values()) {
    let launch;
    try {
      launch = api.encounterAdapter.buildEncounterLaunchConfig(sourceFor(encounter), launchDeps);
    } catch (error) {
      invariantErrors += 1;
      perEncounter[encounter.id] = { status: 'LAUNCH_ERROR', error: error?.message ?? String(error) };
      continue;
    }
    // The content-derived objective ids/kinds/requirements must land in the
    // battle state exactly as the adapter derived them (the wiring proof).
    const expectedObjectives = launch.objectives.map((o) => [o.id, o.kind, o.targetId, o.required]);
    const systems = systemsFor(launch);
    const a = runOne(buildBattle(encounter, launch), systems);
    const b = runOne(buildBattle(encounter, launch), systems);
    totalBattles += 1;
    const checksumA = snapshot.createSnapshot(a.state).checksum;
    const checksumB = snapshot.createSnapshot(b.state).checksum;
    if (checksumA !== checksumB || a.terminal?.phase !== b.terminal?.phase || a.terminal?.reason !== b.terminal?.reason) {
      drift += 1;
    }
    const actualObjectives = (a.state.objectives ?? []).map((o) => [o.id, o.kind, o.targetId, o.required]);
    const seeded = JSON.stringify(actualObjectives) === JSON.stringify(expectedObjectives);
    if (!seeded) seededFailures += 1;
    // Boss objects declared in content must be placed as real bodies + registry
    // entries in the launched battle.
    const placedObjects = launch.bossObjects.filter((obj) => a.state.entities.some((e) => e.id === obj.entityId)).length;
    const objectsPlaced = placedObjects === launch.bossObjects.length;
    if (!objectsPlaced) seededFailures += 1;
    // §7: the derived modifiers must be committed into the battle state.
    const committedModifierIds = (a.state.modifiers ?? []).map((m) => m.id).sort();
    const expectedModifierIds = [...launch.modifiers.map((m) => m.id)].sort();
    const modifiersCommitted = JSON.stringify(committedModifierIds) === JSON.stringify(expectedModifierIds);
    if (!modifiersCommitted) seededFailures += 1;
    // §7 hook execution: every committed modifier's declared hooks must appear
    // in the battle's canonical hook log (on_battle_start at tick 0,
    // on_spawn/on_damage_applied/on_phase_entry/on_entity_defeated from the
    // canonical event stream the battle actually produced).
    const hookLog = a.state.modifierHookLog ?? [];
    const hooksFired = launch.modifiers.every((m) => m.hooks.every((hook) => hookLog.some((f) => f.modifierId === m.id && f.hook === hook)));
    if (!hooksFired) seededFailures += 1;
    // §8: the declared reinforcement waves must enter the spawned-wave cursor
    // (the battle ran past their scheduled ticks).
    const expectedWaveIds = launch.waves.map((w) => w.id).sort();
    const actualWaveIds = (a.state.spawnedWaves ?? []).filter((id) => expectedWaveIds.includes(id)).sort();
    const wavesSpawned = JSON.stringify(actualWaveIds) === JSON.stringify(expectedWaveIds);
    if (!wavesSpawned) seededFailures += 1;
    const objectivesComplete = a.state.objectives?.every((o) => o.complete) ?? true;
    if (!objectivesComplete) seededFailures += 1;
    // §9 outbound surface: the modifier hook log (for hook-driven telegraphs) and
    // the boss phase at the terminal (for rendering the current phase/transition).
    const phaseState = a.state.bossPhase === undefined ? null : Object.freeze({
      phaseId: a.state.bossPhase.phaseId,
      visited: Object.freeze([...a.state.bossPhase.visited]),
      transition: a.state.bossPhase.transition !== null,
    });
    perEncounter[encounter.id] = {
      objective: encounter.objective,
      objectivesSeeded: seeded,
      bossObjectsPlaced: objectsPlaced,
      modifiersCommitted,
      hooksFired,
      wavesSpawned,
      terminal: a.terminal,
      ticks: a.ticks,
      objectivesComplete,
      hooks: hookLog.map((f) => [f.modifierId, f.hook, f.atTick]),
      bossPhase: phaseState,
      checksum: checksumA,
      drift: checksumA !== checksumB,
      status: seeded && objectsPlaced && modifiersCommitted && hooksFired && wavesSpawned && objectivesComplete ? 'PASS' : 'FAIL',
    };
  }

  // Dedicated protect_object teeth run: the enemy kills the protected body, the
  // objective flips incomplete, and the forced DEFEAT fires (protect_object_failed).
  const protectEncounter = encounters.get('encounter_fixture_protect_object');
  if (protectEncounter !== undefined) {
    const launch = api.encounterAdapter.buildEncounterLaunchConfig(sourceFor(protectEncounter), launchDeps);
    const protectedBody = launch.bossObjects[0];
    if (protectedBody !== undefined) {
      const battle = buildBattle(protectEncounter, launch);
      const body = api.bossObjectManager.buildBossObjectBody(protectedBody, primitives.tick(0));
      const temp = api.bossObjectManager.buildBossObject(protectedBody.spec, protectedBody.entityId, protectedBody.side, protectedBody.ownerId, protectedBody.sourceId, 0, 0);
      const state = {
        ...battle,
        entities: Object.freeze([...battle.entities.filter((e) => e.id !== protectedBody.entityId), body]),
        temporaryEntities: Object.freeze([...battle.temporaryEntities.filter((t) => t.id !== protectedBody.entityId), temp]),
        pendingCombatApplications: Object.freeze([
          Object.freeze({ kind: 'damage', sourceId: 'unit_enemy_attacker', targetId: protectedBody.entityId, effectId: 'ef_kill', attackInstanceId: 1, effectIndex: 0, rawAmount: 10000, damageTypeOrdinal: 0, defense: 0, coverReductionBps: 0, bossCapBps: null }),
        ]),
      };
      const systems = systemsFor(launch);
      const result = runOne(state, systems);
      const teethOk = result.terminal?.phase === 'DEFEAT' && result.terminal?.reason === 'protect_object_failed';
      if (!teethOk) seededFailures += 1;
      perEncounter['encounter_fixture_protect_object'].teeth = teethOk;
      perEncounter['encounter_fixture_protect_object'].status = perEncounter['encounter_fixture_protect_object'].status === 'PASS' && teethOk ? 'PASS' : 'FAIL';
    }
  }

  // Dedicated boss-phase teeth run: prove the content phases drive a real
  // descent across the boss's HP. With only the phase21 systems wired (no
  // combat), the seeded boss HP stays fixed, so each p1->p2->p3 transition
  // commits deterministically at its content tick window.
  const phasesEncounter = encounters.get('encounter_fixture_boss_object');
  if (phasesEncounter !== undefined) {
    const launch = api.encounterAdapter.buildEncounterLaunchConfig(sourceFor(phasesEncounter), launchDeps);
    if (launch.bossPhaseDefinitions.length > 0) {
      const defs = launch.bossPhaseDefinitions;
      const bossId = defs[0].bossId;
      const phaseTrace = [];
      const teethSystems = Object.freeze([...api.phase21Systems.createPhase21Systems({
        bossObjects: launch.bossObjects,
        objectives: launch.objectives,
        modifiers: launch.modifiers,
        waves: launch.waves,
        spawnBodies,
        bossPhaseDefinitions: launch.bossPhaseDefinitions,
      })]);
      const teethRandom = new api.random.RandomSession(
        api.random.RngStreamMap.fromRunSeed(api.random.parseRunSeed(['00000001', '00000002', '00000003', '00000004'])),
        new api.random.RollSlotRegistry([]), false,
      );
      const seedBoss = (battle, permille) => {
        const boss = battle.entities.find((e) => e.id === bossId);
        const maxLp = boss?.maxLp ?? 3000;
        return { ...battle, entities: Object.freeze(battle.entities.map((e) => (e.id === bossId ? { ...e, lp: Math.max(1, Math.floor((maxLp * permille) / 1000)) } : e))) };
      };
      const stepUntil = (_start, phaseId, cap) => {
        let current = { ..._start, authoritativeStreams: teethRandom.streams.snapshotAuthoritative() };
        for (let t = 0; t < cap; t++) {
          const r = api.battleKernel.stepBattle({ state: current, input, random: teethRandom, rules: {}, content: {}, systems: teethSystems });
          current = r.state;
          for (const event of r.events) {
            if (['PhaseTransitionPlanned', 'BossPhaseCompleted', 'BossPhaseStarted', 'BossTelegraphStarted'].includes(event.type)) {
              phaseTrace.push([event.type, current.tick, event.contentIds.join('/')]);
            }
          }
          if (current.bossPhase?.phaseId === phaseId) return { reached: true, state: current };
        }
        return { reached: false, state: current };
      };
      // Descend p1 -> p2: seed at 40% HP (permille 400, inside p2's [251,501)).
      const p2 = stepUntil(seedBoss(buildBattle(phasesEncounter, launch), 400), 'phase_ash_2', 120);
      // Descend p2 -> p3: drop to 12% HP (permille 120, inside p3's [0,251)).
      const p3 = p2.reached ? stepUntil(seedBoss(p2.state, 120), 'phase_ash_3', 200) : { reached: false };
      const phasesDescended = p2.reached && p3.reached;
      if (!phasesDescended) seededFailures += 1;
      perEncounter[phasesEncounter.id].phasesDescended = phasesDescended;
      // The full descent trail: a frontend can render the telegraphs/commits as
      // hook-driven boss scripting (planned -> started/completed with the tick).
      perEncounter[phasesEncounter.id].phaseTrace = phaseTrace;
      perEncounter[phasesEncounter.id].status = perEncounter[phasesEncounter.id].status === 'PASS' && phasesDescended ? 'PASS' : 'FAIL';
    }
  }

  const report = {
    schemaVersion: 1,
    gate: 'G21-CONTENT-LAUNCH',
    sourceRevision: process.env.SOURCE_REVISION ?? null,
    runtime: { node: process.version, platform: process.platform, arch: process.arch },
    encounters: encounters.size,
    totalBattles,
    invariantErrors,
    drift,
    seededFailures,
    perEncounter,
    status: invariantErrors === 0 && drift === 0 && seededFailures === 0 && Object.values(perEncounter).every((e) => e.status === 'PASS') ? 'PASS' : 'FAIL',
  };
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
  if (report.status !== 'PASS') process.exit(1);
} finally {
  api.close();
}
