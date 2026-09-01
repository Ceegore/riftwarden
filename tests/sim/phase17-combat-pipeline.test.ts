import { describe, expect, it } from 'vitest';
import { applyDamagePipeline, applyHealPipeline, DAMAGE_TYPE_PHYSICAL, DAMAGE_TYPE_MAGICAL, DAMAGE_TYPE_PURE, BOSS_HIT_CAP_BPS } from '../../src/game/sim/combat/combat-application.js';
import { aggregateShields, consumeShields, expireShields } from '../../src/game/sim/combat/shield-ledger.js';
import { entity } from './test-helpers.js';
import type { KernelEntity } from '../../src/game/sim/core/entity.js';
import type { PendingCombatApplication } from '../../src/game/sim/combat/combat-application.js';
import type { ShieldSource } from '../../src/game/sim/combat/shield-ledger.js';

function target(overrides: Partial<KernelEntity> = {}): KernelEntity {
  return entity('unit_target', { maxLp: 1000, lp: 1000, x100: 2000, ...overrides });
}

function damage(rawAmount: number, extra: Partial<Extract<PendingCombatApplication, { kind: 'damage' }>> = {}): Extract<PendingCombatApplication, { kind: 'damage' }> {
  return Object.freeze({
    kind: 'damage',
    sourceId: 'unit_attacker',
    targetId: 'unit_target',
    effectId: 'effect_damage',
    attackInstanceId: 1,
    effectIndex: 0,
    rawAmount,
    damageTypeOrdinal: DAMAGE_TYPE_PHYSICAL,
    defense: 0,
    coverReductionBps: 0,
    bossCapBps: null,
    ...extra,
  });
}

function shield(shieldId: string, remaining: number, priority = 0, applicationSequence = 1): ShieldSource {
  return Object.freeze({ shieldId, sourceId: 'unit_granter', effectId: 'effect_shield', remaining, expiryTick: 0, priority, applicationSequence });
}

describe('P17 T04 §8.1 integer damage pipeline', () => {
  it('physical damage mitigates via defense with round-half-away-from-zero', () => {
    const t = target({ lp: 1000 });
    // raw 100, defense 100 → 100*100/200 = 50.
    const { outcome } = applyDamagePipeline(t, [], damage(100, { defense: 100 }));
    expect(outcome.effectiveDefense).toBe(100);
    expect(outcome.finalHpDelta).toBe(50);
    expect(outcome.hpAfter).toBe(950);
  });

  it('clamps defense to [-40, 200]', () => {
    const t = target({ lp: 1000 });
    const low = applyDamagePipeline(t, [], damage(100, { defense: -500 }));
    expect(low.outcome.effectiveDefense).toBe(-40);
    // 100 * 100 / 60 = 166.67 → round half away = 167.
    expect(low.outcome.finalHpDelta).toBe(167);
    const high = applyDamagePipeline(t, [], damage(100, { defense: 5000 }));
    expect(high.outcome.effectiveDefense).toBe(200);
    // 100 * 100 / 300 = 33.33 → 33.
    expect(high.outcome.finalHpDelta).toBe(33);
  });

  it('pure damage ignores defense but is capped against bosses', () => {
    const t = target({ lp: 1000 });
    const pure = applyDamagePipeline(t, [], damage(100, { damageTypeOrdinal: DAMAGE_TYPE_PURE, defense: 5000 }));
    expect(pure.outcome.finalHpDelta).toBe(100);
    const boss = applyDamagePipeline(t, [], damage(100, { damageTypeOrdinal: DAMAGE_TYPE_PURE, bossCapBps: BOSS_HIT_CAP_BPS }));
    // 18% of 1000 = 180, raw 100 < cap → unchanged.
    expect(boss.outcome.finalHpDelta).toBe(100);
    const bossBig = applyDamagePipeline(target({ lp: 1000 }), [], damage(10000, { damageTypeOrdinal: DAMAGE_TYPE_PURE, bossCapBps: BOSS_HIT_CAP_BPS }));
    expect(bossBig.outcome.finalHpDelta).toBe(180);
  });

  it('a successful non-negated attack deals at least 1 damage', () => {
    const t = target({ lp: 1000 });
    // Raw 1 with enormous defense would collapse to 0; the min rule floors it at 1.
    const tiny = applyDamagePipeline(t, [], damage(1, { defense: 10000 }));
    expect(tiny.outcome.finalHpDelta).toBe(1);
    // Raw 0 stays 0.
    const zero = applyDamagePipeline(t, [], damage(0));
    expect(zero.outcome.finalHpDelta).toBe(0);
  });

  it('negative end values are clamped to 0 (never negative HP)', () => {
    const t = target({ lp: 30 });
    const overkill = applyDamagePipeline(t, [], damage(1000));
    expect(overkill.outcome.finalHpDelta).toBe(30);
    expect(overkill.outcome.hpAfter).toBe(0);
  });

  it('cover reduction applies as basis points (12% projectile default)', () => {
    const t = target({ lp: 1000 });
    const covered = applyDamagePipeline(t, [], damage(100, { coverReductionBps: 1200 }));
    // 100 * 8800/10000 = 88.
    expect(covered.outcome.finalHpDelta).toBe(88);
  });

  it('applies damage steps in §8.1 order (defense then cap then cover)', () => {
    const t = target({ lp: 1000 });
    const result = applyDamagePipeline(t, [], damage(1000, { defense: 100, bossCapBps: BOSS_HIT_CAP_BPS, coverReductionBps: 1200 }));
    // defense: 1000*100/200 = 500; boss cap 180 → 180; cover 180*0.88 = 158.4 → 158.
    expect(result.outcome.finalHpDelta).toBe(158);
  });
});

