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

/** Minimal en bundle carrying every `ui.phase21.*` key the panel renders — the
 * parameterized messages declare their parameter kinds exactly like the
 * compiled pipeline, so passing the panel's params validates. */
const text = (v: string): CompiledNode => ({ t: 'text' as const, v });
const arg = (n: string): CompiledNode => ({ t: 'arg' as const, n });

type ParamKinds = Record<string, 'string' | 'number'>;

function msg(ast: readonly CompiledNode[], parameters: ParamKinds = {}): CompiledMessage {
  return { ast, parameters, budget: '0', compactKey: null };
}

function enBundle(): CompiledBundle {
  return {
    schemaVersion: 1,
    locale: 'en',
    kind: 'release_locale_bundle',
    messages: Object.freeze({
      'ui.phase21.outbound.title': msg([text('Phase 21 content launch')]),
      'ui.phase21.outbound.count': msg([arg('count'), text(' encounters · '), arg('failed'), text(' failed')], { count: 'number', failed: 'number' }),
      'ui.phase21.meta.objective': msg([text('objective '), arg('objective')], { objective: 'string' }),
      'ui.phase21.meta.terminal': msg([text('objective '), arg('objective'), text(' · '), arg('phase'), text(' · '), arg('ticks'), text(' ticks')], { objective: 'string', phase: 'string', ticks: 'number' }),
      'ui.phase21.meta.terminal_reason': msg([text('objective '), arg('objective'), text(' · '), arg('phase'), text(' ('), arg('reason'), text(') · '), arg('ticks'), text(' ticks')], { objective: 'string', phase: 'string', reason: 'string', ticks: 'number' }),
      'ui.phase21.phase.current': msg([text('(current)')]),
      'ui.phase21.telegraph.pending': msg([text('telegraph → '), arg('phase'), text(' · resolves in '), arg('ticks'), text(' ticks')], { phase: 'string', ticks: 'number' }),
      'ui.phase21.telegraph.resolved': msg([text('telegraph → '), arg('phase'), text(' · resolved @ '), arg('tick')], { phase: 'string', tick: 'number' }),
      'ui.phase21.hook.at': msg([arg('hook'), text(' @ '), arg('tick')], { hook: 'string', tick: 'number' }),
      'ui.phase21.collapse.active': msg([text('rift collapse — healing halved ('), arg('factorBps'), text('/10000), window ends in '), arg('ticks'), text(' ticks')], { ticks: 'number', factorBps: 'number' }),
      'ui.phase21.collapse.warning': msg([text('no progress — collapse countdown '), arg('ticks'), text('/'), arg('window')], { ticks: 'number', window: 'number' }),
      'ui.phase21.collapse.countdown': msg([text('no progress — warning in '), arg('ticks'), text('/'), arg('window'), text(' ticks')], { ticks: 'number', window: 'number' }),
      'ui.phase21.trace.at': msg([text('@ '), arg('tick')], { tick: 'number' }),
      'ui.phase21.trace.planned': msg([text('planned')]),
      'ui.phase21.heal.applied': msg([text('heal '), arg('target'), text(' +'), arg('healDelta')], { target: 'string', healDelta: 'number' }),
      'ui.phase21.heal.blocked': msg([text('lifesteal blocked on '), arg('target'), text(' ('), arg('healDelta'), text(' suppressed)')], { target: 'string', healDelta: 'number' }),
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
  // §10: collapse window opened at tick 90 (soft limit), 3 ticks elapsed — the
  // panel must render the healing-halved readout with the remaining window.
  timeCollapseSinceTick: 90,
  noProgressTicks: 0,
  riftCollapseTicks: 0,
  riftCollapseWarningEmitted: false,
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
    // §10 collapse readout: window active since tick 90 → halved heals with
    // 90 + 450 − 92 = 448 ticks remaining.
    expect(html).toContain('rw-phase21-collapse');
    expect(html).toContain('rift collapse — healing halved (5000/10000), window ends in 448 ticks');
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

  it('renders the §9.4 no-progress endcap warning and pre-warning countdown', () => {
    // Endcap warned: 200 ticks into the 300-tick collapse countdown (no §10
    // window state — the endcap path is the no-progress timeout, not the limit).
    const { timeCollapseSinceTick: _since, ...noWindow } = LIVE_INPUT;
    const warnedInput: LiveOutboundInput = Object.freeze({
      ...noWindow,
      noProgressTicks: 300,
      riftCollapseTicks: 200,
      riftCollapseWarningEmitted: true,
    });
    const warnedHtml = renderLive(warnedInput);
    expect(warnedHtml).toContain('rw-phase21-collapse');
    expect(warnedHtml).toContain('no progress — collapse countdown 200/300');
    // Pre-warning: 250 no-progress ticks → 50 ticks until the warning fires.
    const countdownInput: LiveOutboundInput = Object.freeze({
      ...noWindow,
      noProgressTicks: 250,
      riftCollapseTicks: 0,
      riftCollapseWarningEmitted: false,
    });
    const countdownHtml = renderLive(countdownInput);
    expect(countdownHtml).toContain('no progress — warning in 50/300 ticks');
    // Fresh battle (0 no-progress ticks, no window): no collapse readout at all.
    const freshHtml = renderLive(Object.freeze({ ...noWindow, noProgressTicks: 0 }));
    expect(freshHtml).not.toContain('rw-phase21-collapse');
  });

  it('renders the live heal stream (applied + §6 blocked) from ui.phase21.* keys', () => {
    const healInput: LiveOutboundInput = Object.freeze({
      ...LIVE_INPUT,
      healStream: Object.freeze([
        Object.freeze({ tick: 16, targetId: 'unit_p', delta: 150, blocked: false }),
        Object.freeze({ tick: 16, targetId: 'obj_immune_bridge', delta: 150, blocked: true }),
      ]),
    });
    const html = renderLive(healInput);
    expect(html).toContain('rw-phase21-heals');
    expect(html).toContain('heal unit_p +150');
    expect(html).toContain('lifesteal blocked on obj_immune_bridge (150 suppressed)');
    expect(html).toContain('rw-phase21-heal-blocked');
    // A missing ui.phase21.heal.* key here would be a L10N runtime error —
    // rendering the stream IS the battery for the block vs applied split.
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
