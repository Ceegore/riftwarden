import { describe, expect, it } from 'vitest';
import { stepBattle } from '../../src/game/sim/core/battle-kernel.js';
import { migrateEntity } from '../../src/game/sim/core/migrate.js';
import { createPhase17Systems } from '../../src/game/sim/core/phase17-systems.js';
import { createPhase21Systems } from '../../src/game/sim/core/phase21-systems.js';
import { createSnapshot } from '../../src/game/sim/snapshot/snapshot.js';
import { buildBossObject, buildBossObjectBody, type BossObjectContent, type DamagePolicy } from '../../src/game/sim/boss/boss-object-manager.js';
import { asX100 } from '../../src/game/sim/geometry/x100.js';
import type { KernelSystem } from '../../src/game/sim/core/tick-context.js';
import type { TickInput } from '../../src/game/sim/core/tick-input.js';
import type { BattleModel } from '../../src/game/sim/core/battle-model.js';
import type { ModifierDefinition } from '../../src/game/sim/world/modifier-system.js';
import { battle, entity, randomSession, tick } from './test-helpers.js';

/**
 * Phase 21 §6/§7 boss-object × lifesteal INTERPLAY.
 *
 * Lifesteal (`on_damage_applied` `heal_bps`) queues a heal on the ATTACKER for
 * every queued damage application — but only when that hit will actually land:
 * the modifier runtime gates on the SAME §6 hit-negation rules the stage-I
 * pipeline applies. Contract:
 *   1. SHIELD_ONLY PROCS — a hit on a `shield_only` boss object is a real hit
 *      (shields absorb); the attacker still lifesteals from it.
 *   2. IMMUNE IS GATED — a hit on an `immune` boss object deals nothing; the
 *      attacker's lifesteal queue yields NO heal for that target.
 *   3. HEALS NEVER TOUCH OBJECT HP — a heal always targets its SOURCE (the
 *      attacker), never the object body; the object's LP never rises.
 *   4. OBJECT HP RIGID — shield_only and immune objects both keep their LP
 *      exactly (0 HP delta); the immune object's hits land with a 0 delta.
 *   5. DETERMINISM — two runs give the identical checksum + heal trace.
 */

const input: TickInput = Object.freeze({ paused: false, decisions: Object.freeze([]), contentVersion: 'content_fixture' });

const LIFESTEAL: ModifierDefinition = Object.freeze({
  id: 'mod_fixture_lifesteal',
  previewKey: 'preview_mod_fixture_lifesteal',
  hooks: Object.freeze(['on_damage_applied'] as const),
  incompatibilityTags: Object.freeze([]),
  params: Object.freeze({ heal_bps: 5000 }),
});

const SHIELD_OBJ = 'obj_shield';
const IMMUNE_OBJ = 'obj_immune';

function objectContent(entityId: string, damagePolicy: DamagePolicy, slotId: 'boss_slot_0' | 'boss_slot_1'): BossObjectContent {
  return Object.freeze({
    entityId,
    side: 'enemy',
    ownerId: 'enemy_owner',
    sourceId: 'content',
    spec: Object.freeze({
      slotId,
      lane: 'middle',
      x100: 6200,
      targetable: true,
      objectiveLink: null,
      damagePolicy,
      statusPolicy: 'allow',
      cleanupPolicy: 'manual',
      fallback: 'FAIL',
    }),
    maxLp: 800,
    radiusX100: 120,
  });
}
const shieldObject = objectContent(SHIELD_OBJ, 'shield_only', 'boss_slot_0');
const immuneObject = objectContent(IMMUNE_OBJ, 'immune', 'boss_slot_1');

const mk = (id: string, side: 'player' | 'enemy', maxLp: number, lp: number, x100: number) =>
  migrateEntity({ entity: entity(id, { side, lane: 'middle', x100, maxLp, lp }), radiusX100: 100 });

const attack = (rawAmount: number) => Object.freeze({
  attackIntervalTicks: 10,
  prepareTicks: 1,
  recoveryTicks: 3,
  preferredRangeX100: asX100(9000),
  delivery: Object.freeze({ kind: 'direct', rawAmount, damageTypeOrdinal: 0, defense: 0, bossCapBps: null }),
});

interface HealObs {
  readonly tick: number;
  readonly targetId: string;
  readonly rawAmount: number;
  readonly delta: number;
}
interface RunResult {
  readonly state: BattleModel;
  readonly heals: readonly HealObs[];
  readonly immuneHits: number;
  readonly shieldHits: number;
  readonly checksum: string;
}

