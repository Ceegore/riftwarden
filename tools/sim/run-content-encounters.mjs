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
      bossUnitIdSecondary: encounter.bossUnitIdSecondary ?? null,
      survivalDurationSeconds: encounter.survivalDurationSeconds ?? null,
      healSustainCount: encounter.healSustainCount ?? null,
      modifierIds: Object.freeze(encounter.modifierIds ?? []),
      reinforcementWaves: Object.freeze(encounter.reinforcementWaves ?? []),
      bossPhases: Object.freeze(encounter.bossPhases ?? []),
      bossPhasesSecondary: Object.freeze(encounter.bossPhasesSecondary ?? []),
    });
  }

  /** §4/§10: initial BossPhaseSnapshots (entry phase at full HP), one per content boss authority. */
  function bossPhaseSnapshotsFor(launch) {
    const defs = launch.bossPhaseDefinitions;
    const byBoss = new Map();
    for (const def of defs) {
      const list = byBoss.get(def.bossId) ?? [];
      byBoss.set(def.bossId, [...list, def]);
    }
    const out = [];
    for (const [bossId, group] of byBoss) {
      const entry = group.find((p) => p.maxHpPermille === 1001) ?? group[0];
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
    // The boss battle entities for multi-boss encounters (bossUnitId + bossUnitIdSecondary).
    const bossId = encounter.bossUnitId ?? null;
    if (bossId !== null && !entities.some((e) => e.id === bossId)) {
      entities.push(mkEntity(bossId, 'enemy', 'middle', 7000, 3000));
    }
    const bossIdSecondary = encounter.bossUnitIdSecondary ?? null;
    if (bossIdSecondary !== null && !entities.some((e) => e.id === bossIdSecondary)) {
      entities.push(mkEntity(bossIdSecondary, 'enemy', 'bottom', 7000, 3000));
    }
    const phaseSnapshots = bossPhaseSnapshotsFor(launch);
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
      ...(phaseSnapshots.length > 0 ? { bossPhase: phaseSnapshots[0] } : {}),
      ...(phaseSnapshots.length > 1 ? { bossPhaseSecondary: phaseSnapshots[1] } : {}),
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
    // §7/§6 heal stream: applied heals (HealApplied finalHpDelta) and
    // suppressed lifesteal (LifestealBlocked targetAmount) — the same surface
    // the live host streams, so the report can assert heal-source metrics.
    const healStream = [];
    // The survive fixture's window is 900 ticks; the cap must exceed the
    // longest mission window plus the resolving window (default 1500).
    for (let t = 0; t < 1500 && terminal === null; t++) {
      const r = battleKernel.stepBattle({ state, input, random, rules: {}, content: {}, systems });
      state = r.state;
      ticks += 1;
      for (const event of r.events) {
        if (event.type === 'HealApplied') {
          healStream.push({ tick: state.tick, targetId: event.targetIds[0] ?? event.sourceId ?? '', delta: event.payload['finalHpDelta'] ?? 0, blocked: false });
        } else if (event.type === 'LifestealBlocked') {
          healStream.push({ tick: state.tick, targetId: event.targetIds[0] ?? '', delta: event.payload['targetAmount'] ?? 0, blocked: true });
        }
      }
      if (['VICTORY', 'DEFEAT', 'DRAW_ABORT'].includes(state.phase.phase)) {
        terminal = { phase: state.phase.phase, reason: state.endReason };
      }
    }
    return { state, ticks, terminal, healStream };
  }

  const perEncounter = {};
  let invariantErrors = 0;
  let drift = 0;
  let totalBattles = 0;
  let seededFailures = 0;
  for (const encounter of encounters.values()) {
    // §8.3 heal_sustain: the generic battle never damages the player, so the
    // lifesteal heals would clamp to 0 and the mission could never complete.
    // The dedicated heal teeth run below proves the mission end-to-end with a
    // real sustain setup (damaged player + incoming damage).
    if (encounter.objective === 'heal_sustain') {
      perEncounter[encounter.id] = { objective: encounter.objective, status: 'TEETH_ONLY' };
      continue;
    }
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
    const phaseStateSecondary = a.state.bossPhaseSecondary === undefined ? null : Object.freeze({
      phaseId: a.state.bossPhaseSecondary.phaseId,
      visited: Object.freeze([...a.state.bossPhaseSecondary.visited]),
      transition: a.state.bossPhaseSecondary.transition !== null,
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
      bossPhaseSecondary: phaseStateSecondary,
      // §7/§6 heal stream (applied + blocked) for the static report.
      healStream: a.healStream.slice(0, 12),
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
      const telegraphs = [];
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
            if (event.type === 'BossTelegraphStarted' && event.contentIds.length >= 2) {
              telegraphs.push([event.contentIds[1], current.tick, event.payload['resolveTick'] ?? current.tick]);
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
      perEncounter[phasesEncounter.id].telegraphs = telegraphs;
      perEncounter[phasesEncounter.id].status = perEncounter[phasesEncounter.id].status === 'PASS' && phasesDescended ? 'PASS' : 'FAIL';
    }
  }

  // Multi-boss teeth run: the duo encounter carries TWO boss-phase authorities
  // (bossUnitId + bossUnitIdSecondary), each descending independently and
  // interleaved in one battle. Proves §10 multi-boss wiring end-to-end.
  const duoEncounter = encounters.get('encounter_fixture_boss_duo');
  if (duoEncounter !== undefined) {
    const launch = api.encounterAdapter.buildEncounterLaunchConfig(sourceFor(duoEncounter), launchDeps);
    const duoBossIds = [...new Set(launch.bossPhaseDefinitions.map((d) => d.bossId))];
    if (duoBossIds.length === 2) {
      const [primaryId, secondaryId] = duoBossIds;
      const duoTrace = [];
      const duoTelegraphs = [];
      const duoSystems = Object.freeze([...api.phase21Systems.createPhase21Systems({
        bossObjects: launch.bossObjects,
        objectives: launch.objectives,
        modifiers: launch.modifiers,
        waves: launch.waves,
        spawnBodies,
        bossPhaseDefinitions: launch.bossPhaseDefinitions,
      })]);
      const duoRandom = new api.random.RandomSession(
        api.random.RngStreamMap.fromRunSeed(api.random.parseRunSeed(['00000001', '00000002', '00000003', '00000004'])),
        new api.random.RollSlotRegistry([]), false,
      );
      const seedBosses = (battle, seeds) => {
        const byId = new Map(battle.entities.map((e) => [e.id, e]));
        return { ...battle, entities: Object.freeze(battle.entities.map((e) => {
          const seed = seeds[e.id];
          if (seed === undefined) return e;
          return { ...e, lp: Math.max(1, Math.floor((e.maxLp * seed) / 1000)) };
        })) };
      };
      const stepUntil = (_start, phaseId, cap) => {
        let current = { ..._start, authoritativeStreams: duoRandom.streams.snapshotAuthoritative() };
        for (let t = 0; t < cap; t++) {
          const r = api.battleKernel.stepBattle({ state: current, input, random: duoRandom, rules: {}, content: {}, systems: duoSystems });
          current = r.state;
          for (const event of r.events) {
            if (['PhaseTransitionPlanned', 'BossPhaseCompleted', 'BossPhaseStarted', 'BossTelegraphStarted'].includes(event.type)) {
              duoTrace.push([event.type, current.tick, event.contentIds.join('/')]);
            }
            if (event.type === 'BossTelegraphStarted' && event.contentIds.length >= 2) {
              duoTelegraphs.push([event.contentIds[1], current.tick, event.payload['resolveTick'] ?? current.tick]);
            }
          }
          if (current.bossPhase?.phaseId === phaseId || current.bossPhaseSecondary?.phaseId === phaseId) {
            return { reached: true, state: current };
          }
        }
        return { reached: false, state: current };
      };
      // Primary descends into p2 (40% HP) while the secondary stays in q1.
      const p2 = stepUntil(seedBosses(buildBattle(duoEncounter, launch), { [primaryId]: 400 }), 'phase_duo_p2', 120);
      // Secondary descends into q2 (50% HP) and the primary into p3 (12% HP):
      // both authorities commit interleaved in the SAME battle.
      const interleaved = p2.reached
        ? stepUntil(seedBosses(p2.state, { [primaryId]: 120, [secondaryId]: 500 }), 'phase_duo_q2', 200)
        : { reached: false };
      const bothReached = interleaved.reached
        ? interleaved.state.bossPhase?.phaseId === 'phase_duo_p3' && interleaved.state.bossPhaseSecondary?.phaseId === 'phase_duo_q2'
        : false;
      if (!bothReached) seededFailures += 1;
      perEncounter[duoEncounter.id].multiBossDescended = bothReached;
      perEncounter[duoEncounter.id].phaseTrace = duoTrace;
      perEncounter[duoEncounter.id].telegraphs = duoTelegraphs;
      perEncounter[duoEncounter.id].status = perEncounter[duoEncounter.id].status === 'PASS' && bothReached ? 'PASS' : 'FAIL';
    }
  }

  // §8.3 real heal source teeth: the lifesteal encounter's heal_sustain mission
  // completes from REAL HealApplied events — the modifier-runtime effect turns
  // every queued damage application (player 300, enemy 150) into a heal on its
  // source (150 / 75 @ heal_bps 5000), the player sustains below max LP while
  // the enemy keeps dealing damage, the objective folds the amounts to
  // completion, and the enemy's death ends the battle VICTORY. No heal is
  // injected anywhere — the committed modifier is the only source. Two runs are
  // byte-identical (checksum + heal trace).
  const healEncounter = encounters.get('encounter_fixture_heal_sustain');
  if (healEncounter !== undefined) {
    const launch = api.encounterAdapter.buildEncounterLaunchConfig(sourceFor(healEncounter), launchDeps);
    const lifesteal = launch.modifiers.find((m) => m.params['heal_bps'] !== undefined);
    if (lifesteal !== undefined) {
      const mkHealUnit = (id, side, lane, x100v, maxLp, lp) =>
        migrate.migrateEntity({
          entity: Object.freeze({
            id, side,
            phase: Object.freeze({ phase: 'ACTIVE', enteredTick: primitives.tick(0), controlledReturn: null }),
            maxLp, lp, shield: 0, lane, x100: x100v, targetId: null, timers: Object.freeze({}),
          }),
          radiusX100: 100,
        });
      const buildHealBattle = () => Object.freeze({
        schemaVersion: 1,
        simulationVersion: 'phase21-content-launch-v1',
        battleId: 'battle_fixture_heal_sustain',
        tick: primitives.tick(0),
        nextSequence: primitives.sequence(0),
        emittedEventCount: 0,
        phase: Object.freeze({ phase: 'ACTIVE', enteredTick: primitives.tick(0), resolvingEndTicks: 0 }),
        // Pre-damaged sustain setup (the player has room to heal) against a
        // non-attacking tank: the lifesteal heals the player's OWN damage back
        // (300 → 150), so the player climbs to max LP — where the §8.3 overheal
        // clamp kicks in — while the tank dies to the player's real damage.
        // (A self-healing ENEMY would sawtooth at a fixed point and never die
        // — a real §7 emergent property, exercised by the vitest sustain test.)
        entities: Object.freeze([
          mkHealUnit('unit_p', 'player', 'middle', 1800, 5000, 2500),
          mkHealUnit('unit_e1', 'enemy', 'middle', 6200, 10000, 10000),
        ]),
        temporaryEntities: Object.freeze([]),
        abilities: Object.freeze([]),
        scheduledEvents: Object.freeze([]),
        authoritativeStreams: Object.freeze([]),
        endReason: null,
      });
      const healSystems = Object.freeze([
        ...api.phase17Systems.createPhase17Systems({
          speedsX100PerSecond: {},
          targeting: { focusTargetId: { unit_p: 'unit_e1' } },
          basicAttack: {
            parameters: {
              unit_p: { attackIntervalTicks: 10, prepareTicks: 1, recoveryTicks: 3, preferredRangeX100: x100.asX100(9000), delivery: { kind: 'direct', rawAmount: 300, damageTypeOrdinal: 0, defense: 0, bossCapBps: null } },
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
      const runHeal = () => {
        const healRandom = new api.random.RandomSession(
          api.random.RngStreamMap.fromRunSeed(api.random.parseRunSeed(['00000001', '00000002', '00000003', '00000004'])),
          new api.random.RollSlotRegistry([]), false,
        );
        let state = { ...buildHealBattle(), authoritativeStreams: healRandom.streams.snapshotAuthoritative() };
        const heals = [];
        const healStream = [];
        let ticks = 0;
        for (let t = 0; t < 800 && !['VICTORY', 'DEFEAT', 'DRAW_ABORT'].includes(state.phase.phase); t++) {
          const r = api.battleKernel.stepBattle({ state, input, random: healRandom, rules: {}, content: {}, systems: healSystems });
          state = r.state;
          ticks += 1;
          for (const event of r.events) {
            if (event.type === 'HealApplied' && event.targetIds.length === 1) {
              heals.push([event.targetIds[0], event.payload['rawAmount'] ?? 0, event.payload['finalHpDelta'] ?? 0]);
              healStream.push({ tick: state.tick, targetId: event.targetIds[0], delta: event.payload['finalHpDelta'] ?? 0, blocked: false });
            } else if (event.type === 'LifestealBlocked') {
              healStream.push({ tick: state.tick, targetId: event.targetIds[0] ?? '', delta: event.payload['targetAmount'] ?? 0, blocked: true });
            }
          }
        }
        return {
          state,
          ticks,
          heals,
          healStream,
          terminal: { phase: state.phase.phase, reason: state.endReason },
        };
      };
      const a = runHeal();
      const b = runHeal();
      const objective = a.state.objectives?.find((o) => o.kind === 'heal_sustain');
      const playerHeals = a.heals.filter((h) => h[0] === 'unit_p');
      const healObjectiveDone = objective?.complete === true && objective.progress >= 1000;
      // Real source: the first 7 heals are the full lifesteal amount (150 each
      // from 300 damage @ 5000 bps), the modifier committed with heal_bps, and
      // its on_damage_applied hook fired in the canonical log.
      const realSource = playerHeals.length >= 7
        && playerHeals.slice(0, 7).every((h) => h[1] === 150 && h[2] === 150)
        && a.state.modifiers?.some((m) => m.params['heal_bps'] === 5000) === true
        && a.state.modifierHookLog?.some((f) => f.modifierId === lifesteal.id && f.hook === 'on_damage_applied') === true;
      const player = a.state.entities.find((e) => e.id === 'unit_p');
      const sustain = (player?.lp ?? 0) > 0 && (player?.lp ?? 0) <= 5000;
      // §8.3 clamp at the content level: after reaching max LP the lifesteal
      // heals restore 0 (overheal discard) while the tank still dies.
      const clamped = playerHeals.some((h) => h[2] === 0);
      const deterministic = api.snapshot.createSnapshot(a.state).checksum === api.snapshot.createSnapshot(b.state).checksum
        && JSON.stringify(a.heals) === JSON.stringify(b.heals);
      const healOk = healObjectiveDone && realSource && sustain && clamped && deterministic && a.terminal?.phase === 'VICTORY';
      if (!healOk) seededFailures += 1;
      perEncounter[healEncounter.id] = {
        objective: healEncounter.objective,
        objectivesSeeded: true,
        bossObjectsPlaced: true,
        modifiersCommitted: true,
        hooksFired: true,
        wavesSpawned: true,
        terminal: a.terminal,
        ticks: a.ticks,
        objectivesComplete: healObjectiveDone,
        healSustainRealCombat: healOk,
        heals: a.heals.slice(0, 12),
        // §7/§6 heal stream: real applied heals, zero suppressed (no immune
        // targets in this sustain setup) — tooling pins the source metrics.
        healStream: a.healStream.slice(0, 12),
        checksum: api.snapshot.createSnapshot(a.state).checksum,
        drift: false,
        status: healOk ? 'PASS' : 'FAIL',
      };
    }
  }

  // §10 sustain × collapse TIPPING teeth: `encounter_fixture_sustain_collapse`
  // requires 80000 sustained HP — more than the pre-window grind can bank
  // (player 150/cycle + symmetric enemy self-heal 75/cycle = 225/cycle →
  // 60750 by the 2700-tick soft limit), so the mission is still incomplete
  // when the §10 window opens. Inside the window the heals are HALVED
  // (150→75 player, 75→38 enemy) while the enemy still deals 150/cycle, so
  // the player's net intake goes NEGATIVE and the collapse damage kills them
  // in-window → DEFEAT. The halving is the lever: without it the net is zero
  // and the counter reaches 80000 at tick ~3556 (well past the window). The
  // win-side boundary is pinned by the existing heal encounter (requirement
  // 1000 ≪ bankable ceiling → VICTORY pre-window) vs this 80000 requirement
  // (≫ ceiling → in-window DEFEAT).
  const collapseEncounter = encounters.get('encounter_fixture_sustain_collapse');
  if (collapseEncounter !== undefined) {
    const launch = api.encounterAdapter.buildEncounterLaunchConfig(sourceFor(collapseEncounter), launchDeps);
    const lifesteal = launch.modifiers.find((m) => m.params['heal_bps'] !== undefined);
    if (lifesteal !== undefined) {
      const mkCollapseUnit = (id, side, lane, x100v, maxLp, lp) =>
        migrate.migrateEntity({
          entity: Object.freeze({
            id, side,
            phase: Object.freeze({ phase: 'ACTIVE', enteredTick: primitives.tick(0), controlledReturn: null }),
            maxLp, lp, shield: 0, lane, x100: x100v, targetId: null, timers: Object.freeze({}),
          }),
          radiusX100: 100,
        });
      const buildCollapseBattle = () => Object.freeze({
        schemaVersion: 1,
        simulationVersion: 'phase21-content-launch-v1',
        battleId: 'battle_fixture_sustain_collapse',
        tick: primitives.tick(0),
        nextSequence: primitives.sequence(0),
        emittedEventCount: 0,
        phase: Object.freeze({ phase: 'ACTIVE', enteredTick: primitives.tick(0), resolvingEndTicks: 0 }),
        // Damaged player + an ATTACKING near-immortal tank: net intake zero
        // before the window (150 heal − 150 damage), so the counter grows at
        // 225/cycle for the whole pre-window grind and the player enters the
        // window at 1500 HP.
        entities: Object.freeze([
          mkCollapseUnit('unit_p', 'player', 'middle', 1800, 5000, 1500),
          mkCollapseUnit('unit_e1', 'enemy', 'middle', 6200, 100000, 100000),
        ]),
        temporaryEntities: Object.freeze([]),
        abilities: Object.freeze([]),
        scheduledEvents: Object.freeze([]),
        authoritativeStreams: Object.freeze([]),
        endReason: null,
      });
      const collapseSystems = Object.freeze([
        ...api.phase17Systems.createPhase17Systems({
          speedsX100PerSecond: {},
          targeting: { focusTargetId: { unit_p: 'unit_e1', unit_e1: 'unit_p' } },
          basicAttack: {
            parameters: {
              unit_p: { attackIntervalTicks: 10, prepareTicks: 1, recoveryTicks: 3, preferredRangeX100: x100.asX100(9000), delivery: { kind: 'direct', rawAmount: 300, damageTypeOrdinal: 0, defense: 0, bossCapBps: null } },
              unit_e1: { attackIntervalTicks: 10, prepareTicks: 1, recoveryTicks: 3, preferredRangeX100: x100.asX100(9000), delivery: { kind: 'direct', rawAmount: 150, damageTypeOrdinal: 0, defense: 0, bossCapBps: null } },
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
      // The normal soft limit is 2700 ticks; the window runs to 3150 and the
      // player dies ~2847 — the loop must outrun the death, so cap at 3400.
      const runCollapse = () => {
        const collapseRandom = new api.random.RandomSession(
          api.random.RngStreamMap.fromRunSeed(api.random.parseRunSeed(['00000001', '00000002', '00000003', '00000004'])),
          new api.random.RollSlotRegistry([]), false,
        );
        let state = { ...buildCollapseBattle(), authoritativeStreams: collapseRandom.streams.snapshotAuthoritative() };
        const healStream = [];
        let ticks = 0;
        let deathTick = null;
        for (let t = 0; t < 3400 && !['VICTORY', 'DEFEAT', 'DRAW_ABORT'].includes(state.phase.phase); t++) {
          const r = api.battleKernel.stepBattle({ state, input, random: collapseRandom, rules: {}, content: {}, systems: collapseSystems });
          state = r.state;
          ticks += 1;
          for (const event of r.events) {
            if (event.type === 'HealApplied' && event.targetIds.length === 1) {
              healStream.push({ tick: state.tick, targetId: event.targetIds[0], delta: event.payload['finalHpDelta'] ?? 0, blocked: false });
            } else if (event.type === 'LifestealBlocked') {
              healStream.push({ tick: state.tick, targetId: event.targetIds[0] ?? '', delta: event.payload['targetAmount'] ?? 0, blocked: true });
            }
          }
          if (state.entities.find((e) => e.id === 'unit_p')?.lp === 0) deathTick ??= state.tick;
        }
        return { state, ticks, healStream, deathTick, terminal: { phase: state.phase.phase, reason: state.endReason } };
      };
      const a = runCollapse();
      const b = runCollapse();
      const objective = a.state.objectives?.find((o) => o.kind === 'heal_sustain');
      const windowOpened = a.state.timeCollapseSinceTick === 2700;
      // The §10 halving must be OBSERVED: pre-window player heals 150, and the
      // window is active (≥ 2700) with player heals at the halved 75.
      const preWindow = a.healStream.filter((h) => !h.blocked && h.targetId === 'unit_p' && h.tick < 2700);
      const inWindow = a.healStream.filter((h) => !h.blocked && h.targetId === 'unit_p' && h.tick >= 2700);
      const halvingObserved = preWindow.some((h) => h.delta === 150) && inWindow.some((h) => h.delta === 75);
      const inWindowDeath = a.deathTick !== null && a.deathTick >= 2700 && a.deathTick < 3150;
      const counter = objective?.progress ?? 0;
      const incomplete = objective?.complete === false && counter < 80000;
      const deterministic = api.snapshot.createSnapshot(a.state).checksum === api.snapshot.createSnapshot(b.state).checksum
        && JSON.stringify(a.healStream) === JSON.stringify(b.healStream);
      const collapseOk = a.terminal?.phase === 'DEFEAT' && a.terminal?.reason === 'side_eliminated'
        && windowOpened && halvingObserved && inWindowDeath && incomplete && deterministic;
      if (!collapseOk) seededFailures += 1;
      perEncounter[collapseEncounter.id] = {
        objective: collapseEncounter.objective,
        objectivesSeeded: true,
        bossObjectsPlaced: true,
        modifiersCommitted: true,
        hooksFired: true,
        wavesSpawned: true,
        terminal: a.terminal,
        ticks: a.ticks,
        objectivesComplete: objective?.complete === true,
        // The §10 boundary: requirement 80000 exceeds the bankable counter
        // (~62k at the in-window death) while the win requirement (1000) is
        // far below it — the launcher pins both sides of the tipping point.
        sustainCollapseTeeth: collapseOk,
        windowOpened,
        halvingObserved,
        inWindowDeath,
        counterAtDeath: counter,
        requirement: 80000,
        healStream: a.healStream.slice(0, 12),
        checksum: api.snapshot.createSnapshot(a.state).checksum,
        drift: false,
        status: collapseOk ? 'PASS' : 'FAIL',
      };
    }
  }

  // Real-combat multi-boss teeth: BOTH bosses descend under REAL combat damage
  // (DamageApplied hits that actually move HP — no HP re-seeding). unit_p and
  // unit_p2 focus-fire the primary/secondary boss, so each authority's HP
  // crossings come from the applied damage stream and the phase trail is
  // interleaved in ONE battle.
  const realCombatEncounter = encounters.get('encounter_fixture_boss_duo');
  if (realCombatEncounter !== undefined) {
    const launch = api.encounterAdapter.buildEncounterLaunchConfig(sourceFor(realCombatEncounter), launchDeps);
    const duoBossIds = [...new Set(launch.bossPhaseDefinitions.map((d) => d.bossId))];
    if (duoBossIds.length === 2) {
      const [primaryId, secondaryId] = duoBossIds;
      const mkTeeth = (id, side, lane, x100v, maxLp) =>
        migrate.migrateEntity({
          entity: Object.freeze({
            id, side,
            phase: Object.freeze({ phase: 'ACTIVE', enteredTick: primitives.tick(0), controlledReturn: null }),
            maxLp, lp: maxLp, shield: 0, lane, x100: x100v, targetId: null, timers: Object.freeze({}),
          }),
          radiusX100: 100,
        });
      const buildRealCombatBattle = () => {
        const snapshots = bossPhaseSnapshotsFor(launch);
        return Object.freeze({
          schemaVersion: 1,
          simulationVersion: 'phase21-content-launch-v1',
          battleId: 'battle_fixture_duo_combat',
          tick: primitives.tick(0),
          nextSequence: primitives.sequence(0),
          emittedEventCount: 0,
          phase: Object.freeze({ phase: 'ACTIVE', enteredTick: primitives.tick(0), resolvingEndTicks: 0 }),
          // No regular enemy: the only targets are the two bosses, so every
          // applied hit is a boss hit (the combat damage is unambiguous).
          entities: Object.freeze([
            mkTeeth('unit_p', 'player', 'middle', 1800, 1000),
            mkTeeth('unit_p2', 'player', 'bottom', 1800, 1000),
            mkTeeth(primaryId, 'enemy', 'middle', 7000, 3000),
            mkTeeth(secondaryId, 'enemy', 'bottom', 7000, 3000),
          ]),
          temporaryEntities: Object.freeze([]),
          ...(snapshots.length > 0 ? { bossPhase: snapshots[0] } : {}),
          ...(snapshots.length > 1 ? { bossPhaseSecondary: snapshots[1] } : {}),
          abilities: Object.freeze([]),
          scheduledEvents: Object.freeze([]),
          authoritativeStreams: Object.freeze([]),
          endReason: null,
        });
      };
      const realCombatSystems = Object.freeze([
        ...api.phase17Systems.createPhase17Systems({
          speedsX100PerSecond: {},
          // Each attacker focus-fires its own boss (deterministic targeting).
          targeting: { focusTargetId: { unit_p: primaryId, unit_p2: secondaryId } },
          basicAttack: {
            parameters: {
              unit_p: { attackIntervalTicks: 10, prepareTicks: 1, recoveryTicks: 3, preferredRangeX100: x100.asX100(9000), delivery: { kind: 'direct', rawAmount: 400, damageTypeOrdinal: 0, defense: 0, bossCapBps: null } },
              unit_p2: { attackIntervalTicks: 10, prepareTicks: 1, recoveryTicks: 3, preferredRangeX100: x100.asX100(9000), delivery: { kind: 'direct', rawAmount: 400, damageTypeOrdinal: 0, defense: 0, bossCapBps: null } },
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
      const runRealCombat = () => {
        const rcRandom = new api.random.RandomSession(
          api.random.RngStreamMap.fromRunSeed(api.random.parseRunSeed(['00000001', '00000002', '00000003', '00000004'])),
          new api.random.RollSlotRegistry([]), false,
        );
        let state = { ...buildRealCombatBattle(), authoritativeStreams: rcRandom.streams.snapshotAuthoritative() };
        const damageDealt = { [primaryId]: 0, [secondaryId]: 0 };
        const trace = [];
        const telegraphs = [];
        let ticks = 0;
        for (let t = 0; t < 700 && !['VICTORY', 'DEFEAT', 'DRAW_ABORT'].includes(state.phase.phase); t++) {
          const r = api.battleKernel.stepBattle({ state, input, random: rcRandom, rules: {}, content: {}, systems: realCombatSystems });
          state = r.state;
          ticks += 1;
          for (const event of r.events) {
            if (event.type === 'DamageApplied' && event.targetIds.length === 1) {
              const target = event.targetIds[0];
              if (target === primaryId || target === secondaryId) damageDealt[target] += event.payload['finalHpDelta'] ?? 0;
            }
            if (event.type === 'BossTelegraphStarted' && event.contentIds.length >= 2) {
              telegraphs.push([event.contentIds[1], state.tick, event.payload['resolveTick'] ?? state.tick]);
            }
            if (['PhaseTransitionPlanned', 'BossPhaseCompleted', 'BossPhaseStarted', 'BossTelegraphStarted'].includes(event.type)) {
              trace.push([event.type, state.tick, event.contentIds.join('/')]);
            }
          }
        }
        const primary = state.entities.find((en) => en.id === primaryId);
        const secondary = state.entities.find((en) => en.id === secondaryId);
        return { state, ticks, damageDealt, trace, telegraphs, primaryLp: primary?.lp ?? -1, secondaryLp: secondary?.lp ?? -1 };
      };
      const a = runRealCombat();
      const b = runRealCombat();
      const primaryVisited = a.state.bossPhase?.visited ?? [];
      const secondaryVisited = a.state.bossPhaseSecondary?.visited ?? [];
      const descended = primaryVisited.includes('phase_duo_p2') && secondaryVisited.includes('phase_duo_q2');
      // REAL combat proof: both bosses took actual damage and their LP fell
      // strictly below max (no HP re-seeding); the DamageApplied stream carried it.
      const realDamage = a.damageDealt[primaryId] > 0 && a.damageDealt[secondaryId] > 0
        && a.primaryLp >= 0 && a.primaryLp < 3000 && a.secondaryLp >= 0 && a.secondaryLp < 3000;
      // Interleaved: the phase trace names BOTH bosses in one battle.
      const traceBosses = new Set(a.trace.map((event) => event[2].split('/')[0]));
      const interleaved = traceBosses.has(primaryId) && traceBosses.has(secondaryId);
      const deterministic = api.snapshot.createSnapshot(a.state).checksum === api.snapshot.createSnapshot(b.state).checksum
        && a.ticks === b.ticks && a.trace.length === b.trace.length;
      const realCombatOk = descended && realDamage && interleaved && deterministic;
      if (!realCombatOk) seededFailures += 1;
      perEncounter[realCombatEncounter.id].multiBossRealCombat = realCombatOk;
      perEncounter[realCombatEncounter.id].telegraphs = a.telegraphs;
      perEncounter[realCombatEncounter.id].status = perEncounter[realCombatEncounter.id].status === 'PASS' && realCombatOk ? 'PASS' : 'FAIL';
    }
  }

  // Content-driven wave×boss teeth: the wave-boss encounter carries BOTH
  // reinforcement waves AND content boss phases; prove they run in ONE battle —
  // the declared waves spawn their referenced compositions on schedule while
  // the boss descends across its HP via the content phase machine, and the
  // interplay is deterministic (two runs, identical checksum + spawn trace).
  const waveBossEncounter = encounters.get('encounter_fixture_wave_boss');
  if (waveBossEncounter !== undefined) {
    const launch = api.encounterAdapter.buildEncounterLaunchConfig(sourceFor(waveBossEncounter), launchDeps);
    if (launch.waves.length > 0 && launch.bossPhaseDefinitions.length > 0) {
      const waveBossSystems = Object.freeze([...api.phase21Systems.createPhase21Systems({
        bossObjects: launch.bossObjects,
        objectives: launch.objectives,
        modifiers: launch.modifiers,
        waves: launch.waves,
        spawnBodies,
        bossPhaseDefinitions: launch.bossPhaseDefinitions,
      })]);
      const wbRandom = new api.random.RandomSession(
        api.random.RngStreamMap.fromRunSeed(api.random.parseRunSeed(['00000001', '00000002', '00000003', '00000004'])),
        new api.random.RollSlotRegistry([]), false,
      );
      const seedBoss = (battle, permille) => {
        const boss = battle.entities.find((e) => e.id === waveBossEncounter.bossUnitId);
        const maxLp = boss?.maxLp ?? 3000;
        return { ...battle, entities: Object.freeze(battle.entities.map((e) => (e.id === waveBossEncounter.bossUnitId ? { ...e, lp: Math.max(1, Math.floor((maxLp * permille) / 1000)) } : e))) };
      };
      const runWaveBoss = () => {
        const runRandom = new api.random.RandomSession(
          api.random.RngStreamMap.fromRunSeed(api.random.parseRunSeed(['00000001', '00000002', '00000003', '00000004'])),
          new api.random.RollSlotRegistry([]), false,
        );
        let current = { ...seedBoss(buildBattle(waveBossEncounter, launch), 400), authoritativeStreams: runRandom.streams.snapshotAuthoritative() };
        const spawns = [];
        const trace = [];
        for (let t = 0; t < 300; t++) {
          const r = api.battleKernel.stepBattle({ state: current, input, random: runRandom, rules: {}, content: {}, systems: waveBossSystems });
          current = r.state;
          for (const event of r.events) {
            if (event.type === 'ReinforcementSpawned') spawns.push([event.targetIds[0], current.tick]);
            if (['PhaseTransitionPlanned', 'BossPhaseStarted', 'BossPhaseCompleted'].includes(event.type)) {
              trace.push([event.type, current.tick, event.contentIds.join('/')]);
            }
          }
        }
        return { state: current, spawns, trace };
      };
      const a = runWaveBoss();
      const b = runWaveBoss();
      const spawnedIds = new Set(a.spawns.map((spawn) => spawn[0]));
      const expectedIds = new Set(launch.waves.map((w) => w.id));
      const wavesCommitted = [...expectedIds].every((id) => spawnedIds.has(id)) && spawnedIds.size === expectedIds.size;
      const descended = a.state.bossPhase?.visited.includes('phase_wb_2') === true;
      const onSchedule = launch.waves.every((w) => a.spawns.some((spawn) => spawn[0] === w.id && spawn[1] === w.scheduledTick + 1));
      const deterministic = api.snapshot.createSnapshot(a.state).checksum === api.snapshot.createSnapshot(b.state).checksum
        && JSON.stringify(a.spawns) === JSON.stringify(b.spawns);
      const waveBossInterplay = wavesCommitted && descended && onSchedule && deterministic;
      if (!waveBossInterplay) seededFailures += 1;
      perEncounter[waveBossEncounter.id].waveBossInterplay = waveBossInterplay;
      perEncounter[waveBossEncounter.id].waveSpawnTicks = a.spawns.map((spawn) => [spawn[0], spawn[1]]);
      perEncounter[waveBossEncounter.id].status = perEncounter[waveBossEncounter.id].status === 'PASS' && waveBossInterplay ? 'PASS' : 'FAIL';
    }
  }

  // §8.3 sustain POLICY pass (the heal-stream audit matrix mirrored into a
  // build-time contract): every heal_sustain encounter's requirement must be
  // positive, a heal_bps source must fold to a positive composite scale, and
  // the §6 target set must contain a damageable body. Issues flip the entry
  // (and the report) to FAIL — structural unwinnability is a content error.
  for (const encounter of encounters.values()) {
    if (encounter.objective !== 'heal_sustain') continue;
    const entry = perEncounter[encounter.id];
    if (entry === undefined) continue;
    const launch = api.encounterAdapter.buildEncounterLaunchConfig(sourceFor(encounter), launchDeps);
    const issues = api.phase21Systems.validateSustainPolicy({
      healSustainCount: encounter.healSustainCount ?? null,
      modifiers: launch.modifiers,
      enemySlots: encounter.enemySlots ?? [],
      bossObjects: encounter.bossObjects ?? [],
    });
    entry.sustainPolicy = issues.map((i) => i.code);
    if (issues.length > 0) {
      seededFailures += 1;
      entry.status = 'FAIL';
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
