import { describe, expect, it } from 'vitest';
import { createSimBattleHost, resolveExpeditionEncounter, sourceForEncounter } from '../../src/features/battle/sim/sim-battle-host.js';
import { encounterOutboundFromBattle, presentPhase21Report, type Phase21OutboundReport } from '../../src/features/battle/outbound/phase21-outbound-presenter.js';
import { buildEncounterLaunchConfig } from '../../src/game/sim/boss/encounter-adapter.js';
import {
  CONTENT_ENCOUNTERS,
  encounterById,
  isBossEncounter,
  isDuoEncounter,
  resolveEncounterForNode,
} from '../../src/game/content/runtime/encounter-registry.js';

/**
 * Phase 21 §9 expedition battle wiring.
 *
 * `NodeScreen` previously fed the outbound panel an empty boss/hook surface
 * because the sim kernel was not wired into the expedition flow. This proves
 * the sim battle host now runs the REAL kernel battle for the node's encounter
 * (buildEncounterLaunchConfig + createPhase17/21Systems + stepBattle) and that
 * its live outbound input — boss phase, modifier hook log, canonical phase
 * events — renders through the same panel path a static launcher report uses.
 */
describe('P21 §9 expedition battle wiring', () => {
  it('resolves the boss node to the duo encounter and runs a real live battle', { timeout: 120_000 }, () => {
    const encounter = resolveExpeditionEncounter('boss', 'enemy_fixture_echo');
    expect(encounter).not.toBeNull();
    if (encounter === null) throw new Error('boss node unresolved');
    expect(encounter.id).toBe('encounter_fixture_boss_duo');
    expect(sourceForEncounter(encounter).objective).toBe('defeat_boss');

    const host = createSimBattleHost({ encounter });
    expect(host.encounterId).toBe('encounter_fixture_boss_duo');
    const live = host.run();

    // The live feed carries a REAL boss authority (not the empty stand-in).
    expect(live.bossPhase).not.toBeNull();
    expect(live.bossPhase?.visited.length).toBeGreaterThanOrEqual(1);
    // The canonical phase event stream reached the surface (telegraphs fired).
    expect(live.events.some((e) => e.type === 'BossTelegraphStarted')).toBe(true);
    expect(live.events.some((e) => e.type === 'PhaseTransitionPlanned')).toBe(true);
    expect(live.phase.phase).toMatch(/^(ACTIVE|VICTORY|DEFEAT|DRAW_ABORT)$/);

    // Determinism: the fixture seed replays byte-identically.
    const again = createSimBattleHost({ encounter }).run();
    expect(again).toEqual(live);

    // The panel consumes the live state exactly like a launcher report.
    const entry = encounterOutboundFromBattle(live);
    const report: Phase21OutboundReport = Object.freeze({
      gate: 'G21-LIVE-BATTLE',
      status: entry.status,
      drift: 0,
      seededFailures: 0,
      perEncounter: Object.freeze({ [live.encounterId]: entry }),
    });
    const rows = presentPhase21Report(report);
    expect(rows).toHaveLength(1);
    const row = rows[0];
    if (row === undefined) throw new Error('no row');
    expect(row.encounterId).toBe('encounter_fixture_boss_duo');
    expect(row.isBossPhase).toBe(true);
    expect(row.phaseTrail.length).toBeGreaterThanOrEqual(1);
    expect(row.phaseTrace.length).toBeGreaterThan(0);
  });

  it('resolves the battle node to the modifier encounter and surfaces the hook log', { timeout: 120_000 }, () => {
    const encounter = resolveExpeditionEncounter('battle', 'enemy_fixture_echo');
    expect(encounter).not.toBeNull();
    if (encounter === null) throw new Error('battle node unresolved');
    expect(encounter.id).toBe('encounter_fixture_first');

    const live = createSimBattleHost({ encounter }).run();
    // Both fixture modifiers commit and their on_battle_start hooks fire.
    expect(live.modifierHookLog.length).toBeGreaterThanOrEqual(2);
    expect(live.modifierHookLog.some((f) => f.hook === 'on_battle_start')).toBe(true);
    // defeat_all: unit_p eliminates the single regular — a real terminal.
    expect(live.phase.phase).toBe('VICTORY');
    expect(live.bossPhase).toBeNull();
  });

  it('keeps the stand-in feed for node types the expedition cannot resolve', () => {
    expect(resolveExpeditionEncounter('merchant', 'any')).toBeNull();
    expect(resolveExpeditionEncounter('boss', '')).toBeNull();
  });

  it('resolves via the content runtime registry, payloadKey-first, from real content', () => {
    // The registry is the compiled-content projection: every registered
    // encounter resolves by id and is frozen.
    expect(CONTENT_ENCOUNTERS.size).toBe(8);
    for (const entry of CONTENT_ENCOUNTERS.values()) {
      expect(Object.isFrozen(entry)).toBe(true);
      expect(encounterById(entry.id)?.id).toBe(entry.id);
    }
    expect(encounterById('missing_encounter')).toBeNull();

    // PAYLOAD-KEY-FIRST: a payload key that names an encounter wins over the
    // node family (a boss node carrying the object encounter plays THAT one).
    const byKey = resolveEncounterForNode('boss', 'encounter_fixture_boss_object');
    expect(byKey?.id).toBe('encounter_fixture_boss_object');
    expect(isBossEncounter(byKey ?? CONTENT_ENCOUNTERS.get('encounter_fixture_first')!)).toBe(true);
    expect(isDuoEncounter(byKey ?? CONTENT_ENCOUNTERS.get('encounter_fixture_boss_object')!)).toBe(false);

    // NODE-FAMILY FALLBACK: deterministic content classification, canonical
    // id order — boss → duo, elite → single-boss, battle → non-boss.
    const boss = resolveEncounterForNode('boss', 'enemy_fixture_echo');
    expect(boss?.id).toBe('encounter_fixture_boss_duo');
    expect(isDuoEncounter(boss ?? CONTENT_ENCOUNTERS.get('encounter_fixture_first')!)).toBe(true);
    const elite = resolveEncounterForNode('elite', 'enemy_fixture_echo');
    expect(elite?.id).toBe('encounter_fixture_boss_object');
    expect(isBossEncounter(elite ?? CONTENT_ENCOUNTERS.get('encounter_fixture_first')!)).toBe(true);
    expect(isDuoEncounter(elite ?? CONTENT_ENCOUNTERS.get('encounter_fixture_first')!)).toBe(false);
    const battle = resolveEncounterForNode('battle', 'enemy_fixture_echo');
    expect(battle?.id).toBe('encounter_fixture_first');
    expect(isBossEncounter(battle ?? CONTENT_ENCOUNTERS.get('encounter_fixture_first')!)).toBe(false);
  });

  it('the resolved source builds a valid launch config (adapter path is live)', () => {
    const encounter = resolveExpeditionEncounter('boss', 'enemy_fixture_echo');
    if (encounter === null) throw new Error('unresolved');
    const launch = buildEncounterLaunchConfig(sourceForEncounter(encounter), {
      modifiers: new Map(),
      encounters: new Map([[encounter.id, { enemySlots: encounter.enemySlots }]]),
    });
    expect(launch.objectives.length).toBeGreaterThan(0);
    expect(launch.bossPhaseDefinitions.length).toBe(5); // p1/p2/p3 + q1/q2
  });
});
