import { describe, expect, it } from 'vitest';
import { stepBattle } from '../../src/game/sim/core/battle-kernel.js';
import { createPhase18Systems } from '../../src/game/sim/core/phase18-systems.js';
import { buildBossObjectBody, type BossObjectContent, type BossObjectSpec } from '../../src/game/sim/boss/boss-object-manager.js';
import type { PendingCombatApplication } from '../../src/game/sim/combat/combat-application.js';
import type { StatusInstance } from '../../src/game/sim/status/status-instance.js';
import type { BattleModel } from '../../src/game/sim/core/battle-model.js';
import type { TickInput } from '../../src/game/sim/core/tick-input.js';
import { createSnapshot } from '../../src/game/sim/snapshot/snapshot.js';
import { battle, entity, randomSession, tick } from './test-helpers.js';
import { migrateEntity } from '../../src/game/sim/core/migrate.js';

/**
 * §6 boss-object damage/status policies (P21-T03). A placed boss object is a
 * real targetable kernel body; its `damagePolicy` (normal/immune/shield_only)
 * gates how damage lands and its `statusPolicy` (allow/block) gates whether
 * statuses can ever target it. These tests pin the gates through the real
 * stage-I combat application and the stage-I status system.
 */

const input: TickInput = Object.freeze({ paused: false, decisions: Object.freeze([]), contentVersion: 'content_fixture' });

const spec = (extra: Partial<BossObjectSpec> = {}): BossObjectSpec =>
  Object.freeze({ slotId: 'boss_slot_0', lane: 'middle', x100: 5000, targetable: true, objectiveLink: null, damagePolicy: 'normal', statusPolicy: 'allow', cleanupPolicy: 'on_objective', fallback: 'FAIL', ...extra });

const content = (entityId: string, extra: Partial<BossObjectContent> = {}): BossObjectContent =>
  Object.freeze({ entityId, side: 'enemy', ownerId: 'boss_ash_unit', sourceId: 'content_boss', spec: spec(), maxLp: 1000, radiusX100: 120, ...extra });

const damageApp = (targetId: string, rawAmount: number): PendingCombatApplication =>
  Object.freeze({
    kind: 'damage', sourceId: 'unit_p', targetId, effectId: 'ef_hit',
    attackInstanceId: 1, effectIndex: 0, rawAmount, damageTypeOrdinal: 0, defense: 0,
    coverReductionBps: 0, bossCapBps: null,
  });

const shieldApp = (targetId: string, rawAmount: number, sequence: number): PendingCombatApplication =>
  Object.freeze({
    kind: 'shield', sourceId: 'unit_p', targetId, effectId: 'ef_shield',
    attackInstanceId: 1, effectIndex: 1, rawAmount, expiryTick: 999, priority: 0, applicationSequence: sequence,
  });

const statusInstance = (targetId: string, extra: Partial<StatusInstance> = {}): StatusInstance =>
  Object.freeze({
    statusId: 'st_burn', kind: 'burn', polarity: 'negative', targetId, sourceId: 'unit_p', effectId: 'ef_burn',
    startTick: 0, endTick: 20, strength: 1, stackGroup: 'burn', sequence: 0,
    stackPolicy: 'no_reapply', maxStacks: 1, flags: Object.freeze([]),
    periodic: Object.freeze({ effectKind: 'burn', intervalTicks: 1, nextTick: 1, tickIndex: 0, initialTick: false, dedupKey: 'burn_a' }),
    ...extra,
  });

function baseState(objectId: string, overrides: Partial<BattleModel> = {}): BattleModel {
  const player = migrateEntity({ entity: entity('unit_p', { side: 'player', lane: 'middle', x100: 1800, maxLp: 1000, lp: 1000 }), radiusX100: 100 });
  const body = buildBossObjectBody(content(objectId), tick(0));
  return battle({
    simulationVersion: 'phase21-fixture-v1',
    entities: Object.freeze([player, body]),
    globalNoProgressTicks: 50,
    riftCollapseTicks: 5,
    ...overrides,
  });
}

