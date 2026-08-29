import { describe, expect, it } from 'vitest';
import { stepBattle } from '../../src/game/sim/core/battle-kernel.js';
import { migrateEntity } from '../../src/game/sim/core/migrate.js';
import { createPhase17Systems } from '../../src/game/sim/core/phase17-systems.js';
import { createPhase21Systems } from '../../src/game/sim/core/phase21-systems.js';
import { encounterOutboundFromBattle, presentPhase21Report, type EncounterOutbound, type Phase21OutboundReport } from '../../src/features/battle/outbound/phase21-outbound-presenter.js';
import type { ModifierDefinition } from '../../src/game/sim/world/modifier-system.js';
import type { BossPhaseSnapshot, PhaseDefinition } from '../../src/game/sim/boss/boss-phase-system.js';
import type { KernelSystem } from '../../src/game/sim/core/tick-context.js';
import type { TickInput } from '../../src/game/sim/core/tick-input.js';
import type { BattleModel } from '../../src/game/sim/core/battle-model.js';
import { battle, entity, randomSession } from './test-helpers.js';

/**
 * Phase 21 §9 outbound live bridge. The outbound UI panel consumes the launcher
 * report; this proves the SAME presentation model can be fed straight from a
 * running battle — the bridge maps the live boss phase, modifier hook log and
 * canonical event stream into the outbound entry, and the panel renders it
 * exactly like a static report. Contract:
 *   1. LIVE SURFACES — the bridge reads the battle's real `bossPhase`
 *      (committed trail), `modifierHookLog` (fired hooks with their ticks) and
 *      phase events (planned/started) from the stream the battle produced.
 *   2. PANEL EQUIVALENCE — the bridged entry feeds presentPhase21Report
 *      unchanged: same row shape as the launcher report path.
 *   3. TERMINAL — while the battle is ACTIVE the entry's terminal is null and
 *      the phase trail shows the CURRENT phase as active.
 */
const input: TickInput = Object.freeze({ paused: false, decisions: Object.freeze([]), contentVersion: 'content_fixture' });

const BOSS_ID = 'boss_ash_unit';

const defs: readonly PhaseDefinition[] = Object.freeze([
  Object.freeze({ id: 'p1', bossId: BOSS_ID, priority: 1, minHpPermille: 501, maxHpPermille: 1001, previewKey: 'preview_p1' }),
  Object.freeze({ id: 'p2', bossId: BOSS_ID, priority: 2, minHpPermille: 0, maxHpPermille: 501, previewKey: 'preview_p2' }),
]);

const modifiers: readonly ModifierDefinition[] = Object.freeze([
  Object.freeze({ id: 'mod_fixture_bridge', previewKey: 'preview_mod_fixture_bridge', hooks: Object.freeze(['on_battle_start', 'on_damage_applied'] as const), incompatibilityTags: Object.freeze([]), params: Object.freeze({}) }),
]);

function bossPhaseSeed(): BossPhaseSnapshot {
  return Object.freeze({ entityId: BOSS_ID, bossId: BOSS_ID, phaseId: 'p1', transition: null, visited: Object.freeze(['p1']), invulnerableUntilTick: null });
}

function buildSystems(): readonly KernelSystem[] {
  return Object.freeze([
    ...createPhase17Systems({ speedsX100PerSecond: {} }),
    ...createPhase21Systems({ bossPhaseDefinitions: defs, modifiers }),
  ]);
}

function buildBattle(): BattleModel {
  const player = migrateEntity({ entity: entity('unit_p', { side: 'player', lane: 'middle', x100: 1800, maxLp: 1000, lp: 1000 }), radiusX100: 100 });
  // Boss at 40% HP (permille 400, p2's bracket) seeded into p1 → the p1→p2
  // transition is planned and commits at the default 45-tick window.
  const boss = migrateEntity({ entity: entity(BOSS_ID, { side: 'enemy', lane: 'middle', x100: 7000, maxLp: 1000, lp: 400 }), radiusX100: 120 });
  return battle({
    simulationVersion: 'phase21-outbound-bridge-v1',
    entities: Object.freeze([player, boss]),
    abilities: Object.freeze([]),
    bossPhase: bossPhaseSeed(),
    pendingCombatApplications: Object.freeze([
      Object.freeze({ kind: 'damage', sourceId: 'unit_p', targetId: BOSS_ID, effectId: 'ef_hit', attackInstanceId: 1, effectIndex: 0, rawAmount: 100, damageTypeOrdinal: 0, defense: 0, coverReductionBps: 0, bossCapBps: null }),
    ]),
  });
}

