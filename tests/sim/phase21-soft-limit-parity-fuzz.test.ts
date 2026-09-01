/**
 * Phase 21 §10 boss default × override PARITY FUZZ. The soft limit is decided
 * at THREE authorities that must always agree:
 *
 *   1. the RESOLVER (`softLimitTicks`): override first, then boss default,
 *      then the normal default;
 *   2. the ADAPTER (`buildEncounterLaunchConfig`): maps the encounter's
 *      `softLimitSeconds` into the override ticks the resolver consumes;
 *   3. the HOST (`battleEndConfigFor`): builds the `battleEnd` config a real
 *      expedition battle runs under (bossBattle flag + override ticks).
 *
 * This sweep grids every boss-family × override combination and asserts the
 * three authorities produce the SAME effective limit — and that the resolver's
 * window behaviour at the boundary ticks is a pure function of that limit, so
 * a boss default and an equal override are indistinguishable, while a boss
 * battle with no override NEVER drifts to the normal 2700 default.
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
import { buildEncounterLaunchConfig } from '../../src/game/sim/boss/encounter-adapter.js';
import { numberSecondsToTicks } from '../../src/game/sim/math/time-and-speed.js';
import {
  battleEndConfigFor,
  sourceForEncounter,
} from '../../src/features/battle/sim/sim-battle-host.js';
import type { ContentEncounterEntry } from '../../src/game/content/runtime/encounter-registry.js';

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

/** Content-reachable override grid: every realistic softLimitSeconds value (incl. none). */
const OVERRIDE_SECONDS: ReadonlyArray<number | null> = Object.freeze([null, 1, 3, 30, 90, 120, 300]);
const BOSS_FLAGS: ReadonlyArray<boolean> = Object.freeze([false, true]);

/** Minimal but shape-true content entry for the fuzz (only the fields the three authorities read). */
function mkEntry(boss: boolean, softLimitSeconds: number | null): ContentEncounterEntry {
  return Object.freeze({
    id: 'enc_parity',
    objective: boss ? 'defeat_boss' : 'defeat_all',
    enemySlots: Object.freeze([Object.freeze({ unitId: 'unit_e', count: 1 })]),
    bossObjects: Object.freeze([]),
    modifierIds: Object.freeze([]),
    reinforcementWaves: Object.freeze([]),
    bossPhases: Object.freeze([]),
    bossPhasesSecondary: Object.freeze([]),
    ...(boss ? { bossUnitId: 'boss_parity' } : {}),
    ...(softLimitSeconds === null ? {} : { softLimitSeconds }),
  }) as unknown as ContentEncounterEntry;
}

/** The effective limit the three authorities MUST agree on. */
function effectiveLimit(boss: boolean, softLimitSeconds: number | null): number {
  if (softLimitSeconds !== null) return numberSecondsToTicks(softLimitSeconds).ticks;
  return boss ? SOFT_LIMIT_BOSS_TICKS : SOFT_LIMIT_NORMAL_TICKS;
}

describe('P21 §10 boss default × override parity fuzz', () => {
  it('the host battle-end config, adapter mapping and resolver agree on every grid cell', () => {
    const deps = Object.freeze({ modifiers: new Map(), encounters: new Map() });
    for (const boss of BOSS_FLAGS) {
      for (const seconds of OVERRIDE_SECONDS) {
        const entry = mkEntry(boss, seconds);
        // 2. ADAPTER: the host's own source mapping → launch config.
        const launch = buildEncounterLaunchConfig(sourceForEncounter(entry), deps);
        // 3. HOST: the battle-end config a real battle runs under.
        const config = battleEndConfigFor(entry, launch);
        // 1. RESOLVER: the effective limit the config actually produces.
        const effective = effectiveLimit(boss, seconds);
        expect(softLimitTicks(config)).toBe(effective);
        // The adapter's override ticks are exactly what the host feeds through.
        expect(config.softLimitTicksOverride ?? null).toBe(launch.softLimitTicks);
        // The boss flag rides the config exactly when the entry is a boss.
        expect(config.bossBattle === true).toBe(boss);
        // A boss battle WITHOUT an override never drifts to the normal default.
        if (boss && seconds === null) {
          expect(effective).toBe(SOFT_LIMIT_BOSS_TICKS);
          expect(effective).not.toBe(SOFT_LIMIT_NORMAL_TICKS);
        }
      }
    }
  });

  it('an override equal to the boss default is honored — never falls through to the normal default', () => {
    // softLimitSeconds 120 → 3600 ticks, the same value the boss default would
    // have produced: the host must still pass the OVERRIDE through (so the two
    // cells behave identically instead of silently degrading to 2700).
    const bossEntry = mkEntry(true, 120);
    const bossLaunch = buildEncounterLaunchConfig(sourceForEncounter(bossEntry), Object.freeze({ modifiers: new Map(), encounters: new Map() }));
    const bossConfig = battleEndConfigFor(bossEntry, bossLaunch);
    expect(bossConfig.softLimitTicksOverride).toBe(SOFT_LIMIT_BOSS_TICKS);
    expect(softLimitTicks(bossConfig)).toBe(SOFT_LIMIT_BOSS_TICKS);
    expect(softLimitTicks(bossConfig)).not.toBe(SOFT_LIMIT_NORMAL_TICKS);
    // An explicit override equal to the boss default and the implicit boss
    // default are indistinguishable to the resolver.
    const implicit = battleEndConfigFor(mkEntry(true, null), bossLaunch);
    expect(softLimitTicks(implicit)).toBe(softLimitTicks(bossConfig));
  });

  it('resolver window behaviour at the boundary ticks is a pure function of the effective limit', () => {
    for (const boss of BOSS_FLAGS) {
      for (const seconds of OVERRIDE_SECONDS) {
        const effective = effectiveLimit(boss, seconds);
        const config = {
          ...(boss ? { bossBattle: true } : {}),
          ...(seconds === null ? {} : { softLimitTicksOverride: effective }),
        };
        const decision = (tick: number) => resolveBattleEnd({ tick, entities: BOTH_ALIVE, phase: { phase: 'ACTIVE' } }, config, 0).action;
        // One tick before the window: nothing (the window opens AT the limit).
        expect(decision(effective - 1)).toBe('none');
        // At the limit tick itself: the window has opened but no collapse DMG
        // has landed yet (collapse fires strictly inside the window).
        expect(decision(effective)).toBe('none');
        // One 90-tick interval in: collapse damage fires.
        expect(decision(effective + 90)).toBe('collapse_damage');
        // The last inside-window interval (effective + 360): collapse.
        expect(decision(effective + COLLAPSE_WINDOW_TICKS - 90)).toBe('collapse_damage');
        // EXACT window end: the resolver requests the end instead of firing.
        expect(decision(effective + COLLAPSE_WINDOW_TICKS)).toBe('request_end');
      }
    }
  });
});
