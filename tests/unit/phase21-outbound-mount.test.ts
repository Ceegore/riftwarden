import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { LocaleProvider } from '../../src/locales/locale-context.js';
import { LocaleController } from '../../src/locales/locale-state.js';
import { createLocaleRegistry } from '../../src/locales/registry.js';
import type { CompiledBundle, CompiledMessage, CompiledNode } from '../../src/locales/format/compiled-types.js';
import { Phase21OutboundPanel } from '../../src/features/battle/outbound/Phase21OutboundPanel.js';
import { LiveBattleOutboundPanel } from '../../src/features/battle/outbound/LiveBattleOutboundPanel.js';
import type { LiveOutboundInput, Phase21OutboundReport } from '../../src/features/battle/outbound/phase21-outbound-presenter.js';

/**
 * Phase 21 §9 mount test. Renders the REAL panel components (react-dom/server,
 * no jsdom) and asserts the markup the battle screen produces: the encounter
 * rows, the boss-phase trail, the modifier hook telegraphs and the full phase
 * trace. Proves the panel consumes the live bridge (`encounterOutboundFromBattle`
 * via LiveBattleOutboundPanel) exactly like a static launcher report — and that
 * the panel's visible words come from the `ui.phase21.*` locale bundle (a
 * missing key is a L10N runtime error, so rendering IS the battery).
 */

/** Minimal en bundle carrying every `ui.phase21.*` key the panel renders. */
const text = (v: string): CompiledNode => ({ t: 'text' as const, v });

function msg(ast: readonly CompiledNode[]): CompiledMessage {
  return { ast, parameters: {}, budget: '0', compactKey: null };
}

function enBundle(): CompiledBundle {
  return {
    schemaVersion: 1,
    locale: 'en',
    kind: 'release_locale_bundle',
    messages: Object.freeze({
      'ui.phase21.outbound.title': msg([text('Phase 21 content launch')]),
      'ui.phase21.outbound.encounters': msg([text('encounters')]),
      'ui.phase21.outbound.failed': msg([text('failed')]),
      'ui.phase21.meta.objective': msg([text('objective')]),
      'ui.phase21.ticks': msg([text('ticks')]),
      'ui.phase21.phase.current': msg([text('(current)')]),
      'ui.phase21.telegraph.prefix': msg([text('telegraph →')]),
      'ui.phase21.telegraph.resolves_in': msg([text('resolves in')]),
      'ui.phase21.telegraph.resolved_at': msg([text('resolved @')]),
      'ui.phase21.trace.planned': msg([text('planned')]),
      'ui.phase21.trace.telegraph': msg([text('telegraph')]),
      'ui.phase21.trace.exited': msg([text('exited')]),
      'ui.phase21.trace.entered': msg([text('entered')]),
    }),
  };
}

function controller(): LocaleController {
  const bundle = enBundle();
  const registry = createLocaleRegistry('development', {
    en: () => Promise.resolve(bundle),
    de: () => Promise.resolve(bundle),
    'qps-ploc': () => Promise.resolve(bundle),
  });
  return new LocaleController(
    registry,
    {
      captureContinuity: () => ({
        navigationSemanticId: null, modalStack: [], pendingTransactionId: null, recoveryState: null,
        focusedSemanticId: null, scrollAnchorSemanticId: null, saveGameFingerprint: '', simulationFingerprint: '',
      }),
      restoreFocusAndScroll: () => { /* no-op */ },
      persistLocale: () => Promise.resolve(),
    },
    'en',
    bundle,
  );
}

function renderPanel(report: Phase21OutboundReport): string {
  return renderToStaticMarkup(createElement(LocaleProvider, {
    controller: controller(),
    children: createElement(Phase21OutboundPanel, { report }),
  }));
}

function renderLive(input: LiveOutboundInput): string {
  return renderToStaticMarkup(createElement(LocaleProvider, {
    controller: controller(),
    children: createElement(LiveBattleOutboundPanel, { input }),
  }));
}

