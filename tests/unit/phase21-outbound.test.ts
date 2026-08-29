import { describe, expect, it } from 'vitest';
import { collapsePresentationOf, encounterOutboundFromBattle, phaseTrailOf, presentPhase21Report, type EncounterOutbound, type Phase21OutboundReport } from '../../src/features/battle/outbound/phase21-outbound-presenter.js';
import { COLLAPSE_WINDOW_TICKS } from '../../src/game/sim/combat/battle-end-resolver.js';

function bossReport(): Phase21OutboundReport {
  return Object.freeze({
    gate: 'G21-CONTENT-LAUNCH',
    status: 'PASS',
    drift: 0,
    seededFailures: 0,
    perEncounter: Object.freeze({
      encounter_fixture_boss_object: Object.freeze<EncounterOutbound>({
        objective: 'defeat_boss',
        terminal: { phase: 'VICTORY', reason: 'waves_complete' },
        ticks: 455,
        status: 'PASS',
        hooks: [['mod_fixture_onslaught', 'on_damage_applied', 12]],
        bossPhase: { phaseId: 'phase_ash_2', visited: ['phase_ash_1', 'phase_ash_2'], transition: false },
        phasesDescended: true,
        phaseTrace: [
          ['PhaseTransitionPlanned', 2, 'boss_ash_unit/phase_ash_1/phase_ash_2'],
          ['BossTelegraphStarted', 2, 'boss_ash_unit/phase_ash_2'],
          ['BossPhaseStarted', 47, 'boss_ash_unit/phase_ash_2'],
        ],
        telegraphs: [
          ['phase_ash_2', 2, 47],
          ['phase_ash_3', 47, 92],
        ],
      }),
      encounter_fixture_first: Object.freeze<EncounterOutbound>({
        objective: 'defeat_all',
        terminal: { phase: 'VICTORY', reason: 'side_eliminated' },
        ticks: 120,
        status: 'PASS',
        hooks: [],
        bossPhase: null,
      }),
    }),
  });
}

