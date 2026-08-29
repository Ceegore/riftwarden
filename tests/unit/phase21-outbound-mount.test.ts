import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Phase21OutboundPanel } from '../../src/features/battle/outbound/Phase21OutboundPanel.js';
import { LiveBattleOutboundPanel } from '../../src/features/battle/outbound/LiveBattleOutboundPanel.js';
import type { LiveOutboundInput, Phase21OutboundReport } from '../../src/features/battle/outbound/phase21-outbound-presenter.js';

/**
 * Phase 21 §9 mount test. Renders the REAL panel components (react-dom/server,
 * no jsdom) and asserts the markup the battle screen produces: the encounter
 * rows, the boss-phase trail, the modifier hook telegraphs and the full phase
 * trace. Proves the panel consumes the live bridge (`encounterOutboundFromBattle`
 * via LiveBattleOutboundPanel) exactly like a static launcher report.
 */

const LIVE_INPUT: LiveOutboundInput = Object.freeze({
  encounterId: 'encounter_fixture_boss_duo',
  objective: 'defeat_boss',
  tick: 92,
  phase: Object.freeze({ phase: 'ACTIVE', endReason: null }),
  bossPhase: Object.freeze({ phaseId: 'phase_duo_p3', visited: Object.freeze(['phase_duo_p1', 'phase_duo_p2', 'phase_duo_p3']), transition: false }),
  modifierHookLog: Object.freeze([
    Object.freeze({ modifierId: 'mod_fixture_frenzy', hook: 'on_battle_start', atTick: 0 }),
    Object.freeze({ modifierId: 'mod_fixture_frenzy', hook: 'on_phase_entry', atTick: 46 }),
  ]),
  events: Object.freeze([
    Object.freeze({ type: 'PhaseTransitionPlanned', tick: 1, contentIds: Object.freeze(['boss_ash_unit', 'phase_duo_p1', 'phase_duo_p2']) }),
    Object.freeze({ type: 'BossTelegraphStarted', tick: 1, contentIds: Object.freeze(['boss_ash_unit', 'phase_duo_p2']) }),
    Object.freeze({ type: 'BossPhaseStarted', tick: 46, contentIds: Object.freeze(['boss_ash_unit', 'phase_duo_p2']) }),
    Object.freeze({ type: 'BossPhaseStarted', tick: 92, contentIds: Object.freeze(['boss_ash_unit', 'phase_duo_p3']) }),
  ]),
});

const STATIC_REPORT: Phase21OutboundReport = Object.freeze({
  gate: 'G21-CONTENT-LAUNCH',
  status: 'PASS',
  drift: 0,
  seededFailures: 0,
  perEncounter: Object.freeze({
    encounter_fixture_boss_duo: Object.freeze({
      objective: 'defeat_boss',
      terminal: Object.freeze({ phase: 'VICTORY', reason: 'side_eliminated' }),
      ticks: 383,
      status: 'PASS',
      hooks: Object.freeze([Object.freeze(['mod_fixture_frenzy', 'on_battle_start', 0] as const)]),
      bossPhase: Object.freeze({ phaseId: 'phase_duo_p3', visited: Object.freeze(['phase_duo_p1', 'phase_duo_p2', 'phase_duo_p3']), transition: false }),
      phasesDescended: true,
      phaseTrace: Object.freeze([
        Object.freeze(['PhaseTransitionPlanned', 1, 'boss_ash_unit/phase_duo_p1/phase_duo_p2'] as const),
        Object.freeze(['BossTelegraphStarted', 1, 'boss_ash_unit/phase_duo_p2'] as const),
        Object.freeze(['BossPhaseStarted', 46, 'boss_ash_unit/phase_duo_p2'] as const),
        Object.freeze(['BossPhaseStarted', 92, 'boss_ash_unit/phase_duo_p3'] as const),
      ]),
    }),
  }),
});

describe('P21 §9 outbound panel mount', () => {
  it('renders a static launcher report into encounter rows with phase trail, hooks and trace', () => {
    const html = renderToStaticMarkup(createElement(Phase21OutboundPanel, { report: STATIC_REPORT }));
    expect(html).toContain('rw-phase21-outbound');
    expect(html).toContain('encounter_fixture_boss_duo');
    expect(html).toContain('defeat_boss');
    expect(html).toContain('VICTORY');
    expect(html).toContain('side_eliminated');
    expect(html).toContain('phase_duo_p1');
    expect(html).toContain('phase_duo_p3 (current)');
    expect(html).toContain('mod_fixture_frenzy');
    expect(html).toContain('on_battle_start');
    expect(html).toContain('telegraph');
    expect(html).toContain('entered');
  });

  it('the live-battle mount bridges a running battle into the exact same panel', () => {
    const html = renderToStaticMarkup(createElement(LiveBattleOutboundPanel, { input: LIVE_INPUT }));
    // Live bridge → same presentation: the panel shows the objective, the
    // full phase trail and the hook telegraphs of the running battle.
    expect(html).toContain('rw-phase21-outbound');
    expect(html).toContain('encounter_fixture_boss_duo');
    expect(html).toContain('defeat_boss');
    expect(html).toContain('phase_duo_p3 (current)');
    expect(html).toContain('mod_fixture_frenzy');
    expect(html).toContain('on_phase_entry');
    expect(html).toContain('telegraph');
    // A live ACTIVE battle has no terminal yet.
    expect(html).not.toContain('VICTORY');
    expect(html).not.toContain('side_eliminated');
  });

  it('a non-boss battle renders a row without phase machinery', () => {
    const input: LiveOutboundInput = Object.freeze({
      encounterId: 'encounter_fixture_first',
      objective: 'defeat_all',
      tick: 0,
      phase: Object.freeze({ phase: 'ACTIVE', endReason: null }),
      bossPhase: null,
      modifierHookLog: Object.freeze([]),
      events: Object.freeze([]),
    });
    const html = renderToStaticMarkup(createElement(LiveBattleOutboundPanel, { input }));
    expect(html).toContain('encounter_fixture_first');
    expect(html).toContain('defeat_all');
    expect(html).not.toContain('rw-phase21-phases');
    expect(html).not.toContain('rw-phase21-hooks');
  });
});