describe('P17 T04 §8.2 shield ledger', () => {
  it('consumes highest priority first, then oldest application', () => {
    const shields = [shield('s_low_old', 100, 0, 1), shield('s_high_new', 50, 10, 5), shield('s_low_new', 200, 0, 9)];
    const { sources, consumption } = consumeShields(shields, 130);
    expect(consumption.absorbed).toBe(130);
    // s_high_new (priority 10) fully consumed; s_low_old (oldest) partially consumed.
    expect(consumption.perSource.map((d) => d.shieldId)).toEqual(['s_high_new', 's_low_old']);
    const remaining = aggregateShields(sources);
    expect(remaining).toBe(220); // 200 + 20 (s_low_old left 20, s_low_new untouched)
  });

  it('never produces negative values and leaves untouched shields alone', () => {
    const shields = [shield('s_a', 40)];
    const { sources, consumption } = consumeShields(shields, 100);
    expect(consumption.absorbed).toBe(40);
    expect(aggregateShields(sources)).toBe(0);
  });

  it('expires shields at the tick anchor and keeps future shields', () => {
    const future = shield('s_future', 50, 0, 2);
    const expiredFuture = Object.freeze({ ...future, expiryTick: 100 }) as ShieldSource;
    const { sources, expired } = expireShields([shield('s_old', 50, 0, 1), expiredFuture], 100);
    expect(expired.map((s) => s.shieldId)).toEqual(['s_future']);
    expect(sources.map((s) => s.shieldId)).toEqual(['s_old']);
  });
});

describe('P17 T04 §8.3 heal', () => {
  it('heals up to max LP and drops overheal', () => {
    const t = target({ lp: 900 });
    const outcome = applyHealPipeline(t, Object.freeze({ kind: 'heal', sourceId: 'unit_healer', targetId: 'unit_target', effectId: 'effect_heal', attackInstanceId: 1, effectIndex: 0, rawAmount: 500, healFactorBps: 10000 }));
    expect(outcome.finalHpDelta).toBe(100);
    expect(outcome.hpAfter).toBe(1000);
  });

  it('halves heal during collapse via the factor', () => {
    const t = target({ lp: 0 });
    const outcome = applyHealPipeline(t, Object.freeze({ kind: 'heal', sourceId: 'unit_healer', targetId: 'unit_target', effectId: 'effect_heal', attackInstanceId: 1, effectIndex: 0, rawAmount: 100, healFactorBps: 5000 }));
    expect(outcome.finalHpDelta).toBe(50);
  });
});

describe('P17 T04 magical damage uses the same defense step', () => {
  it('magical mitigates like physical', () => {
    const t = target({ lp: 1000 });
    const { outcome } = applyDamagePipeline(t, [], damage(100, { damageTypeOrdinal: DAMAGE_TYPE_MAGICAL, defense: 100 }));
    expect(outcome.finalHpDelta).toBe(50);
  });
});
