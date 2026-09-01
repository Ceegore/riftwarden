/**
 * Phase 21 §9 VICTORY-AFTER-REFUSAL AT THE SCREEN LEVEL. The manager-level
 * contract is pinned (victory-after-refusal); this drives it through the
 * real screens as NodeScreen derives them. On seed 903's bleed walk (PURE
 * class) the boss's FIRST re-engage is ceiling-refused at 97 — then:
 *
 *   1. the DefeatPanel EXACTLY as NodeScreen derives it renders the
 *      retreat-only stage with the button DISABLED — and a codec cut
 *      (`RunManager.restore()`) on the boundary re-derives the IDENTICAL
 *      panel (the refusal is durable in the UI, never a phantom);
 *   2. the ENGAGE gate on the SAME boss (verdict VICTORY) is AVAILABLE — the
 *      ceiling refusal never poisons the win affordance; the CONTRAST pins
 *      the screen-level separation: verdict DEFEAT keeps the win locked, a
 *      committed defeat at the manager level rejects ENGAGE (ACTION_LIMIT);
 *   3. the victory ENGAGE on the RESTORED manager pays exactly the disclosed
 *      bounty (15), and the REAL flow screens it derives — S53
 *      BattleResultScreen, then S54 RewardChoiceScreen — render the +15
 *      grant and the claim affordances: the UI never hides the win behind
 *      the refusal.
 */
import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import type { JSX } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { LocaleProvider } from '../../src/locales/locale-context.js';
import { LocaleController } from '../../src/locales/locale-state.js';
import { createLocaleRegistry } from '../../src/locales/registry.js';
import type { CompiledBundle, CompiledMessage, CompiledNode } from '../../src/locales/format/compiled-types.js';
import { RunManager } from '../../src/game/expedition/run-manager.js';
import { mainPath } from '../../src/game/expedition/expedition-runner.js';
import { DefeatPanel } from '../../src/features/battle/outbound/DefeatPanel.js';
import { gateEngageAction } from '../../src/features/battle/sim/sim-battle-host.js';
import { BattleResultScreen } from '../../src/screens/run/BattleResultScreen.js';
import { RewardChoiceScreen } from '../../src/screens/run/RewardChoiceScreen.js';
import { enterTransactionId, actionTransactionId } from '../../src/features/expedition/transaction-ids.js';
import { DEFEAT_INSTABILITY_DELTA, INSTABILITY_CEILING, MAX_REENGAGE_ATTEMPTS, bountyForKinds } from '../../src/game/expedition/nodes/handlers/combat.js';

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
const arg = (n: string): CompiledNode => ({ t: 'arg' as const, n });
type ParamKinds = Record<string, 'string' | 'number'>;
const msg = (ast: readonly CompiledNode[], parameters: ParamKinds = {}): CompiledMessage => ({ ast, parameters, budget: '0', compactKey: null });

