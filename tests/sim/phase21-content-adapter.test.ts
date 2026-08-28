import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { EncounterSourceSchema } from '../../content/schemas/index.js';
import { stepBattle } from '../../src/game/sim/core/battle-kernel.js';
import { createPhase17Systems } from '../../src/game/sim/core/phase17-systems.js';
import { createPhase21Systems } from '../../src/game/sim/core/phase21-systems.js';
import { createSnapshot } from '../../src/game/sim/snapshot/snapshot.js';
import { bossObjectsFromContent, bossObjectPoliciesFromContent, blockedStatusTargetsFromContent, buildEncounterLaunchConfig, objectivesFromEncounterContent, type ContentBossObjectEntry, type EncounterObjectiveSource } from '../../src/game/sim/boss/encounter-adapter.js';
import { battle, entity, randomSession, tick } from './test-helpers.js';
import { migrateEntity } from '../../src/game/sim/core/migrate.js';
import type { TickInput } from '../../src/game/sim/core/tick-input.js';
import type { BattleModel } from '../../src/game/sim/core/battle-model.js';
import type { PhaseDefinition } from '../../src/game/sim/boss/boss-phase-system.js';
import { buildBossObject, buildBossObjectBody } from '../../src/game/sim/boss/boss-object-manager.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const input: TickInput = Object.freeze({ paused: false, decisions: Object.freeze([]), contentVersion: 'content_fixture' });

const phase = (id: string, min: number, max: number, priority: number): PhaseDefinition =>
  Object.freeze({ id, bossId: 'boss_ash', priority, minHpPermille: min, maxHpPermille: max, previewKey: `preview_${id}` });

const defs: readonly PhaseDefinition[] = Object.freeze([
  phase('p1', 501, 1001, 1),
  phase('p2', 251, 501, 2),
  phase('p3', 0, 251, 3),
]);

function bossObjectEncounter(): { entries: readonly ContentBossObjectEntry[] } {
  const raw = readFileSync(path.join(here, '../../content/source/world/encounters.json'), 'utf8');
  const envelope = JSON.parse(raw) as { entities: readonly { id?: string }[] };
  const entity = envelope.entities.find((e) => e.id === 'encounter_fixture_boss_object');
  expect(entity).toBeDefined();
  const parsed = EncounterSourceSchema.parse(entity);
  return { entries: parsed.bossObjects };
}

function protectEncounterSource(): EncounterObjectiveSource {
  const raw = readFileSync(path.join(here, '../../content/source/world/encounters.json'), 'utf8');
  const envelope = JSON.parse(raw) as { entities: readonly { id?: string }[] };
  const entity = envelope.entities.find((e) => e.id === 'encounter_fixture_protect_object');
  expect(entity).toBeDefined();
  const parsed = EncounterSourceSchema.parse(entity);
  return {
    encounterId: parsed.id,
    objective: parsed.objective,
    bossObjects: parsed.bossObjects,
    enemySlotCount: parsed.enemySlots.length,
    bossUnitId: parsed.bossUnitId,
    survivalDurationSeconds: parsed.survivalDurationSeconds,
  };
}

function fixtureSource(id: string): EncounterObjectiveSource {
  const raw = readFileSync(path.join(here, '../../content/source/world/encounters.json'), 'utf8');
  const envelope = JSON.parse(raw) as { entities: readonly { id?: string }[] };
  const entity = envelope.entities.find((e) => e.id === id);
  expect(entity).toBeDefined();
  const parsed = EncounterSourceSchema.parse(entity);
  return {
    encounterId: parsed.id,
    objective: parsed.objective,
    bossObjects: parsed.bossObjects,
    enemySlotCount: parsed.enemySlots.length,
    bossUnitId: parsed.bossUnitId,
    survivalDurationSeconds: parsed.survivalDurationSeconds,
  };
}