describe('phase21 outbound presenter', () => {
  it('maps the report to per-encounter rows sorted by id', () => {
    const rows = presentPhase21Report(bossReport());
    expect(rows.map((r) => r.encounterId)).toEqual(['encounter_fixture_boss_object', 'encounter_fixture_first']);
    const boss = rows.find((r) => r.encounterId === 'encounter_fixture_boss_object');
    expect(boss?.isBossPhase).toBe(true);
    expect(boss?.phasesDescended).toBe(true);
    expect(boss?.terminalPhase).toBe('VICTORY');
    expect(boss?.terminalReason).toBe('waves_complete');
    expect(boss?.ticks).toBe(455);
    expect(boss?.status).toBe('PASS');
  });

  it('resolves the phase trail with the current phase flagged active', () => {
    const rows = presentPhase21Report(bossReport());
    const boss = rows.find((r) => r.encounterId === 'encounter_fixture_boss_object');
    expect(boss?.phaseTrail).toEqual([
      Object.freeze({ phaseId: 'phase_ash_1', active: false }),
      Object.freeze({ phaseId: 'phase_ash_2', active: true }),
    ]);
  });

  it('maps the hook telegraphs and the full phase trace in order', () => {
    const rows = presentPhase21Report(bossReport());
    const boss = rows.find((r) => r.encounterId === 'encounter_fixture_boss_object');
    expect(boss?.hookTrace).toEqual([Object.freeze({ modifierId: 'mod_fixture_onslaught', hook: 'on_damage_applied', atTick: 12 })]);
    expect(boss?.phaseTrace.map((t) => [t.type, t.tick, t.detail])).toEqual([
      ['PhaseTransitionPlanned', 2, 'boss_ash_unit/phase_ash_1/phase_ash_2'],
      ['BossTelegraphStarted', 2, 'boss_ash_unit/phase_ash_2'],
      ['BossPhaseStarted', 47, 'boss_ash_unit/phase_ash_2'],
    ]);
  });

  it('presents the telegraph countdowns against the snapshot tick', () => {
    const rows = presentPhase21Report(bossReport());
    const boss = rows.find((r) => r.encounterId === 'encounter_fixture_boss_object');
    // Terminal snapshot at tick 455: both telegraphs resolved (countdown 0).
    expect(boss?.telegraphs).toEqual([
      Object.freeze({ phaseId: 'phase_ash_2', plannedTick: 2, resolveTick: 47, countdown: 0, resolved: true }),
      Object.freeze({ phaseId: 'phase_ash_3', plannedTick: 47, resolveTick: 92, countdown: 0, resolved: true }),
    ]);
  });

  it('shows a live countdown for a mid-flight telegraph', () => {
    const report: Phase21OutboundReport = Object.freeze({
      gate: 'G21-LIVE-BATTLE',
      status: 'PASS',
      drift: 0,
      seededFailures: 0,
      perEncounter: Object.freeze({
        encounter_fixture_boss_duo: Object.freeze<EncounterOutbound>({
          objective: 'defeat_boss',
          terminal: null,
          ticks: 60,
          status: 'PASS',
          hooks: [],
          bossPhase: { phaseId: 'phase_duo_p2', visited: ['phase_duo_p1', 'phase_duo_p2'], transition: false },
          phasesDescended: true,
          telegraphs: [['phase_duo_p3', 55, 100]],
        }),
      }),
    });
    const rows = presentPhase21Report(report);
    const row = rows[0];
    if (row === undefined) throw new Error('no row');
    expect(row.telegraphs).toEqual([
      Object.freeze({ phaseId: 'phase_duo_p3', plannedTick: 55, resolveTick: 100, countdown: 40, resolved: false }),
    ]);
  });

  it('maps a secondary boss authority into its own trail (duo encounters)', () => {
    const report: Phase21OutboundReport = Object.freeze({
      gate: 'G21-CONTENT-LAUNCH',
      status: 'PASS',
      drift: 0,
      seededFailures: 0,
      perEncounter: Object.freeze({
        encounter_fixture_boss_duo: Object.freeze<EncounterOutbound>({
          objective: 'defeat_boss',
          terminal: { phase: 'VICTORY', reason: 'side_eliminated' },
          ticks: 383,
          status: 'PASS',
          hooks: [],
          bossPhase: { phaseId: 'phase_duo_p2', visited: ['phase_duo_p1', 'phase_duo_p2'], transition: false },
          bossPhaseSecondary: { phaseId: 'phase_duo_q2', visited: ['phase_duo_q1', 'phase_duo_q2'], transition: false },
          phasesDescended: true,
        }),
      }),
    });
    const rows = presentPhase21Report(report);
    const row = rows[0];
    expect(row).toBeDefined();
    if (row === undefined) throw new Error('no row');
    expect(row.isBossPhase).toBe(true);
    expect(row.phaseTrail).toEqual([
      Object.freeze({ phaseId: 'phase_duo_p1', active: false }),
      Object.freeze({ phaseId: 'phase_duo_p2', active: true }),
    ]);
    expect(row.phaseTrailSecondary).toEqual([
      Object.freeze({ phaseId: 'phase_duo_q1', active: false }),
      Object.freeze({ phaseId: 'phase_duo_q2', active: true }),
    ]);
  });

  it('an encounter without a boss phase has empty trails and is not a boss row', () => {
    const rows = presentPhase21Report(bossReport());
    const plain = rows.find((r) => r.encounterId === 'encounter_fixture_first');
    expect(plain?.isBossPhase).toBe(false);
    expect(plain?.phaseTrail).toEqual([]);
    expect(plain?.phaseTrace).toEqual([]);
    expect(plain?.hookTrace).toEqual([]);
    expect(plain?.terminalReason).toBe('side_eliminated');
  });

  it('phaseTrailOf handles null and a single current phase', () => {
    expect(phaseTrailOf(null)).toEqual([]);
    expect(phaseTrailOf({ phaseId: 'phase_ash_1', visited: ['phase_ash_1'], transition: false })).toEqual([
      Object.freeze({ phaseId: 'phase_ash_1', active: true }),
    ]);
  });

  it('derives the §10 collapse presentation from the raw live state', () => {
    // Inactive (no collapse state yet): window closed, no endcap activity.
    expect(collapsePresentationOf({ tick: 100 })).toEqual(Object.freeze({
      active: false, sinceTick: null, remainingTicks: 0, healFactorBps: 5000,
      endcapWarned: false, endcapCollapseTicks: 0, ticksToWarning: 300,
    }));
    // Active window: since 90, snapshot tick 92 → 90 + 450 − 92 = 448 left.
    expect(collapsePresentationOf({ tick: 92, timeCollapseSinceTick: 90 })).toEqual(Object.freeze({
      active: true, sinceTick: 90, remainingTicks: 90 + COLLAPSE_WINDOW_TICKS - 92, healFactorBps: 5000,
      endcapWarned: false, endcapCollapseTicks: 0, ticksToWarning: 300,
    }));
    // Window elapsed: the exact boundary tick is outside [since, since + 450).
    expect(collapsePresentationOf({ tick: 90 + COLLAPSE_WINDOW_TICKS, timeCollapseSinceTick: 90 }).active).toBe(false);
    // §9.4 endcap warned: 200 ticks into the 300-tick collapse countdown.
    expect(collapsePresentationOf({ tick: 500, noProgressTicks: 300, riftCollapseTicks: 200, riftCollapseWarningEmitted: true })).toMatchObject({
      endcapWarned: true, endcapCollapseTicks: 200, ticksToWarning: 0,
    });
    // Pre-warning countdown: 250 no-progress ticks → 50 until the warning.
    expect(collapsePresentationOf({ tick: 500, noProgressTicks: 250 })).toMatchObject({
      endcapWarned: false, endcapCollapseTicks: 0, ticksToWarning: 50,
    });
  });

  it('carries the collapse presentation through the live bridge into the row', () => {
    const entry = encounterOutboundFromBattle({
      encounterId: 'encounter_fixture_waves',
      objective: 'complete_waves',
      tick: 92,
      phase: { phase: 'ACTIVE', endReason: null },
      bossPhase: null,
      modifierHookLog: [],
      events: [],
      timeCollapseSinceTick: 90,
      noProgressTicks: 12,
      riftCollapseTicks: 0,
      riftCollapseWarningEmitted: false,
    });
    expect(entry.collapse).toMatchObject({ active: true, sinceTick: 90, endcapCollapseTicks: 0, ticksToWarning: 288 });
    const rows = presentPhase21Report(Object.freeze({
      gate: 'G21-LIVE-BRIDGE',
      status: 'PASS',
      drift: 0,
      seededFailures: 0,
      perEncounter: Object.freeze({ encounter_fixture_waves: entry }),
    }));
    expect(rows[0]?.collapse?.active).toBe(true);
  });

  it('normalizes a FAIL row and an object-form terminal', () => {
    const report: Phase21OutboundReport = Object.freeze({
      gate: 'G21-CONTENT-LAUNCH',
      status: 'FAIL',
      drift: 0,
      seededFailures: 1,
      perEncounter: Object.freeze({
        encounter_fixture_waves: Object.freeze<EncounterOutbound>({
          objective: 'complete_waves',
          terminal: { phase: 'DRAW_ABORT', reason: 'rift_collapse_timeout' },
          ticks: 600,
          status: 'FAIL',
          hooks: [],
          bossPhase: null,
        }),
      }),
    });
    const rows = presentPhase21Report(report);
    expect(rows[0]).toEqual(Object.freeze({
      encounterId: 'encounter_fixture_waves',
      objective: 'complete_waves',
      terminalPhase: 'DRAW_ABORT',
      terminalReason: 'rift_collapse_timeout',
      ticks: 600,
      status: 'FAIL',
      isBossPhase: false,
      phasesDescended: false,
      phaseTrail: [],
      phaseTrailSecondary: [],
      hookTrace: [],
      phaseTrace: [],
      telegraphs: [],
    }));
  });
});