function enBundle(): CompiledBundle {
  return {
    schemaVersion: 1, locale: 'en', kind: 'release_locale_bundle',
    messages: Object.freeze({
      'ui.expedition.reengage': msg([text('Re-engage')]),
      'ui.common.decline': msg([text('Decline')]),
      'ui.expedition.engage': msg([text('Engage')]),
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

const renderFlow = (screen: JSX.Element): string => renderToStaticMarkup(createElement(LocaleProvider, {
  controller: controller(),
  children: screen,
}));

/** The DefeatPanel exactly as NodeScreen derives it from a run state at a node. */
function panelHtmlFrom(state: { readonly ledger: Readonly<Record<string, { readonly nodeId: string; readonly status: string; readonly action: string }>>; readonly instability: number }, nodeId: string): string {
  const reengageCount = Object.values(state.ledger).filter(
    (entry) => entry.nodeId === nodeId && entry.status === 'COMMITTED' && entry.action === 'ENGAGE_DEFEAT',
  ).length;
  const ceilingBlocked = state.instability + DEFEAT_INSTABILITY_DELTA * (reengageCount + 1) > INSTABILITY_CEILING;
  return renderFlow(createElement(DefeatPanel, {
    onReengage: () => undefined,
    instabilityDelta: DEFEAT_INSTABILITY_DELTA * (reengageCount + 1),
    reengaged: reengageCount > 0,
    attemptsRemaining: MAX_REENGAGE_ATTEMPTS - reengageCount,
    ceilingBlocked,
  }));
}

function panelHtml(mgr: RunManager): string {
  const snap = mgr.snapshot();
  return panelHtmlFrom(snap.state, snap.currentNodeId);
}

describe('P21 §9 victory-after-refusal at the screen level (seed 903, PURE)', () => {
  it('the refused boss renders the retreat-only stage, a codec cut re-derives it byte-identically, the win gate unlocks on a VICTORY verdict, and the restored victory flow renders +15 + Claim', { timeout: 60_000 }, () => {
    store.clear();
    let mgr = RunManager.create(903, 500);
    const path = mainPath(mgr.map);
    const runId = mgr.snapshot().state.runId;
    const isCombat = (t: string): boolean => t === 'battle' || t === 'elite' || t === 'boss';
    let bossId = '';
    for (let guard = 0; guard < path.length; guard += 1) {
      const snap = mgr.snapshot();
      const nodeId = snap.currentNodeId;
      const type = snap.currentNodeType;
      mgr.enter(enterTransactionId(runId, nodeId));
      if (isCombat(type)) {
        let refused = false;
        for (let attempt = 1; attempt <= MAX_REENGAGE_ATTEMPTS; attempt += 1) {
          const record = mgr.act({ transactionId: actionTransactionId(runId, nodeId, 'ENGAGE_DEFEAT', `s-${String(guard)}-${String(attempt)}`), nodeId, action: 'ENGAGE_DEFEAT' });
          if (record.status !== 'COMMITTED') {
            expect(record.reason).toBe('OPTION_UNAVAILABLE');
            refused = true;
            break;
          }
        }
        if (type === 'boss') {
          expect(refused).toBe(true);
          expect(mgr.snapshot().state.instability).toBe(97);
          bossId = nodeId;
          break;
        }
        mgr.act({ transactionId: actionTransactionId(runId, nodeId, 'DECLINE', `sd-${String(guard)}`), nodeId, action: 'DECLINE' });
      } else if (type === 'anchor' || type === 'merchant') {
        const record = mgr.act({ transactionId: actionTransactionId(runId, nodeId, 'SERVICE', `ss-${String(guard)}`), nodeId, action: 'SERVICE' });
        if (record.status !== 'COMMITTED') {
          mgr.act({ transactionId: actionTransactionId(runId, nodeId, 'DECLINE', `sx-${String(guard)}`), nodeId, action: 'DECLINE' });
        }
      } else {
        mgr.act({ transactionId: actionTransactionId(runId, nodeId, 'DECLINE', `sy-${String(guard)}`), nodeId, action: 'DECLINE' });
      }
      mgr.resolve();
      mgr.advance(path[guard + 1] ?? nodeId);
    }
    expect(mgr.snapshot().currentNodeType).toBe('boss');

    // 1. The panel as NodeScreen derives it at the refused boss: retreat-only,
    // button disabled — never the capped stage (0 defeats → attempts remain).
    const html = panelHtml(mgr);
    expect(html).toContain('Instability ceiling reached — retreat only.');
    expect(html).toContain('disabled');
    expect(html).not.toContain('No re-engages left');

    // 1b. A codec cut on the refusal boundary re-derives the IDENTICAL panel.
    const restored = RunManager.restore();
    expect(restored).not.toBeNull();
    if (restored === null) throw new Error('restore failed');
    mgr = restored;
    expect(panelHtml(mgr)).toBe(html);

    // 2. The ENGAGE gate on the SAME boss: a VICTORY verdict unlocks the win —
    // the ceiling refusal never poisons the win affordance.
    const engage = Object.freeze({ action: 'ENGAGE', available: true });
    expect(gateEngageAction(engage, true, 'victory')).toEqual(engage);
    // The screen-level CONTRAST: a DEFEAT verdict keeps the win locked with the
    // actionable reason (the panel path), so the win exists ONLY via victory.
    expect(gateEngageAction(engage, true, 'defeat')).toEqual(
      Object.freeze({ action: 'ENGAGE', available: false, descriptionKey: 'The battle was lost — re-engage or retreat' }),
    );
    // The contract bounty the win pays is the disclosed one (contract amount).
    expect(bountyForKinds(['kill_boss'])).toBe(15);

    // 3. The victory ENGAGE on the RESTORED manager (zero committed defeats —
    // a REFUSED rewatch is never a verdict) pays exactly 15.
    const nodeId = bossId;
    const goldBefore = mgr.snapshot().state.gold;
    expect(goldBefore).toBe(470);
    const engageTx = actionTransactionId(mgr.snapshot().state.runId, nodeId, 'ENGAGE', 'win');
    const record = mgr.act({ transactionId: engageTx, nodeId, action: 'ENGAGE', completedKinds: ['kill_boss'] });
    expect(record.status).toBe('COMMITTED');
    expect(mgr.snapshot().state.gold).toBe(goldBefore + 15);

    // The flow screens NodeScreen derives next: S53 the result, S54 the reward.
    const resultHtml = renderFlow(createElement(BattleResultScreen, { onContinue: () => undefined }));
    expect(resultHtml).toContain('Objective bounty');
    expect(resultHtml).toContain('+15 gold');
    const rewardHtml = renderFlow(createElement(RewardChoiceScreen, { onDone: () => undefined }));
    expect(rewardHtml).toContain('Objective bounty');
    expect(rewardHtml).toContain('+15 gold');
    expect(rewardHtml).toContain('Claim');
    expect(rewardHtml).not.toContain('Instability ceiling reached');

    // The walk closes cleanly: fold exact, bound honoured, run finished.
    expect(mgr.snapshot().state.instability).toBeLessThanOrEqual(INSTABILITY_CEILING);
    mgr.finish();
    expect(mgr.snapshot().runStatus).toBe('finished');
  });
});