function run(): RunResult {
  // Two attackers with room: unit_p fires on the shield_only object, unit_p2 on
  // the immune object. Geometric separation avoids a shared-target shuffle.
  const attacker1 = mk('unit_p', 'player', 5000, 2500, 1800);
  const attacker2 = mk('unit_p2', 'player', 5000, 2500, 2400);
  const shieldBody = buildBossObjectBody(shieldObject, tick(0));
  const immuneBody = buildBossObjectBody(immuneObject, tick(0));
  const shieldTemp = buildBossObject(shieldObject.spec, shieldObject.entityId, shieldObject.side, shieldObject.ownerId, shieldObject.sourceId, 0, 0);
  const immuneTemp = buildBossObject(immuneObject.spec, immuneObject.entityId, immuneObject.side, immuneObject.ownerId, immuneObject.sourceId, 0, 1);
  const bossObjectPolicies = new Map<string, DamagePolicy>([[SHIELD_OBJ, 'shield_only'], [IMMUNE_OBJ, 'immune']]);
  const systems: readonly KernelSystem[] = Object.freeze([
    ...createPhase17Systems({
      speedsX100PerSecond: {},
      bossObjectPolicies,
      targeting: { focusTargetId: { unit_p: SHIELD_OBJ, unit_p2: IMMUNE_OBJ } },
      basicAttack: { parameters: { unit_p: attack(300), unit_p2: attack(300) } },
    }),
    ...createPhase21Systems({ bossObjects: [shieldObject, immuneObject], modifiers: [LIFESTEAL] }),
  ]);
  let state: BattleModel = battle({
    simulationVersion: 'phase21-lifesteal-object-race-v1',
    tick: tick(0),
    entities: Object.freeze([attacker1, attacker2, shieldBody, immuneBody]),
    temporaryEntities: Object.freeze([shieldTemp, immuneTemp]),
    abilities: Object.freeze([]),
  });
  const random = randomSession();
  const heals: HealObs[] = [];
  const immuneHits = [];
  const shieldHits = [];
  for (let t = 0; t < 160 && !['VICTORY', 'DEFEAT', 'DRAW_ABORT'].includes(state.phase.phase); t++) {
    const r = stepBattle({ state, input, random, rules: {}, content: {}, systems });
    state = r.state;
    for (const event of r.events) {
      if (event.type === 'HealApplied' && event.targetIds.length === 1) {
        heals.push(Object.freeze({
          tick: state.tick,
          targetId: event.targetIds[0] as string,
          rawAmount: event.payload['rawAmount'] ?? 0,
          delta: event.payload['finalHpDelta'] ?? 0,
        }));
      }
      if (event.type === 'DamageApplied' && event.targetIds.length === 1) {
        const target = event.targetIds[0] as string;
        if (target === IMMUNE_OBJ) immuneHits.push(event.payload['finalHpDelta'] ?? 0);
        if (target === SHIELD_OBJ) shieldHits.push(event.payload['finalHpDelta'] ?? 0);
      }
    }
  }
  return {
    state,
    heals: Object.freeze(heals),
    immuneHits: immuneHits.length,
    shieldHits: shieldHits.length,
    checksum: createSnapshot(state).checksum,
  };
}

describe('P21 §6/§7 boss-object × lifesteal interplay', () => {
  it('the attacker lifesteals from shield_only hits but never from immune hits, and heals never touch object HP', { timeout: 120_000 }, () => {
    const a = run();
    const b = run();
    // 5. DETERMINISM.
    expect(b.checksum).toBe(a.checksum);
    expect(b.heals).toEqual(a.heals);

    // The attackers were actually fighting BOTH objects (audible fight: the
    // immune object was hit — with a 0 delta — the shield_only object with real
    // absorbs).
    expect(a.immuneHits).toBeGreaterThan(0);
    expect(a.shieldHits).toBeGreaterThan(0);

    // 1. SHIELD_ONLY PROCS: unit_p (hitting obj_shield) self-heals 300×5000/10000 = 150.
    const shieldHeals = a.heals.filter((h) => h.targetId === 'unit_p');
    expect(shieldHeals.length).toBeGreaterThan(0);
    expect(shieldHeals[0]).toMatchObject({ targetId: 'unit_p', rawAmount: 150, delta: 150 });
    // 2. IMMUNE IS GATED: unit_p2 (hitting obj_immune) never heals, even though
    //    it is actively attacking and has room.
    expect(a.heals.some((h) => h.targetId === 'unit_p2')).toBe(false);

    // 3. HEALS NEVER TOUCH OBJECT HP: no HealApplied targets either object.
    expect(a.heals.some((h) => h.targetId === SHIELD_OBJ || h.targetId === IMMUNE_OBJ)).toBe(false);
    // 4. OBJECT HP RIGID: both objects keep their 800 LP (shield_only never
    //    reduces object HP; immune negates the whole hit).
    const shield = a.state.entities.find((e) => e.id === SHIELD_OBJ);
    const immune = a.state.entities.find((e) => e.id === IMMUNE_OBJ);
    expect(shield?.lp).toBe(800);
    expect(immune?.lp).toBe(800);

    // The lifesteal modifier fired its on_damage_applied hook.
    expect((a.state.modifierHookLog ?? []).some((f) => f.modifierId === 'mod_fixture_lifesteal' && f.hook === 'on_damage_applied')).toBe(true);
  });
});