describe('P21 §9 outbound live battle bridge', () => {
  it('maps the live boss phase, hook log and phase events into the panel rows', { timeout: 60_000 }, () => {
    const systems = buildSystems();
    let state = buildBattle();
    const random = randomSession();
    const events: { type: string; tick: number; contentIds: readonly string[]; resolveTick?: number }[] = [];
    for (let t = 0; t < 70; t++) {
      const r = stepBattle({ state, input, random, rules: {}, content: {}, systems });
      state = r.state;
      for (const event of r.events) {
        events.push(Object.freeze({
          type: event.type,
          tick: state.tick,
          contentIds: event.contentIds,
          ...(event.payload['resolveTick'] === undefined ? {} : { resolveTick: event.payload['resolveTick'] }),
        }));
      }
    }
    // The live battle genuinely committed p1→p2 and fired the modifier hooks.
    expect(state.bossPhase?.phaseId).toBe('p2');
    const hookLog = state.modifierHookLog ?? [];
    expect(hookLog.some((f) => f.modifierId === 'mod_fixture_bridge' && f.hook === 'on_battle_start')).toBe(true);
    expect(hookLog.some((f) => f.modifierId === 'mod_fixture_bridge' && f.hook === 'on_damage_applied')).toBe(true);

    // Bridge the LIVE state into the outbound surface the panel consumes.
    const entry: EncounterOutbound = encounterOutboundFromBattle({
      encounterId: 'encounter_fixture_boss_object',
      objective: 'defeat_boss',
      tick: state.tick,
      phase: { phase: state.phase.phase, endReason: state.endReason },
      bossPhase: state.bossPhase ?? null,
      modifierHookLog: hookLog,
      events,
    });
    const report: Phase21OutboundReport = Object.freeze({
      gate: 'G21-LIVE-BRIDGE',
      status: 'PASS',
      drift: 0,
      seededFailures: 0,
      perEncounter: Object.freeze({ encounter_fixture_boss_object: entry }),
    });
    const rows = presentPhase21Report(report);
    const row = rows[0];
    expect(row).toBeDefined();
    if (row === undefined) throw new Error('no row');
    // 1. LIVE SURFACES: the phase trail carries the real committed trail with
    // the current phase active.
    expect(row.phaseTrail).toEqual([
      Object.freeze({ phaseId: 'p1', active: false }),
      Object.freeze({ phaseId: 'p2', active: true }),
    ]);
    // The hook telegraphs come from the live log.
    expect(row.hookTrace.map((h) => h.hook)).toContain('on_battle_start');
    expect(row.hookTrace.map((h) => h.hook)).toContain('on_damage_applied');
    // The phase trace carries the planned + started events from the live stream.
    expect(row.phaseTrace.some((e) => e.type === 'PhaseTransitionPlanned' && e.detail.includes('p2'))).toBe(true);
    expect(row.phaseTrace.some((e) => e.type === 'BossPhaseStarted' && e.detail.includes('p2'))).toBe(true);
    // The live telegraph surfaced with its real resolve tick: at the snapshot
    // tick the p1→p2 telegraph has already resolved (commit happened).
    expect(row.telegraphs.length).toBeGreaterThan(0);
    expect(row.telegraphs[0]).toMatchObject({ phaseId: 'p2', resolved: true });
    expect(row.telegraphs[0]?.resolveTick).toBeGreaterThan(row.telegraphs[0]?.plannedTick ?? 0);
    // 2 + 3. PANEL EQUIVALENCE + TERMINAL: same row shape, ACTIVE → null terminal.
    expect(row.isBossPhase).toBe(true);
    expect(row.phasesDescended).toBe(true);
    expect(row.terminalPhase).toBeNull();
    expect(row.terminalReason).toBeNull();
    expect(row.encounterId).toBe('encounter_fixture_boss_object');
  });
});
