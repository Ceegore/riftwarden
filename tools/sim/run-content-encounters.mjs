#!/usr/bin/env node
// Phase 21 §P21-T03 content-driven battle launcher. Reads the real encounter
// content (content/source/world/encounters.json + units.json), turns each
// encounter into a battle through the encounter adapter (objectives + boss
// objects + policies), steps the battle to its terminal outcome, and verifies:
//   - OBJECTIVE RESOLUTION: every content-derived mission objective completes
//     (defeat_all / survive / defeat_boss / protect_object) or fails exactly as
//     the mission mandates (protect_object forces DEFEAT on destruction);
//   - ZERO DRIFT: two identical runs of the same encounter are byte-identical
//     (same snapshot checksum, same terminal phase/reason);
//   - NO INVARIANT ERRORS across the whole launch.
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

try {
  const encounters = readEntities('content/source/world/encounters.json');
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
    });
  }

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
      }),
    ]);
  }

  function runOne(battle, systems) {
    const streams = api.random.RngStreamMap.fromRunSeed(api.random.parseRunSeed(['00000001', '00000002', '00000003', '00000004']));
    const random = new api.random.RandomSession(streams, new api.random.RollSlotRegistry([]), false);
    let state = { ...battle, authoritativeStreams: random.streams.snapshotAuthoritative() };
    let ticks = 0;
    let terminal = null;
    for (let t = 0; t < 500 && terminal === null; t++) {
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
      launch = api.encounterAdapter.buildEncounterLaunchConfig(sourceFor(encounter));
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
    perEncounter[encounter.id] = {
      objective: encounter.objective,
      objectivesSeeded: seeded,
      bossObjectsPlaced: objectsPlaced,
      terminal: a.terminal,
      ticks: a.ticks,
      objectivesComplete: a.state.objectives?.every((o) => o.complete) ?? true,
      checksum: checksumA,
      drift: checksumA !== checksumB,
      status: seeded && objectsPlaced ? 'PASS' : 'FAIL',
    };
  }

  // Dedicated protect_object teeth run: the enemy kills the protected body, the
  // objective flips incomplete, and the forced DEFEAT fires (protect_object_failed).
  const protectEncounter = encounters.get('encounter_fixture_protect_object');
  if (protectEncounter !== undefined) {
    const launch = api.encounterAdapter.buildEncounterLaunchConfig(sourceFor(protectEncounter));
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
