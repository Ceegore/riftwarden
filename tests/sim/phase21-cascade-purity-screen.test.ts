/**
 * Phase 21 §9 CASCADE-CLASS BOSS PURITY AT THE SCREEN LEVEL. The multi-seed
 * test proves the CASCADE class at the manager boundary (seed 900: the ceiling
 * binds EARLIER too — battle #2 gates at attempt 3, elite #2 at attempt 2 —
 * before the boss's FIRST re-engage is gated at attempt 1). This drives the
 * DefeatPanel EXACTLY as NodeScreen derives it at every combat node of that
 * walk, pinning that the UI reflects the CEILING CASCADE, not just the
 * single-seed purity path:
 *
 *   battle #1 (3 committed) → "No re-engages left — retreat only." (CAP)
 *   elite   #1 (3 committed) → CAP text
 *   battle #2 (2 committed, 3rd REJECTED at the ceiling) → ceiling text
 *   anchor SERVICE (−8)
 *   elite   #2 (1 committed, 2nd REJECTED at the ceiling) → ceiling text
 *   boss    (0 committed, 1st REJECTED at the ceiling) → ceiling text
 *
 * At every gated stage the panel renders "Instability ceiling reached —
 * retreat only." with the button DISABLED while the retreat (DECLINE) stays
 * legal — the cascade is a gate, never a soft-lock — and the run finishes.
 */
import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { LocaleProvider } from '../../src/locales/locale-context.js';
import { LocaleController } from '../../src/locales/locale-state.js';
import { createLocaleRegistry } from '../../src/locales/registry.js';
import type { CompiledBundle, CompiledMessage, CompiledNode } from '../../src/locales/format/compiled-types.js';
import { RunManager } from '../../src/game/expedition/run-manager.js';
import { mainPath } from '../../src/game/expedition/expedition-runner.js';
import { DefeatPanel } from '../../src/features/battle/outbound/DefeatPanel.js';
import { enterTransactionId, actionTransactionId } from '../../src/features/expedition/transaction-ids.js';
import { DEFEAT_INSTABILITY_DELTA, INSTABILITY_CEILING, MAX_REENGAGE_ATTEMPTS } from '../../src/game/expedition/nodes/handlers/combat.js';

const store = new Map<string, string>();
(globalThis as { localStorage: unknown }).localStorage = {
  getItem(key: string) { return store.get(String(key)) ?? null; },
  setItem(key: string, value: string) { store.set(String(key), String(value)); },
  removeItem(key: string) { store.delete(String(key)); },
  clear() { store.clear(); },
  get length() { return store.size; },
  key(index: number) { return [...store.keys()][index] ?? null; },
};

const text = (v: string): CompiledNode => ({ t: 'text' as const, v });
function msg(ast: readonly CompiledNode[]): CompiledMessage {
  return { ast, parameters: {}, budget: '0', compactKey: null };
}