describe('P21 content boss-object adapter (§6)', () => {
  it('the content schema accepts the boss-object encounter and the adapter maps it 1:1', () => {
    const { entries } = bossObjectEncounter();
    expect(entries.map((e) => e.entityId)).toEqual(['obj_ash_core', 'obj_ash_ward']);
    const bossObjects = bossObjectsFromContent(entries);
    expect(bossObjects).toHaveLength(2);
    // The nested spec mirrors the flattened content fields.
    expect(bossObjects[0]?.spec.slotId).toBe('boss_slot_0');
    expect(bossObjects[0]?.spec.damagePolicy).toBe('normal');
    expect(bossObjects[1]?.spec.damagePolicy).toBe('shield_only');
    expect(bossObjects[1]?.spec.statusPolicy).toBe('block');
    expect(bossObjects[1]?.spec.cleanupPolicy).toBe('on_battle_end');
    expect(bossObjects[0]?.maxLp).toBe(800);
  });

  it('derives a protect_object objective from the linked boss object (1:1, frozen, validated)', () => {
    const source = protectEncounterSource();
    expect(source.objective).toBe('protect_object');
    const objectives = objectivesFromEncounterContent(source);
    expect(objectives).toEqual([
      Object.freeze({ id: 'obj_protect_heart', kind: 'protect_object', targetId: 'obj_ash_heart', required: 1, progress: 0, complete: false }),
    ]);
    expect(Object.isFrozen(objectives)).toBe(true);
    expect(Object.isFrozen(objectives[0])).toBe(true);
  });

  it('derives kill_regulars for defeat_all from the enemy slot count', () => {
    const source = fixtureSource('encounter_fixture_first');
    expect(source.objective).toBe('defeat_all');
    const objectives = objectivesFromEncounterContent(source);
    expect(objectives).toEqual([
      Object.freeze({ id: 'obj_encounter_fixture_first_regulars', kind: 'kill_regulars', targetId: null, required: 1, progress: 0, complete: false }),
    ]);
    expect(Object.isFrozen(objectives)).toBe(true);
  });

  it('derives survive_until for survive from survivalDurationSeconds (30 ticks/s)', () => {
    const source = fixtureSource('encounter_fixture_survive');
    expect(source.objective).toBe('survive');
    const objectives = objectivesFromEncounterContent(source);
    expect(objectives).toEqual([
      Object.freeze({ id: 'obj_encounter_fixture_survive_survive', kind: 'survive_until', targetId: null, required: 900, progress: 0, complete: false }),
    ]);
  });

  it('derives kill_boss for defeat_boss from bossUnitId', () => {
    const source = fixtureSource('encounter_fixture_boss_object');
    expect(source.objective).toBe('defeat_boss');
    const objectives = objectivesFromEncounterContent(source);
    expect(objectives).toEqual([
      Object.freeze({ id: 'obj_encounter_fixture_boss_object_boss', kind: 'kill_boss', targetId: 'boss_ash_unit', required: 1, progress: 0, complete: false }),
    ]);
  });

  it('a mission kind missing its required field is a content error', () => {
    const survive = fixtureSource('encounter_fixture_survive');
    let caught: unknown = null;
    try {
      objectivesFromEncounterContent({ ...survive, survivalDurationSeconds: null });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toBe('P21_OBJECTIVE_INVALID');
    expect((caught as { details?: { reason?: string } }).details?.reason).toBe('survive-without-duration');

    const boss = fixtureSource('encounter_fixture_boss_object');
    let caughtBoss: unknown = null;
    try {
      objectivesFromEncounterContent({ ...boss, bossUnitId: null });
    } catch (error) {
      caughtBoss = error;
    }
    expect(caughtBoss).toBeInstanceOf(Error);
    expect((caughtBoss as Error).message).toBe('P21_OBJECTIVE_INVALID');
    expect((caughtBoss as { details?: { reason?: string } }).details?.reason).toBe('defeat-boss-without-boss-unit');
  });

  it('buildEncounterLaunchConfig assembles objectives + every boss-object surface in one call', () => {
    const source = fixtureSource('encounter_fixture_protect_object');
    const config = buildEncounterLaunchConfig(source);
    expect(config.objectives).toEqual([
      Object.freeze({ id: 'obj_protect_heart', kind: 'protect_object', targetId: 'obj_ash_heart', required: 1, progress: 0, complete: false }),
    ]);
    expect(config.bossObjects.map((b) => b.entityId)).toEqual(['obj_ash_heart']);
    expect(config.bossObjectPolicies.get('obj_ash_heart')).toBe('normal');
    expect(config.blockedStatusTargets.size).toBe(0);
    expect(Object.isFrozen(config)).toBe(true);
  });

  it('protect_object without any linked boss object is a content error', () => {
    const source = protectEncounterSource();
    const unlinked = source.bossObjects.map((entry) => ({ ...entry, objectiveLink: null }));
    let caught: unknown = null;
    try {
      objectivesFromEncounterContent({ ...source, bossObjects: unlinked });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toBe('P21_OBJECTIVE_INVALID');
    expect((caught as { details?: { reason?: string } }).details?.reason).toBe('protect-object-without-linked-target');
  });

  it('two objects sharing one objective link is a duplicate-id content error', () => {
    const source = protectEncounterSource();
    const first = source.bossObjects[0];
    expect(first).toBeDefined();
    if (first === undefined) throw new Error('fixture missing linked boss object');
    const duplicate = { ...first, entityId: 'obj_ash_heart_dupe', targetable: true };
    let caught: unknown = null;
    try {
      objectivesFromEncounterContent({ ...source, bossObjects: [first, duplicate] });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(Error);
    expect((caught as Error).message).toBe('P21_OBJECTIVE_INVALID');
    expect((caught as { details?: { reason?: string } }).details?.reason).toBe('duplicate-id');
  });

  it('the content-derived protect objective guards the object end-to-end (DEFEAT on destruction)', () => {
    const source = protectEncounterSource();
    const objectives = objectivesFromEncounterContent(source);
    expect(objectives[0]?.kind).toBe('protect_object');
    const bossObjects = bossObjectsFromContent(source.bossObjects);
    const protectedObject = bossObjects[0];
    expect(protectedObject).toBeDefined();
    if (protectedObject === undefined) throw new Error('fixture missing boss object');
    const protectedId = protectedObject.entityId;
    const body = buildBossObjectBody(protectedObject, tick(0));
    const temp = buildBossObject(protectedObject.spec, protectedObject.entityId, protectedObject.side, protectedObject.ownerId, protectedObject.sourceId, 0, 0);
    const state = battle({
      simulationVersion: 'phase21-protect-fixture-v1',
      entities: Object.freeze([
        migrateEntity({ entity: entity('unit_p', { side: 'player', lane: 'middle', x100: 1800, maxLp: 1000, lp: 1000 }), radiusX100: 100 }),
        body,
      ]),
      temporaryEntities: Object.freeze([temp]),
      pendingCombatApplications: Object.freeze([
        Object.freeze({ kind: 'damage', sourceId: 'unit_enemy_attacker', targetId: protectedId, effectId: 'ef_kill', attackInstanceId: 1, effectIndex: 0, rawAmount: 1000, damageTypeOrdinal: 0, defense: 0, coverReductionBps: 0, bossCapBps: null }),
      ]),
      objectives,
    });
    const systems = Object.freeze([
      ...createPhase17Systems({ speedsX100PerSecond: {}, bossObjectPolicies: bossObjectPoliciesFromContent(source.bossObjects) }),
      ...createPhase21Systems({ objectives, bossObjects }),
    ]);
    const random = randomSession();
    let current = state;
    let terminal: { phase: string; endReason: string | null } | null = null;
    for (let i = 0; i < 20 && terminal === null; i++) {
      const r = stepBattle({ state: current, input, random, rules: {}, content: {}, systems });
      current = r.state;
      if (['VICTORY', 'DEFEAT', 'DRAW_ABORT'].includes(current.phase.phase)) {
        terminal = { phase: current.phase.phase, endReason: current.endReason };
      }
    }
    expect(terminal).not.toBeNull();
    expect(terminal?.phase).toBe('DEFEAT');
    expect(terminal?.endReason).toBe('protect_object_failed');
    const terminalObjective = current.objectives?.find((o) => o.id === 'obj_protect_heart');
    expect(terminalObjective?.complete).toBe(false);
  });

  it('derives the damage-policy map and the blocked status set', () => {
    const { entries } = bossObjectEncounter();
    const policies = bossObjectPoliciesFromContent(entries);
    expect(policies.get('obj_ash_core')).toBe('normal');
    expect(policies.get('obj_ash_ward')).toBe('shield_only');
    const blocked = blockedStatusTargetsFromContent(entries);
    expect([...blocked]).toEqual(['obj_ash_ward']);
  });

  it('the derived configs run a real battle deterministically and apply the gates', () => {
    const { entries } = bossObjectEncounter();
    const bossObjects = bossObjectsFromContent(entries);
    const policies = bossObjectPoliciesFromContent(entries);
    const blocked = blockedStatusTargetsFromContent(entries);
    expect(blocked.has('obj_ash_ward')).toBe(true);

    function runOnce(): { state: BattleModel; events: readonly { type: string; targetIds: readonly string[]; payload: Record<string, number> }[] } {
      const player = migrateEntity({ entity: entity('unit_p', { side: 'player', lane: 'middle', x100: 1800, maxLp: 1000, lp: 1000 }), radiusX100: 100 });
      const boss = migrateEntity({ entity: entity('boss_ash_unit', { side: 'enemy', lane: 'middle', x100: 7000, maxLp: 3000, lp: 3000 }), radiusX100: 120 });
      // Pre-seed the placed bodies + registry entries so the stage-I
      // applications on tick 0 find their targets (the placement system is
      // idempotent and keeps the same config).
      const tempEntities = bossObjects.map((b, i) => buildBossObject(b.spec, b.entityId, b.side, b.ownerId, b.sourceId, 0, i));
      const bodies = bossObjects.map((b) => buildBossObjectBody(b, tick(0)));
      const state = battle({
        simulationVersion: 'phase21-fixture-v1',
        entities: Object.freeze([player, boss, ...bodies]),
        temporaryEntities: Object.freeze(tempEntities),
        bossPhase: Object.freeze({ entityId: 'boss_ash_unit', bossId: 'boss_ash', phaseId: 'p1', transition: null, visited: Object.freeze(['p1']), invulnerableUntilTick: null }),
        pendingCombatApplications: Object.freeze([
          Object.freeze({ kind: 'damage', sourceId: 'unit_p', targetId: 'obj_ash_core', effectId: 'ef_hit', attackInstanceId: 1, effectIndex: 0, rawAmount: 120, damageTypeOrdinal: 0, defense: 0, coverReductionBps: 0, bossCapBps: null }),
          Object.freeze({ kind: 'damage', sourceId: 'unit_p', targetId: 'obj_ash_ward', effectId: 'ef_hit', attackInstanceId: 2, effectIndex: 0, rawAmount: 120, damageTypeOrdinal: 0, defense: 0, coverReductionBps: 0, bossCapBps: null }),
        ]),
      });
      const systems = Object.freeze([
        ...createPhase17Systems({
          speedsX100PerSecond: {},
          bossObjectPolicies: policies,
        }),
        ...createPhase21Systems({ bossPhaseDefinitions: defs, bossObjects }),
      ]);
      const random = randomSession();
      let current = state;
      const events: { type: string; targetIds: readonly string[]; payload: Record<string, number> }[] = [];
      for (let i = 0; i < 3; i++) {
        const r = stepBattle({ state: current, input, random, rules: {}, content: {}, systems });
        current = r.state;
        events.push(...r.events);
      }
      return { state: current, events };
    }

    const a = runOnce();
    const b = runOnce();
    // Both objects were placed as real bodies.
    const core = a.state.entities.find((e) => e.id === 'obj_ash_core');
    const ward = a.state.entities.find((e) => e.id === 'obj_ash_ward');
    expect(core?.origin).toBe('boss_object');
    expect(ward?.origin).toBe('boss_object');
    // The content-derived policies gate the stage-I applications: the normal
    // object took 120 damage; the shield_only object kept full HP.
    const coreHit = a.events.find((e) => e.type === 'DamageApplied' && e.targetIds.includes('obj_ash_core'));
    const wardHit = a.events.find((e) => e.type === 'DamageApplied' && e.targetIds.includes('obj_ash_ward'));
    expect(coreHit?.payload['finalHpDelta']).toBe(120);
    expect(core?.lp).toBe(680);
    expect(wardHit?.payload['finalHpDelta']).toBe(0);
    expect(ward?.lp).toBe(600);
    // Determinism: identical snapshot and event stream.
    expect(createSnapshot(a.state).checksum).toBe(createSnapshot(b.state).checksum);
    expect(a.events.map((e) => `${e.type}:${String(e.payload['finalHpDelta'] ?? 0)}`)).toEqual(b.events.map((e) => `${e.type}:${String(e.payload['finalHpDelta'] ?? 0)}`));
  });
});