function runOnce(state: BattleModel, cfg: Omit<Parameters<typeof createPhase18Systems>[0], 'speedsX100PerSecond'>): { state: BattleModel; events: readonly { type: string; targetIds: readonly string[]; payload: Record<string, number> }[] } {
  const random = randomSession();
  const systems = createPhase18Systems({ speedsX100PerSecond: {}, ...cfg });
  const r = stepBattle({ state, input, random, rules: {}, content: {}, systems });
  return { state: r.state, events: r.events };
}

describe('P21 boss-object damage policies (§6)', () => {
  it('normal policy: damage reaches HP, qualifies as §9.4 progress', () => {
    const state = baseState('obj_core', { pendingCombatApplications: Object.freeze([damageApp('obj_core', 100)]) });
    const r = runOnce(state, { bossObjectPolicies: new Map([['obj_core', 'normal'] as const]) });
    const obj = r.state.entities.find((e) => e.id === 'obj_core');
    expect(obj?.lp).toBe(900);
    // Damage that reached HP reset the endcap counters.
    expect(r.state.globalNoProgressTicks).toBe(0);
    expect(r.state.riftCollapseTicks).toBe(0);
    const hit = r.events.find((e) => e.type === 'DamageApplied');
    expect(hit?.payload['finalHpDelta']).toBe(100);
  });

  it('immune policy: the whole hit is negated before shields; no progress signal', () => {
    const state = baseState('obj_core', { pendingCombatApplications: Object.freeze([damageApp('obj_core', 100)]) });
    const r = runOnce(state, { bossObjectPolicies: new Map([['obj_core', 'immune'] as const]) });
    const obj = r.state.entities.find((e) => e.id === 'obj_core');
    expect(obj?.lp).toBe(1000);
    // The min/null rule would force 1 damage on a normal target; immune zeroes it.
    const hit = r.events.find((e) => e.type === 'DamageApplied');
    expect(hit?.payload['preShieldAmount']).toBe(0);
    expect(hit?.payload['finalHpDelta']).toBe(0);
    // No qualifying progress: the endcap counter only took its natural
    // +1 per-tick increment (stage F) and was never reset.
    expect(r.state.globalNoProgressTicks).toBe(51);
    expect(r.state.riftCollapseTicks).toBe(5);
  });

  it('shield_only policy: shields absorb, but HP is never reduced', () => {
    const state = baseState('obj_core', {
      pendingCombatApplications: Object.freeze([
        shieldApp('obj_core', 300, 0),
        damageApp('obj_core', 100),
      ]),
    });
    const r = runOnce(state, { bossObjectPolicies: new Map([['obj_core', 'shield_only'] as const]) });
    const obj = r.state.entities.find((e) => e.id === 'obj_core');
    // The shield absorbed the 100 hit; the object HP never moved.
    expect(obj?.lp).toBe(1000);
    expect(obj?.shields?.length ?? 0).toBe(1);
    const shields = obj?.shields ?? [];
    expect(shields.reduce((sum, s) => sum + s.remaining, 0)).toBe(200);
    const hit = r.events.find((e) => e.type === 'DamageApplied');
    expect(hit?.payload['absorbedShield']).toBe(100);
    expect(hit?.payload['finalHpDelta']).toBe(0);
    // Shield absorption alone is not §9.4 qualifying progress: the counter
    // only took its natural +1 increment.
    expect(r.state.globalNoProgressTicks).toBe(51);
  });

  it('shield_only policy without shields: the overflow is discarded, HP stays full', () => {
    const state = baseState('obj_core', { pendingCombatApplications: Object.freeze([damageApp('obj_core', 100)]) });
    const r = runOnce(state, { bossObjectPolicies: new Map([['obj_core', 'shield_only'] as const]) });
    const obj = r.state.entities.find((e) => e.id === 'obj_core');
    expect(obj?.lp).toBe(1000);
    const hit = r.events.find((e) => e.type === 'DamageApplied');
    expect(hit?.payload['preShieldAmount']).toBe(100);
    expect(hit?.payload['finalHpDelta']).toBe(0);
    expect(r.state.globalNoProgressTicks).toBe(51);
  });

  it('policies are per-entity: an ordinary entity still takes full damage', () => {
    const body = buildBossObjectBody(content('obj_core'), tick(0));
    const ordinary = migrateEntity({ entity: entity('unit_e1', { side: 'enemy', lane: 'middle', x100: 6000, maxLp: 1000, lp: 1000 }), radiusX100: 120 });
    const player = migrateEntity({ entity: entity('unit_p', { side: 'player', lane: 'middle', x100: 1800, maxLp: 1000, lp: 1000 }), radiusX100: 100 });
    const state = battle({
      simulationVersion: 'phase21-fixture-v1',
      entities: Object.freeze([player, ordinary, body]),
      globalNoProgressTicks: 50,
      riftCollapseTicks: 5,
      pendingCombatApplications: Object.freeze([
        damageApp('obj_core', 100),
        damageApp('unit_e1', 100),
      ]),
    });
    const r = runOnce(state, { bossObjectPolicies: new Map([['obj_core', 'immune'] as const]) });
    const obj = r.state.entities.find((e) => e.id === 'obj_core');
    const unit = r.state.entities.find((e) => e.id === 'unit_e1');
    expect(obj?.lp).toBe(1000);   // immune object untouched
    expect(unit?.lp).toBe(900);   // ordinary unit took the full hit
  });
});

