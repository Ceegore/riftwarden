/**
 * Phase 21 §10 soft-limit PRECEDENCE. The content `softLimitSeconds` override
 * must always WIN over the battle-class default (2700 normal/elite, 3600 boss):
 * an override opens the collapse window at its tick even on a boss battle, and
 * a boss battle with NO override still gets the boss default. This pins the
 * precedence at three authorities:
 *
 *   1. `softLimitTicks(config)` — the pure resolver decision: override first,
 *      then boss default, then normal default.
 *   2. `resolveBattleEnd` — the override drives the collapse-window branch at
 *      the exact override tick (a boss config keeps the window closed there and
 *      only `collapse_damage` fires strictly inside the window).
 *   3. `buildEncounterLaunchConfig` — the ADAPTER maps the encounter's
 *      `softLimitSeconds` into the override ticks the resolver consumes.
 */
import { describe, expect, it } from 'vitest';
import type { KernelEntity } from '../../src/game/sim/core/entity.js';
import {
  COLLAPSE_WINDOW_TICKS,
  SOFT_LIMIT_BOSS_TICKS,
  SOFT_LIMIT_NORMAL_TICKS,
  resolveBattleEnd,
  softLimitTicks,
} from '../../src/game/sim/combat/battle-end-resolver.js';
import { buildEncounterLaunchConfig, type EncounterObjectiveSource } from '../../src/game/sim/boss/encounter-adapter.js';
import { numberSecondsToTicks } from '../../src/game/sim/math/time-and-speed.js';

/** A combat-capable regular entity (only the fields the resolver reads are set meaningfully). */
function regular(id: string, side: 'player' | 'enemy'): KernelEntity {
  return Object.freeze({
    id,
    side,
    phase: Object.freeze({ phase: 'ACTIVE', enteredTick: 0, controlledReturn: null }),
    maxLp: 1000,
    lp: 1000,
    shield: 0,
    lane: 'middle',
    x100: 5000,
    targetId: null,
    timers: Object.freeze({}),
    origin: 'regular',
  }) as unknown as KernelEntity;
}

const BOTH_ALIVE = Object.freeze([regular('p', 'player'), regular('e', 'enemy')]);

describe('P21 §10 soft-limit override precedence', () => {
  it('the override beats the boss default in softLimitTicks', () => {
    expect(softLimitTicks({ bossBattle: true, softLimitTicksOverride: 1800 })).toBe(1800);
  });

  it('a boss battle without an override falls back to the boss soft limit', () => {
    expect(softLimitTicks({ bossBattle: true })).toBe(SOFT_LIMIT_BOSS_TICKS);
    expect(SOFT_LIMIT_BOSS_TICKS).not.toBe(SOFT_LIMIT_NORMAL_TICKS);
    expect(SOFT_LIMIT_NORMAL_TICKS).toBe(2700);
  });

  it('a plain battle without an override uses the normal soft limit', () => {
    expect(softLimitTicks({})).toBe(SOFT_LIMIT_NORMAL_TICKS);
  });

  it('the override drives the collapse window at its exact tick on a boss battle', () => {
    const config = { bossBattle: true, softLimitTicksOverride: 900 };
    // At the override tick itself: the window has opened but no collapse DMG
    // has landed yet (collapse is strictly inside the window).
    expect(resolveBattleEnd({ tick: 900, entities: BOTH_ALIVE, phase: { phase: 'ACTIVE' } }, config, 0).action).toBe('none');
    // Exactly one interval in: collapse damage fires (990 − 900 = 90).
    expect(resolveBattleEnd({ tick: 990, entities: BOTH_ALIVE, phase: { phase: 'ACTIVE' } }, config, 0)).toEqual({ action: 'collapse_damage' });
    // Window end (900 + 450) requests the end, not more collapse damage.
    expect(resolveBattleEnd({ tick: 900 + COLLAPSE_WINDOW_TICKS, entities: BOTH_ALIVE, phase: { phase: 'ACTIVE' } }, config, 0).action).toBe('request_end');
  });

  it('without the override a boss battle at tick 990 has not entered the collapse window', () => {
    const bossDefault = { bossBattle: true };
    // 990 is far below the 3600 boss default → no collapse, no end request.
    expect(resolveBattleEnd({ tick: 990, entities: BOTH_ALIVE, phase: { phase: 'ACTIVE' } }, bossDefault, 0)).toEqual({ action: 'none' });
    // Same tick with the override already proved collapse is active — so the
    // override demonstrably took precedence over the boss default.
  });

  it('the adapter maps content softLimitSeconds into the override ticks', () => {
    const source: EncounterObjectiveSource = Object.freeze({
      encounterId: 'enc_precedence_boss',
      objective: 'defeat_boss',
      bossObjects: Object.freeze([]),
      enemySlotCount: 0,
      bossUnitId: 'boss_precedence',
      bossUnitIdSecondary: null,
      survivalDurationSeconds: null,
      healSustainCount: null,
      softLimitSeconds: 60,
      modifierIds: Object.freeze([]),
      reinforcementWaves: Object.freeze([]),
      bossPhases: Object.freeze([]),
      bossPhasesSecondary: Object.freeze([]),
    });
    const deps = Object.freeze({ modifiers: new Map(), encounters: new Map() });
    const launch = buildEncounterLaunchConfig(source, deps);
    expect(launch.softLimitTicks).toBe(numberSecondsToTicks(60).ticks);
    expect(launch.softLimitTicks ?? 0).toBeLessThan(SOFT_LIMIT_BOSS_TICKS);
    // A boss encounter with NO override passes null → the resolver still applies
    // the boss default via its own bossBattle fallback.
    const noOverride: EncounterObjectiveSource = Object.freeze({ ...source, softLimitSeconds: null });
    expect(buildEncounterLaunchConfig(noOverride, deps).softLimitTicks).toBeNull();
  });
});
