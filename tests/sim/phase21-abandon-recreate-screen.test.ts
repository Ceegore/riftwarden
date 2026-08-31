/**
 * Phase 21 §9 ABANDON → RESTORE → RE-CREATE CYCLE AT THE SCREEN LEVEL. The
 * finish/abandon race proves the MANAGER boundary; this drives the SCREEN
 * cycle: a mid-stack re-engage (one committed ENGAGE_DEFEAT on a battle node)
 * renders the re-engage panel exactly as NodeScreen derives it — then
 * `RunManager.abandon()` mid-walk must make the UI remount FRESH:
 *
 *   1. STALE — the mid-stack state's panel derivation shows the re-engaged
 *      stage ("Re-engaged — the battle replays identically.", next tax +10);
 *   2. ABANDON — `RunManager.abandon()`: no active instance, no save, the
 *      store is empty, `restore()` returns null — the half-committed rewatch
 *      cannot be reloaded;
 *   3. RE-CREATE — a fresh run boots with an EMPTY ledger and instability 0:
 *      the panel derivation is back at STAGE 0 (first tax +5, three attempts,
 *      no "Re-engaged"), and the REAL NodeScreen render shows the fresh
 *      mid-battle gate ("Battle in progress — ENGAGE unlocks on victory") and
 *      NEVER the stale re-engage text — the reload after abandon cannot
 *      resurrect the half-committed rewatch in the UI.
 */
import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { LocaleProvider } from '../../src/locales/locale-context.js';
import { LocaleController } from '../../src/locales/locale-state.js';
import { createLocaleRegistry } from '../../src/locales/registry.js';
import type { CompiledBundle, CompiledMessage, CompiledNode } from '../../src/locales/format/compiled-types.js';
import { RunManager } from '../../src/game/expedition/run-manager.js';
import { enterTransactionId, actionTransactionId } from '../../src/features/expedition/transaction-ids.js';
import { DEFEAT_INSTABILITY_DELTA, INSTABILITY_CEILING, MAX_REENGAGE_ATTEMPTS } from '../../src/game/expedition/nodes/handlers/combat.js';
import { DefeatPanel } from '../../src/features/battle/outbound/DefeatPanel.js';
import { NodeScreen } from '../../src/screens/run/NodeScreen.js';

const store = new Map<string, string>();
(globalThis as { localStorage: unknown }).localStorage = {
  getItem(key: string) { return store.get(String(key)) ?? null; },
  setItem(key: string, value: string) { store.set(String(key), String(value)); },
  removeItem(key: string) { store.delete(String(key)); },
  clear() { store.clear(); },
  get length() { return store.size; },
  key(index: number) { return [...store.keys()][index] ?? null; },
};
// Reduced motion → NodeScreen renders the plain tactical view (no Pixi canvas).
store.set('rw.a11y.v1', JSON.stringify({ reducedMotion: true }));

const text = (v: string): CompiledNode => ({ t: 'text' as const, v });
const arg = (n: string): CompiledNode => ({ t: 'arg' as const, n });

type ParamKinds = Record<string, 'string' | 'number'>;

function msg(ast: readonly CompiledNode[], parameters: ParamKinds = {}): CompiledMessage {
  return { ast, parameters, budget: '0', compactKey: null };
}

/** Everything NodeScreen + the DefeatPanel + the live outbound panel render. */
function bundle(): CompiledBundle {
  return {
    schemaVersion: 1,
    locale: 'en',
    kind: 'release_locale_bundle',
    messages: Object.freeze({
      'ui.expedition.engage': msg([text('Engage')]),
      'ui.expedition.reengage': msg([text('Re-engage')]),
      'ui.common.decline': msg([text('Decline')]),
      'ui.common.claim': msg([text('Claim')]),
      'ui.common.claimed': msg([text('Claimed')]),
      'ui.common.continue': msg([text('Continue')]),
      'ui.resource.gold': msg([text('Gold')]),
      'ui.resource.instability': msg([text('Instability')]),
      'ui.phase21.outbound.title': msg([text('Phase 21 content launch')]),
      'ui.phase21.outbound.count': msg([arg('count'), text(' encounters · '), arg('failed'), text(' failed')], { count: 'number', failed: 'number' }),
      'ui.phase21.meta.objective': msg([text('objective '), arg('objective')], { objective: 'string' }),
    }),
  };
}