function controller(): LocaleController {
  const bundle: CompiledBundle = {
    schemaVersion: 1,
    locale: 'en',
    kind: 'release_locale_bundle',
    messages: Object.freeze({
      'ui.expedition.reengage': msg([text('Re-engage')]),
      'ui.common.decline': msg([text('Decline')]),
    }),
  };
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

/** The DefeatPanel exactly as NodeScreen derives it from a run state at a node. */
function panelHtmlFrom(state: { readonly ledger: Readonly<Record<string, { readonly nodeId: string; readonly status: string; readonly action: string }>>; readonly instability: number }, nodeId: string): string {
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

const isCombat = (t: string): boolean => t === 'battle' || t === 'elite' || t === 'boss';

interface StageExpectation {
  readonly type: string;
  readonly committed: number;
  readonly text: string;
}

describe('P21 §9 cascade-class boss purity at the screen level (seed 900)', () => {
  it('the DefeatPanel as NodeScreen derives it shows the ceiling cascade: CAP on the full stacks, ceiling-blocked on the prior gated nodes AND the boss — retreat always legal, run finishes', { timeout: 60_000 }, () => {
    store.clear();
    const mgr = RunManager.create(900, 500);
    const path = mainPath(mgr.map);
    const runId = mgr.snapshot().state.runId;
    const seen: StageExpectation[] = [];
    const panels = new Map<string, string>();
    const gates: { readonly type: string; readonly attempt: number }[] = [];

    for (let guard = 0; guard < path.length; guard += 1) {
      const snap = mgr.snapshot();
      const nodeId = snap.currentNodeId;
      const type = snap.currentNodeType;
      mgr.enter(enterTransactionId(runId, nodeId));
      let committed = 0;
      if (isCombat(type)) {
        for (let attempt = 1; attempt <= MAX_REENGAGE_ATTEMPTS; attempt += 1) {
          const record = mgr.act({ transactionId: actionTransactionId(runId, nodeId, 'ENGAGE_DEFEAT', `p-${String(guard)}-${String(attempt)}`), nodeId, action: 'ENGAGE_DEFEAT' });
          if (record.status !== 'COMMITTED') {
            expect(record.reason, `reason ${type}@${String(guard)}`).toBe('OPTION_UNAVAILABLE');
            gates.push({ type, attempt });
            break;
          }
          committed += 1;
        }
        panels.set(String(guard), panelHtml(mgr));
        seen.push({ type, committed, text: panels.get(String(guard)) ?? '' });
        mgr.act({ transactionId: actionTransactionId(runId, nodeId, 'DECLINE', `pd-${String(guard)}`), nodeId, action: 'DECLINE' });
      } else if (type === 'anchor' || type === 'merchant') {
        const record = mgr.act({ transactionId: actionTransactionId(runId, nodeId, 'SERVICE', `ps-${String(guard)}`), nodeId, action: 'SERVICE' });
        if (record.status !== 'COMMITTED') {
          mgr.act({ transactionId: actionTransactionId(runId, nodeId, 'DECLINE', `px-${String(guard)}`), nodeId, action: 'DECLINE' });
        }
      } else {
        mgr.act({ transactionId: actionTransactionId(runId, nodeId, 'DECLINE', `py-${String(guard)}`), nodeId, action: 'DECLINE' });
      }
      mgr.resolve();
      const next = path[guard + 1];
      if (next === undefined) break;
      mgr.advance(next);
    }

    // The walk IS the cascade class: battle #2 gates at attempt 3, elite #2 at
    // attempt 2, the boss at attempt 1 (managed-boundary proof in the
    // multi-seed test — re-pinned here at the screen level).
    expect(gates).toEqual([
      { type: 'battle', attempt: 3 },
      { type: 'elite', attempt: 2 },
      { type: 'boss', attempt: 1 },
    ]);
    expect(seen.map((s) => [s.type, s.committed])).toEqual([
      ['battle', 3], ['elite', 3], ['battle', 2], ['elite', 1], ['boss', 0],
    ]);

    // THE SCREEN REFLECTS THE CASCADE:
    // 1–2. full stacks → the CAP stage ("No re-engages left") with the button
    //      disabled — the panel derives attemptsRemaining = 0.
    expect(seen[0]?.text.includes('No re-engages left — retreat only.')).toBe(true);
    expect(seen[0]?.text.includes('disabled')).toBe(true);
    expect(seen[1]?.text.includes('No re-engages left — retreat only.')).toBe(true);
    // 3. the FIRST cascade gate (battle #2, 2 committed, 3rd ceiling-rejected):
    //    the panel shows the CEILING stage, not the cap — the next tax (+15)
    //    would push 97 → 112 > 100.
    expect(seen[2]?.text).toContain('Instability ceiling reached — retreat only.');
    expect(seen[2]?.text).toContain('disabled');
    // 4. elite #2 (1 committed, 2nd ceiling-rejected): ceiling stage.
    expect(seen[3]?.text).toContain('Instability ceiling reached — retreat only.');
    expect(seen[3]?.text).toContain('disabled');
    // 5. THE BOSS (0 committed, 1st re-engage ceiling-blocked at 96+5 > 100):
    //    "retreat only" with the button disabled — a fresh node can NEVER show
    //    an enabled re-engage when the prior path already bound the ceiling.
    expect(seen[4]?.text).toContain('Instability ceiling reached — retreat only.');
    expect(seen[4]?.text).toContain('disabled');

    // The cascade is a gate, never a soft-lock: DECLINE was legal on every
    // gated node (the walk resolved above) and the run finishes cleanly.
    mgr.finish();
    expect(mgr.snapshot().runStatus).toBe('finished');
    expect(mgr.snapshot().state.instability).toBeLessThanOrEqual(INSTABILITY_CEILING);
  });
});