const LIVE_INPUT: LiveOutboundInput = Object.freeze({
  encounterId: 'encounter_fixture_boss_duo',
  objective: 'defeat_boss',
  tick: 92,
  phase: Object.freeze({ phase: 'ACTIVE', endReason: null }),
  bossPhase: Object.freeze({ phaseId: 'phase_duo_p3', visited: Object.freeze(['phase_duo_p1', 'phase_duo_p2', 'phase_duo_p3']), transition: false }),
  bossPhaseSecondary: Object.freeze({ phaseId: 'phase_duo_q2', visited: Object.freeze(['phase_duo_q1', 'phase_duo_q2']), transition: false }),
  modifierHookLog: Object.freeze([
    Object.freeze({ modifierId: 'mod_fixture_frenzy', hook: 'on_battle_start', atTick: 0 }),
    Object.freeze({ modifierId: 'mod_fixture_frenzy', hook: 'on_phase_entry', atTick: 46 }),
  ]),
  events: Object.freeze([
    Object.freeze({ type: 'PhaseTransitionPlanned', tick: 1, contentIds: Object.freeze(['boss_ash_unit', 'phase_duo_p1', 'phase_duo_p2']) }),
    Object.freeze({ type: 'BossTelegraphStarted', tick: 1, contentIds: Object.freeze(['boss_ash_unit', 'phase_duo_p2']), resolveTick: 46 }),
    Object.freeze({ type: 'BossPhaseStarted', tick: 46, contentIds: Object.freeze(['boss_ash_unit', 'phase_duo_p2']) }),
    Object.freeze({ type: 'BossPhaseStarted', tick: 92, contentIds: Object.freeze(['boss_ash_unit', 'phase_duo_p3']) }),
    // Mid-flight telegraph: planned at 92, resolves at 136 → 44 ticks remain.
    Object.freeze({ type: 'BossTelegraphStarted', tick: 92, contentIds: Object.freeze(['boss_ash_unit', 'phase_duo_p3']), resolveTick: 136 }),
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
      telegraphs: Object.freeze([
        Object.freeze(['phase_duo_p2', 1, 46] as const),
        Object.freeze(['phase_duo_p3', 46, 92] as const),
      ]),
    }),
  }),
});

describe('P21 §9 outbound panel mount', () => {
  it('renders a static launcher report into encounter rows with phase trail, hooks and trace', () => {
    const html = renderPanel(STATIC_REPORT);
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
    // The static report renders the telegraph countdown rows (both resolved).
    expect(html).toContain('rw-phase21-telegraphs');
    expect(html).toContain('resolved @ 46');
    expect(html).toContain('resolved @ 92');
  });

  it('the live-battle mount bridges a running battle into the exact same panel', () => {
    const html = renderLive(LIVE_INPUT);
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
    // The mid-flight telegraph at tick 92 counts down to its resolve tick 136.
    expect(html).toContain('rw-phase21-telegraphs');
    expect(html).toContain('phase_duo_p3');
    expect(html).toContain('resolves in 44 ticks');
    expect(html).toContain('resolved @ 46');
    // The duo's SECONDARY boss authority renders as its own trail.
    expect(html).toContain('boss phase trail (secondary)');
    expect(html).toContain('phase_duo_q1');
    expect(html).toContain('phase_duo_q2 (current)');
  });

  it('renders every visible word from the ui.phase21 locale keys (missing key = runtime error)', () => {
    const html = renderPanel(STATIC_REPORT);
    // Title + count words come from the bundle.
    expect(html).toContain('Phase 21 content launch');
    expect(html).toContain('1 encounters');
    expect(html).toContain('0 failed');
    // Meta, current-phase marker, telegraphs and trace labels all localized.
    expect(html).toContain('objective defeat_boss');
    expect(html).toContain('ticks');
    expect(html).toContain('(current)');
    expect(html).toContain('resolved @ 46');
    expect(html).toContain('planned');
    expect(html).toContain('entered');
    // Rendering above would throw L10N_RUNTIME_MISSING_KEY for any key the
    // panel references but the bundle does not declare — the battery holds.
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
    const html = renderLive(input);
    expect(html).toContain('encounter_fixture_first');
    expect(html).toContain('defeat_all');
    expect(html).not.toContain('rw-phase21-phases');
    expect(html).not.toContain('rw-phase21-hooks');
  });
});