describe('P21 boss-object status policies (§6)', () => {
  const blocked = new Set(['obj_core']);

  it('block policy: a status targeting the object never lands, never ticks, never emits', () => {
    const state = baseState('obj_core', { statuses: Object.freeze([statusInstance('obj_core')]) });
    const r = runOnce(state, { status: { blockedStatusTargets: blocked, periodic: { burn_a: { effectKind: 'burn', amountPerTick: 10 } } } });
    expect(r.state.statuses).toEqual([]);
    // The due periodic never fired: no EffectTick, no EffectRemoved, no LP delta.
    expect(r.events.some((e) => e.type === 'EffectTick' || e.type === 'EffectRemoved')).toBe(false);
    const obj = r.state.entities.find((e) => e.id === 'obj_core');
    expect(obj?.lp).toBe(1000);
  });

  it('block policy is per-entity: statuses on other entities are untouched', () => {
    const state = baseState('obj_core', {
      statuses: Object.freeze([statusInstance('unit_e1'), statusInstance('obj_core')]),
      entities: Object.freeze([
        migrateEntity({ entity: entity('unit_p', { side: 'player', lane: 'middle', x100: 1800, maxLp: 1000, lp: 1000 }), radiusX100: 100 }),
        buildBossObjectBody(content('obj_core'), tick(0)),
        migrateEntity({ entity: entity('unit_e1', { side: 'enemy', lane: 'middle', x100: 6000, maxLp: 1000, lp: 1000 }), radiusX100: 120 }),
      ]),
    });
    const r = runOnce(state, { status: { blockedStatusTargets: blocked } });
    const ids = (r.state.statuses ?? []).map((s) => s.targetId);
    expect(ids).toEqual(['unit_e1']);
  });

  it('allow policy: the status lands and persists normally', () => {
    const state = baseState('obj_core', { statuses: Object.freeze([statusInstance('obj_core')]) });
    const r = runOnce(state, { status: {} });
    expect(r.state.statuses?.map((s) => s.targetId)).toEqual(['obj_core']);
  });

  it('is byte-deterministic with both gates wired', () => {
    const a = runOnce(baseState('obj_core', { statuses: Object.freeze([statusInstance('obj_core')]) }), { bossObjectPolicies: new Map([['obj_core', 'shield_only'] as const]), status: { blockedStatusTargets: blocked } });
    const b = runOnce(baseState('obj_core', { statuses: Object.freeze([statusInstance('obj_core')]) }), { bossObjectPolicies: new Map([['obj_core', 'shield_only'] as const]), status: { blockedStatusTargets: blocked } });
    expect(createSnapshot(a.state).checksum).toBe(createSnapshot(b.state).checksum);
  });
});

describe('P21 boss-object body targeting surface', () => {
  it('the placed body carries the full Phase-15 surface with origin boss_object', () => {
    const body = buildBossObjectBody(content('obj_core'), tick(0));
    expect(body.origin).toBe('boss_object');
    expect(body.maxLp).toBe(1000);
    expect(body.lp).toBe(1000);
    expect(body.radiusX100).toBe(120);
    expect(body.lane).toBe('middle');
    expect(body.x100).toBe(5000);
    expect(body.phase.phase).toBe('ACTIVE');
    expect(body.phase.enteredTick).toBe(tick(0));
  });
});
