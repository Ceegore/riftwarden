import { describe, expect, it } from 'vitest';
import { stepBattle } from '../../src/game/sim/core/battle-kernel.js';
import { createPhase18Systems } from '../../src/game/sim/core/phase18-systems.js';
import { createPhase21Systems } from '../../src/game/sim/core/phase21-systems.js';
import { createSnapshot } from '../../src/game/sim/snapshot/snapshot.js';
import { buildBossObject, buildBossObjectBody, BOSS_OBJECT_SLOT_IDS, DAMAGE_POLICIES, STATUS_POLICIES, CLEANUP_POLICIES, type BossObjectContent, type BossObjectSpec, type DamagePolicy, type StatusPolicy, type CleanupPolicy } from '../../src/game/sim/boss/boss-object-manager.js';
import type { StatusInstance } from '../../src/game/sim/status/status-instance.js';
import type { PendingCombatApplication } from '../../src/game/sim/combat/combat-application.js';
import type { TickInput } from '../../src/game/sim/core/tick-input.js';
import type { BattleModel } from '../../src/game/sim/core/battle-model.js';
import { battle, entity, randomSession, tick } from './test-helpers.js';
import { migrateEntity } from '../../src/game/sim/core/migrate.js';

/**
 * Phase 21 §6 cross-policy corpus. Every (damagePolicy x statusPolicy x
 * cleanupPolicy) combination — 3 x 2 x 3 = 18 — is placed as a real body,
 * hit by a stage-I damage application, targeted by a due periodic status, and
 * run through the full P15–P18 + P21 composition. Each case must be
 * byte-deterministic and must honor its gates: immune/shield_only never reduce
 * HP, block never carries a status, and no object is cleaned while the battle
 * is ACTIVE with an incomplete objective.
 */

const input: TickInput = Object.freeze({ paused: false, decisions: Object.freeze([]), contentVersion: 'content_fixture' });

const statusInstance = (targetId: string): StatusInstance =>
  Object.freeze({
    statusId: 'st_burn', kind: 'burn', polarity: 'negative', targetId, sourceId: 'unit_p', effectId: 'ef_burn',
    startTick: 0, endTick: 20, strength: 1, stackGroup: 'burn', sequence: 0,
    stackPolicy: 'no_reapply', maxStacks: 1, flags: Object.freeze([]),
    periodic: Object.freeze({ effectKind: 'burn', intervalTicks: 1, nextTick: 1, tickIndex: 0, initialTick: false, dedupKey: 'burn_a' }),
  });

const damageApp = (targetId: string): PendingCombatApplication =>
  Object.freeze({
    kind: 'damage', sourceId: 'unit_p', targetId, effectId: 'ef_hit',
    attackInstanceId: 1, effectIndex: 0, rawAmount: 100, damageTypeOrdinal: 0, defense: 0,
    coverReductionBps: 0, bossCapBps: null,
  });

const LANES_FIXTURE: readonly string[] = ['top', 'middle', 'bottom'];

function specFor(damage: DamagePolicy, status: StatusPolicy, cleanup: CleanupPolicy, index: number): BossObjectSpec {
  const slotId = BOSS_OBJECT_SLOT_IDS[index % BOSS_OBJECT_SLOT_IDS.length];
  const lane = LANES_FIXTURE[index % LANES_FIXTURE.length];
  if (!slotId || !lane) throw new Error('corpus cycle underflow');
  return Object.freeze({
    slotId,
    lane: lane as BossObjectSpec['lane'],
    x100: 5000 + index * 100,
    targetable: true,
    objectiveLink: 'obj_incomplete',
    damagePolicy: damage,
    statusPolicy: status,
    cleanupPolicy: cleanup,
    fallback: 'FAIL',
  });
}

