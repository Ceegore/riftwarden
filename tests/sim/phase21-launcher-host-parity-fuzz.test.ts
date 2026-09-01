/**
 * Phase 21 §10 LAUNCHER × HOST battle-end PARITY FUZZ. The soft limit is built
 * at THREE places that must never drift apart:
 *
 *   1. the LAUNCHER (`tools/sim/run-content-encounters.mjs`) — classifies the
 *      encounter (bossBattleFor: objective `defeat_boss` OR a boss unit) and
 *      reports the exact config it ran under (`battleEnd` on every report
 *      entry, pinned by the tooling test);
 *   2. the HOST (`battleEndConfigFor` + `isBossEncounter`) — the config a real
 *      expedition battle runs under;
 *   3. the RESOLVER (`softLimitTicks`) — the effective limit both feed.
 *
 * This fuzz grids every REAL content encounter (runtime registry) plus a
 * synthetic boss × override grid and asserts:
 *   - host config === launcher model cell-by-cell (deep identity);
 *   - the resolver's effective limit === the launcher's reported effective
 *     ticks (so a drift in the hardcoded 3600/2700 defaults is caught);
 *   - the ONE cell where the two classification formulas would disagree
 *     (defeat_boss WITHOUT a boss unit) is a CONTENT ERROR — structurally
 *     unreachable, so the formulas coincide on every valid encounter.
 */
import { describe, expect, it } from 'vitest';
import {
  COLLAPSE_WINDOW_TICKS,
  SOFT_LIMIT_BOSS_TICKS,
  SOFT_LIMIT_NORMAL_TICKS,
  resolveBattleEnd,
  softLimitTicks,
} from '../../src/game/sim/combat/battle-end-resolver.js';
import type { KernelEntity } from '../../src/game/sim/core/entity.js';
import { buildEncounterLaunchConfig } from '../../src/game/sim/boss/encounter-adapter.js';
import { numberSecondsToTicks } from '../../src/game/sim/math/time-and-speed.js';
import {
  battleEndConfigFor,
  sourceForEncounter,
} from '../../src/features/battle/sim/sim-battle-host.js';
import {
  CONTENT_ENCOUNTERS,
  CONTENT_MODIFIERS,
  isBossEncounter,
  type ContentEncounterEntry,
} from '../../src/game/content/runtime/encounter-registry.js';

/** Reproduces the launcher's §10 construction verbatim (bossBattleFor + battleEndFor). */
function launcherBattleEnd(
  entry: Readonly<ContentEncounterEntry>,
  launch: ReturnType<typeof buildEncounterLaunchConfig>,
): { readonly bossBattle: boolean; readonly softLimitTicksOverride?: number; readonly softLimitTicks: number } {
  const boss = entry.objective === 'defeat_boss' || (entry.bossUnitId ?? null) !== null;
  return Object.freeze({
    bossBattle: boss,
    ...(launch.softLimitTicks === null ? {} : { softLimitTicksOverride: launch.softLimitTicks }),
    softLimitTicks: launch.softLimitTicks ?? (boss ? 3600 : 2700),
  });
}

