import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { EncounterSourceSchema } from '../../content/schemas/index.js';
import { stepBattle } from '../../src/game/sim/core/battle-kernel.js';
import { createPhase17Systems } from '../../src/game/sim/core/phase17-systems.js';
import { createPhase21Systems } from '../../src/game/sim/core/phase21-systems.js';
import { createSnapshot } from '../../src/game/sim/snapshot/snapshot.js';
import { bossObjectsFromContent, bossObjectPoliciesFromContent, blockedStatusTargetsFromContent, type ContentBossObjectEntry } from '../../src/game/sim/boss/encounter-adapter.js';
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