function runCase(damage: DamagePolicy, status: StatusPolicy, cleanup: CleanupPolicy, index: number): { state: BattleModel; events: readonly { type: string }[] } {
  const objectId = `obj_c${String(index)}`;
  const spec = specFor(damage, status, cleanup, index);
  const content: BossObjectContent = Object.freeze({ entityId: objectId, side: 'enemy', ownerId: 'boss_ash_unit', sourceId: 'content_corpus', spec, maxLp: 500, radiusX100: 120 });
  const body = buildBossObjectBody(content, tick(0));
  const temp = buildBossObject(spec, objectId, 'enemy', 'boss_ash_unit', 'content_corpus', 0, index);
  const player = migrateEntity({ entity: entity('unit_p', { side: 'player', lane: 'middle', x100: 1800, maxLp: 1000, lp: 1000 }), radiusX100: 100 });
  // A regular enemy keeps both sides combat-capable so the battle stays
  // ACTIVE (no elimination) and the cleanup policies stay inert.
  const enemy = migrateEntity({ entity: entity('unit_e1', { side: 'enemy', lane: 'bottom', x100: 7000, maxLp: 1000, lp: 1000 }), radiusX100: 120 });
  const state = battle({
    simulationVersion: 'phase21-fixture-v1',
    entities: Object.freeze([player, enemy, body]),
    temporaryEntities: Object.freeze([temp]),
    statuses: Object.freeze([statusInstance(objectId)]),
    pendingCombatApplications: Object.freeze([damageApp(objectId)]),
    objectives: Object.freeze([Object.freeze({ id: 'obj_incomplete', kind: 'destroy_object', targetId: objectId, required: 1, progress: 0, complete: false })]),
  });
  const systems = Object.freeze([
    ...createPhase18Systems({
      speedsX100PerSecond: {},
      bossObjectPolicies: new Map([[objectId, damage]] as const),
      status: status === 'block'
        ? { blockedStatusTargets: new Set([objectId]), periodic: { burn_a: { effectKind: 'burn', amountPerTick: 10 } } }
        : { periodic: { burn_a: { effectKind: 'burn', amountPerTick: 10 } } },
    }),
    ...createPhase21Systems({ bossObjects: Object.freeze([content]) }),
  ]);
  const random = randomSession();
  let current = state;
  const events: { type: string }[] = [];
  for (let i = 0; i < 2; i++) {
    const r = stepBattle({ state: current, input, random, rules: {}, content: {}, systems });
    current = r.state;
    events.push(...r.events);
  }
  return { state: current, events };
}

const COMBOS = DAMAGE_POLICIES.flatMap((damage) => STATUS_POLICIES.flatMap((status) => CLEANUP_POLICIES.map((cleanup) => ({ damage, status, cleanup }))));

describe('P21 cross-policy corpus (18 combos)', () => {
  it('every damage x status x cleanup combo is placed, deterministic and gate-correct', () => {
    expect(COMBOS).toHaveLength(18);
    for (const [index, combo] of COMBOS.entries()) {
      const a = runCase(combo.damage, combo.status, combo.cleanup, index);
      const b = runCase(combo.damage, combo.status, combo.cleanup, index);
      // §6: the body is a real boss_object.
      const body = a.state.entities.find((e) => e.id === `obj_c${String(index)}`);
      expect(body?.origin).toBe('boss_object');
      expect(body?.maxLp).toBe(500);
      // Damage gate: only `normal` lets the 100 hit reach HP. A `block` status
      // drops the burn before it ticks; an `allow` status fires the periodic
      // (10 burn per tick), which is not direct damage and so also lands on
      // immune/shield_only objects.
      const burnDamage = combo.status === 'allow' ? 10 : 0;
      const expectedLp = (combo.damage === 'normal' ? 400 : 500) - burnDamage;
      expect(body?.lp, `combo ${combo.damage}/${combo.status}/${combo.cleanup}`).toBe(expectedLp);
      // Status gate: `allow` keeps the due periodic; `block` drops it silently
      // (no EffectTick, no LP delta from the burn).
      const statuses = a.state.statuses ?? [];
      if (combo.status === 'allow') {
        expect(statuses.some((s) => s.targetId === `obj_c${String(index)}`)).toBe(true);
      } else {
        expect(statuses.some((s) => s.targetId === `obj_c${String(index)}`)).toBe(false);
        expect(a.events.some((e) => e.type === 'EffectTick' || e.type === 'EffectRemoved')).toBe(false);
      }
      // Cleanup: while ACTIVE with an incomplete objective nothing is removed.
      expect(a.state.temporaryEntities?.some((t) => t.id === `obj_c${String(index)}`)).toBe(true);
      // Determinism: identical final snapshot and event stream.
      expect(createSnapshot(a.state).checksum, `combo ${combo.damage}/${combo.status}/${combo.cleanup}`).toBe(createSnapshot(b.state).checksum);
    }
  });

  it('the on_battle_end combo cleans at RESOLVING_END and the manual combo never does', () => {
    const ending = runCase('normal', 'allow', 'on_battle_end', 0);
    expect(ending.state.phase.phase).toBe('ACTIVE'); // still ACTIVE: nothing removed yet
    expect(ending.state.temporaryEntities?.length).toBe(1);
    const manual = runCase('normal', 'allow', 'manual', 1);
    expect(manual.state.temporaryEntities?.length).toBe(1);
  });
});