function controller(): LocaleController {
  const b = bundle();
  const registry = createLocaleRegistry('development', {
    en: () => Promise.resolve(b),
    de: () => Promise.resolve(b),
    'qps-ploc': () => Promise.resolve(b),
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
    b,
  );
}

/** The DefeatPanel exactly as NodeScreen derives it from a run state at a node. */
function panelHtmlFrom(
  state: { readonly ledger: Readonly<Record<string, { readonly nodeId: string; readonly status: string; readonly action: string }>>; readonly instability: number },
  nodeId: string,
): string {
  const reengageCount = Object.values(state.ledger).filter(
    (entry) => entry.nodeId === nodeId && entry.status === 'COMMITTED' && entry.action === 'ENGAGE_DEFEAT',
  ).length;
  const ceilingBlocked = state.instability + DEFEAT_INSTABILITY_DELTA * (reengageCount + 1) > INSTABILITY_CEILING;
  return renderToStaticMarkup(createElement(LocaleProvider, {
    controller: controller(),
    children: createElement(DefeatPanel, {
      onReengage: () => undefined,
      instabilityDelta: DEFEAT_INSTABILITY_DELTA * (reengageCount + 1),
      reengaged: reengageCount > 0,
      attemptsRemaining: MAX_REENGAGE_ATTEMPTS - reengageCount,
      ceilingBlocked,
    }),
  }));
}

function panelHtml(mgr: RunManager): string {
  const snap = mgr.snapshot();
  return panelHtmlFrom(snap.state, snap.currentNodeId);
}

describe('P21 §9 abandon → restore → re-create cycle at the screen level', () => {
  it('abandon() mid re-engage stack remounts the UI FRESH: no stale panel, no save, a mid-battle reload cannot resurrect the rewatch', () => {
    // A mid-stack manager on seed 707 (start node = battle): ENTER + ONE
    // committed re-engage — the half-committed rewatch the UI must forget.
    store.clear();
    const mgr = RunManager.create(707, 300);
    const runId = mgr.snapshot().state.runId;
    const nodeId = mgr.snapshot().currentNodeId;
    expect(mgr.snapshot().currentNodeType).toBe('battle');
    mgr.enter(enterTransactionId(runId, nodeId));
    const reTx = actionTransactionId(runId, nodeId, 'ENGAGE_DEFEAT', 're-1');
    mgr.act({ transactionId: reTx, nodeId, action: 'ENGAGE_DEFEAT' });
    expect(mgr.snapshot().state.ledger[reTx]?.status).toBe('COMMITTED');

    // STALE: the panel derivation shows the re-engaged stage (one committed
    // rewatch → the next tax is +10).
    const staleHtml = panelHtml(mgr);
    expect(staleHtml).toContain('Re-engaged — the battle replays identically.');
    expect(staleHtml).toContain('Re-engage costs +10 instability (escalating).');
    // The stale panel's re-engage button is still ENABLED (2 attempts left).
    expect(staleHtml).toContain('Re-engage');
    expect(staleHtml).not.toContain('No re-engages left');

    // ABANDON mid-walk: no active instance, no save, empty store — the
    // half-committed rewatch is gone and cannot be reloaded.
    RunManager.abandon();
    expect(RunManager.active).toBeNull();
    expect(RunManager.hasSave()).toBe(false);
    expect(RunManager.restore()).toBeNull();
    expect(store.size).toBe(0);

    // RE-CREATE: a fresh run boots with an EMPTY ledger — the panel
    // derivation is back at STAGE 0, and the stale re-engage stage is
    // impossible. The fresh node is then entered naturally (the first step of
    // the new run) so the live screen can render its acting phase.
    const fresh = RunManager.create(707, 300);
    expect(fresh.snapshot().state.ledger).toEqual({});
    expect(fresh.snapshot().state.instability).toBe(0);
    fresh.enter(enterTransactionId(fresh.snapshot().state.runId, fresh.snapshot().currentNodeId));
    const freshHtml = panelHtml(fresh);
    // STAGE 0: the fresh defeat panel shows the plain defeat text + the
    // enabled re-engage affordance — the tax line only appears AFTER a
    // rewatch, so the stale "+10 instability" stage is impossible here.
    expect(freshHtml).toContain('Defeated — the node is gated; retreat or re-engage.');
    expect(freshHtml).toContain('Re-engage');
    expect(freshHtml).not.toContain('Re-engaged — the battle replays identically.');
    expect(freshHtml).not.toContain('+10 instability');

    // The REAL NodeScreen on the fresh run renders the fresh mid-battle gate —
    // and NEVER the stale re-engage panel (a mid-battle reload after abandon
    // would boot this exact fresh state, not the abandoned one).
    const screenHtml = renderToStaticMarkup(createElement(LocaleProvider, {
      controller: controller(),
      children: createElement(NodeScreen, { onResolved: () => undefined }),
    }));
    expect(screenHtml).toContain('Battle in progress — ENGAGE unlocks on victory');
    expect(screenHtml).not.toContain('Re-engaged — the battle replays identically.');
    expect(screenHtml).not.toContain('re-1');
    // The stale transaction id is not in the fresh ledger either.
    expect(fresh.snapshot().state.ledger[reTx]).toBeUndefined();
  });
});