/** Synthetic content entry: only the fields the three authorities read. */
function mkEntry(boss: boolean, softLimitSeconds: number | null, objectiveOverride?: string): ContentEncounterEntry {
  return Object.freeze({
    id: 'enc_parity',
    objective: (objectiveOverride ?? (boss ? 'defeat_boss' : 'defeat_all')) as ContentEncounterEntry['objective'],
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

// The REAL registries (the same deps the host's launchFor passes) — real
// content entries reference real modifier ids, so the adapter needs them.
const DEPS = Object.freeze({
  modifiers: CONTENT_MODIFIERS,
  encounters: new Map([...CONTENT_ENCOUNTERS.entries()].map(([id, e]) => [id, { enemySlots: e.enemySlots }] as const)),
});

/** Synthetic grid cells declare no modifiers/waves → empty registries are correct. */
const EMPTY_DEPS = Object.freeze({ modifiers: new Map(), encounters: new Map() });

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

const OVERRIDE_SECONDS: ReadonlyArray<number | null> = Object.freeze([null, 1, 3, 30, 60, 90, 120, 300]);
const BOSS_FLAGS: ReadonlyArray<boolean> = Object.freeze([false, true]);

describe('P21 §10 launcher × host battle-end parity fuzz', () => {
  it('host config, launcher model and resolver agree on every REAL content encounter', () => {
    expect(CONTENT_ENCOUNTERS.size).toBeGreaterThan(0);
    for (const entry of CONTENT_ENCOUNTERS.values()) {
      const launch = buildEncounterLaunchConfig(sourceForEncounter(entry), DEPS);
      const host = battleEndConfigFor(entry, launch);
      const launcher = launcherBattleEnd(entry, launch);
      // The host config and the launcher config are deep-identical on the
      // fields both carry (bossBattle + override)…
      expect(host).toEqual(Object.freeze({
        ...(launcher.bossBattle ? { bossBattle: true } : {}),
        ...(launcher.softLimitTicksOverride === undefined ? {} : { softLimitTicksOverride: launcher.softLimitTicksOverride }),
      }));
      // …and the resolver's effective limit equals the launcher's reported ticks.
      expect(softLimitTicks(host)).toBe(launcher.softLimitTicks);
      // The classification formulas agree on every VALID encounter.
      expect(launcher.bossBattle).toBe(isBossEncounter(entry));
      // The effective limit is one of the two contract defaults or the override.
      const viaOverride = entry.softLimitSeconds === undefined || entry.softLimitSeconds === null
        ? null
        : numberSecondsToTicks(entry.softLimitSeconds).ticks;
      if (viaOverride !== null) {
        expect(launcher.softLimitTicks).toBe(viaOverride);
      } else {
        expect(launcher.softLimitTicks).toBe(isBossEncounter(entry) ? SOFT_LIMIT_BOSS_TICKS : SOFT_LIMIT_NORMAL_TICKS);
      }
    }
  });

  it('host config and launcher model agree on every synthetic boss × override cell', () => {
    for (const boss of BOSS_FLAGS) {
      for (const seconds of OVERRIDE_SECONDS) {
        const entry = mkEntry(boss, seconds);
        const launch = buildEncounterLaunchConfig(sourceForEncounter(entry), EMPTY_DEPS);
        const host = battleEndConfigFor(entry, launch);
        const launcher = launcherBattleEnd(entry, launch);
        expect(host).toEqual(Object.freeze({
          ...(boss ? { bossBattle: true } : {}),
          ...(seconds === null ? {} : { softLimitTicksOverride: numberSecondsToTicks(seconds).ticks }),
        }));
        expect(softLimitTicks(host)).toBe(launcher.softLimitTicks);
        expect(launcher.softLimitTicks).toBe(seconds === null ? (boss ? SOFT_LIMIT_BOSS_TICKS : SOFT_LIMIT_NORMAL_TICKS) : numberSecondsToTicks(seconds).ticks);
        // A boss battle without an override never drifts to the normal default.
        if (boss && seconds === null) {
          expect(launcher.softLimitTicks).toBe(SOFT_LIMIT_BOSS_TICKS);
          expect(launcher.softLimitTicks).not.toBe(SOFT_LIMIT_NORMAL_TICKS);
        }
      }
    }
  });

  it('an override equal to the boss default is honored by BOTH sides (never degrades to 2700)', () => {
    const entry = mkEntry(true, 120); // 120s → 3600 ticks = the boss default
    const launch = buildEncounterLaunchConfig(sourceForEncounter(entry), EMPTY_DEPS);
    const host = battleEndConfigFor(entry, launch);
    const launcher = launcherBattleEnd(entry, launch);
    expect(host.softLimitTicksOverride).toBe(SOFT_LIMIT_BOSS_TICKS);
    expect(launcher.softLimitTicksOverride).toBe(SOFT_LIMIT_BOSS_TICKS);
    expect(softLimitTicks(host)).toBe(SOFT_LIMIT_BOSS_TICKS);
    expect(softLimitTicks(host)).not.toBe(SOFT_LIMIT_NORMAL_TICKS);
    // Indistinguishable from the implicit boss default to both sides.
    const implicitLaunch = buildEncounterLaunchConfig(sourceForEncounter(mkEntry(true, null)), EMPTY_DEPS);
    expect(softLimitTicks(battleEndConfigFor(mkEntry(true, null), implicitLaunch))).toBe(softLimitTicks(host));
    expect(launcherBattleEnd(mkEntry(true, null), implicitLaunch).softLimitTicks).toBe(launcher.softLimitTicks);
  });

  it('the ONE formula-divergence cell is a content error — structurally unreachable', () => {
    // `defeat_boss` without a boss unit is the only input where the launcher's
    // formula (objective OR unit) and the host's (unit only) would disagree —
    // the adapter rejects it, so valid content can never hit the gap.
    const bad = mkEntry(false, null, 'defeat_boss');
    expect(() => buildEncounterLaunchConfig(sourceForEncounter(bad), EMPTY_DEPS)).toThrow('P21_OBJECTIVE_INVALID');
    // And every REAL encounter already proved the formulas agree (above).
  });

  it('the window behaviour at the boundary ticks is a pure function of the launcher-reported limit (real content)', () => {
    for (const entry of CONTENT_ENCOUNTERS.values()) {
      const launch = buildEncounterLaunchConfig(sourceForEncounter(entry), DEPS);
      const host = battleEndConfigFor(entry, launch);
      const effective = launcherBattleEnd(entry, launch).softLimitTicks;
      expect(softLimitTicks(host)).toBe(effective);
      // The collapse window opens AT the limit: one tick before is nothing, at
      // the limit the window is open but no damage has landed, one interval in
      // collapse damage fires, and the exact window end requests the end.
      const decision = (tick: number) => resolveBattleEnd({ tick, entities: BOTH_ALIVE, phase: { phase: 'ACTIVE' } }, host, 0).action;
      expect(decision(effective - 1)).toBe('none');
      expect(decision(effective)).toBe('none');
      expect(decision(effective + 90)).toBe('collapse_damage');
      expect(decision(effective + COLLAPSE_WINDOW_TICKS - 90)).toBe('collapse_damage');
      expect(decision(effective + COLLAPSE_WINDOW_TICKS)).toBe('request_end');
    }
  });
});
