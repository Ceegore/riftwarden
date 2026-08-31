/**
 * Phase 21 §9 ENGAGE-GATE COMPONENT TEST. Renders the REAL NodeScreen
 * (react-dom/server, no jsdom) with a REAL expedition at a combat node and
 * pins the ENGAGE wiring the mapping test could not reach:
 *
 *   - the victory ENGAGE button is DISABLED while the live battle is still
 *     running, and the disabled button's description shows the gate reason
 *     ("Battle in progress — ENGAGE unlocks on victory") — never a silent
 *     lockout;
 *   - the mission bounty disclosure still renders beside the gate;
 *   - the exported `gateEngageAction` seam (which NodeScreen applies verbatim)
 *     pins every verdict × live-battle-present combination, including the
 *     stand-in feed (no live battle) keeping the legacy always-available
 *     affordance and the terminal VICTORY unlocking the button.
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
import { actionTransactionId, enterTransactionId } from '../../src/features/expedition/transaction-ids.js';
import { createLiveSimBattle, gateEngageAction, resolveExpeditionEncounter } from '../../src/features/battle/sim/sim-battle-host.js';
import { bountyForKinds } from '../../src/game/expedition/nodes/handlers/combat.js';
import { NodeScreen } from '../../src/screens/run/NodeScreen.js';
import { BattleResultScreen } from '../../src/screens/run/BattleResultScreen.js';
import { RewardChoiceScreen } from '../../src/screens/run/RewardChoiceScreen.js';

// NodeScreen reads the expedition store + a11y store through localStorage —
// provide the same mock the kernel project setup provides.
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

/** Minimal bundle: everything NodeScreen + the live outbound panel render for
 * a mid-battle combat node (missing key = L10N runtime error during render). */
function enBundle(): CompiledBundle {
  return {
    schemaVersion: 1,
    locale: 'en',
    kind: 'release_locale_bundle',
    messages: Object.freeze({
      'ui.expedition.engage': msg([text('Engage')]),
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

/** Walks a real RunManager to a combat node and ENTERs it (visit COMMITTED → acting phase). */
function enteredCombatManager(seed: number): RunManager {
  let mgr = RunManager.create(seed, 200);
  let guard = 0;
  while (!['battle', 'elite', 'boss'].includes(mgr.snapshot().currentNodeType) && guard < 80) {
    const snap = mgr.snapshot();
    const next = snap.reachableNodes[0];
    if (next === undefined) throw new Error('dead-end before combat');
    mgr.enter(enterTransactionId(snap.state.runId, snap.currentNodeId));
    mgr.resolve();
    mgr.advance(next);
    guard += 1;
  }
  const snap = mgr.snapshot();
  if (!['battle', 'elite', 'boss'].includes(snap.currentNodeType)) {
    throw new Error(`no combat node reached for seed ${String(seed)}`);
  }
  mgr.enter(enterTransactionId(snap.state.runId, snap.currentNodeId));
  return mgr;
}

/** Walks a real RunManager to the BOSS node (mandatory role) and ENTERs it. */
function enteredBossManager(seed: number): RunManager {
  let mgr = RunManager.create(seed, 200);
  let guard = 0;
  while (mgr.snapshot().currentNodeType !== 'boss' && guard < 80) {
    const snap = mgr.snapshot();
    const next = snap.reachableNodes[0];
    if (next === undefined) throw new Error('dead-end before boss');
    mgr.enter(enterTransactionId(snap.state.runId, snap.currentNodeId));
    mgr.resolve();
    mgr.advance(next);
    guard += 1;
  }
  const snap = mgr.snapshot();
  if (snap.currentNodeType !== 'boss') {
    throw new Error(`no boss node reached for seed ${String(seed)}`);
  }
  mgr.enter(enterTransactionId(snap.state.runId, snap.currentNodeId));
  return mgr;
}

describe('P21 §9 ENGAGE-gate component wiring', () => {
  it('the victory ENGAGE button is disabled mid-battle and explains itself', () => {
    enteredCombatManager(301);
    const html = renderToStaticMarkup(createElement(LocaleProvider, {
      controller: controller(),
      children: createElement(NodeScreen, { onResolved: () => undefined }),
    }));
    // The acting phase renders the ENGAGE + DECLINE buttons.
    expect(html).toContain('Engage');
    expect(html).toContain('Decline');
    // Mid-battle (live verdict ACTIVE): the ENGAGE button is disabled and its
    // description carries the gate reason — never a silent lockout.
    expect(html).toContain('Battle in progress — ENGAGE unlocks on victory');
    // The live outbound panel renders the encounter's mission objective.
    expect(html).toContain('Phase 21 content launch');
    // The bounty preview disclosure still renders beside the gate.
    expect(html).toContain('rw-mission-bounty');
    // The tactical view (reduced motion) replaces the canvas.
    expect(html).toContain('rw-tactical-view');
  });

  it('the post-ENGAGE reward screen renders the per-kind bounty breakdown from the persisted kinds', () => {
    // §9.5 Task 1 component proof: a victory ENGAGE persists its completed
    // kinds on the ledger; the reward screen derives the bounty AND renders
    // one breakdown row per paying kind with the contract amount.
    const mgr = enteredCombatManager(302);
    const snap = mgr.snapshot();
    mgr.act({
      transactionId: actionTransactionId(snap.state.runId, snap.currentNodeId, 'ENGAGE', 'none'),
      nodeId: snap.currentNodeId,
      action: 'ENGAGE',
      completedKinds: ['heal_sustain', 'kill_boss'],
    });
    const html = renderToStaticMarkup(createElement(LocaleProvider, {
      controller: controller(),
      children: createElement(RewardChoiceScreen, { onDone: () => undefined }),
    }));
    // The total + the per-kind rows (heal_sustain 10 + kill_boss 15 = 25).
    expect(html).toContain('Objective bounty');
    expect(html).toContain('+25 gold');
    expect(html).toContain('heal_sustain');
    expect(html).toContain('+10 gold');
    expect(html).toContain('kill_boss');
    expect(html).toContain('+15 gold');
    // The claim affordances for the persisted reward snapshot render too.
    expect(html).toContain('Claim');
  });

  it('the victory-reward FLOW renders S53 result then S54 reward with the same persisted bounty', () => {
    // §9.5 Task 2: after a victory ENGAGE the flow is NodeScreen → S53
    // BattleResultScreen → S54 RewardChoiceScreen. Both screens derive the
    // bounty from the SAME persisted ENGAGE record — the result screen shows
    // the total + per-kind rows, then the reward screen shows the same total +
    // per-kind rows + the claim affordances.
    const mgr = enteredCombatManager(303);
    const snap = mgr.snapshot();
    mgr.act({
      transactionId: actionTransactionId(snap.state.runId, snap.currentNodeId, 'ENGAGE', 'none'),
      nodeId: snap.currentNodeId,
      action: 'ENGAGE',
      completedKinds: ['kill_boss', 'survive_until'],
    });
    const renderFlow = (screen: JSX.Element): string => renderToStaticMarkup(createElement(LocaleProvider, {
      controller: controller(),
      children: screen,
    }));
    // S53: the result screen reads the visit's last committed transaction.
    const resultHtml = renderFlow(createElement(BattleResultScreen, { onContinue: () => undefined }));
    expect(resultHtml).toContain('Battle Result');
    expect(resultHtml).toContain('ENGAGE');
    expect(resultHtml).toContain('COMMITTED');
    expect(resultHtml).toContain('Objective bounty');
    expect(resultHtml).toContain('+25 gold'); // kill_boss 15 + survive_until 10
    expect(resultHtml).toContain('kill_boss bounty');
    expect(resultHtml).toContain('+15 gold');
    expect(resultHtml).toContain('survive_until bounty');
    expect(resultHtml).toContain('+10 gold');
    // S54: the reward screen derives the SAME bounty from the persisted kinds.
    const rewardHtml = renderFlow(createElement(RewardChoiceScreen, { onDone: () => undefined }));
    expect(rewardHtml).toContain('Choose Reward');
    expect(rewardHtml).toContain('Objective bounty');
    expect(rewardHtml).toContain('+25 gold');
    expect(rewardHtml).toContain('kill_boss');
    expect(rewardHtml).toContain('+15 gold');
    expect(rewardHtml).toContain('survive_until');
    expect(rewardHtml).toContain('+10 gold');
    // The claim affordances render (reward snapshot materialized at ENTER).
    expect(rewardHtml).toContain('Claim');
  });

  it('a BOSS node (duo encounter via classification) gates ENGAGE and discloses the kill_boss bounty', () => {
    // §9 Task 5: the boss node resolves its content encounter by classification
    // (the duo encounter — a boss with a secondary authority). The screen gates
    // ENGAGE mid-battle and discloses the mission's kill_boss bounty (15).
    const mgr = enteredBossManager(304);
    const snap = mgr.snapshot();
    const encounter = resolveExpeditionEncounter(snap.currentNodeType, snap.currentNodePayloadKey);
    expect(encounter).not.toBeNull();
    expect(encounter?.objective).toBe('defeat_boss');
    const html = renderToStaticMarkup(createElement(LocaleProvider, {
      controller: controller(),
      children: createElement(NodeScreen, { onResolved: () => undefined }),
    }));
    // Mid-battle gate on the boss fight.
    expect(html).toContain('Battle in progress — ENGAGE unlocks on victory');
    // The disclosure announces the kill_boss bounty (contract amount).
    expect(html).toContain('rw-mission-bounty');
    expect(html).toContain('On victory: +15 objective bounty (defeat_boss).');
  });

  it('the live duo battle runs to VICTORY with the kill_boss projection paying bounty 15', { timeout: 60_000 }, () => {
    // §9 Task 5 (live teeth): the boss node's REAL content battle — stepped to
    // its terminal through the live handle — completes the kill_boss objective
    // and the outbound carries the contract bounty (15), exactly what the
    // disclosure announced before ENGAGE.
    const mgr = enteredBossManager(305);
    const snap = mgr.snapshot();
    const encounter = resolveExpeditionEncounter(snap.currentNodeType, snap.currentNodePayloadKey);
    if (encounter === null) throw new Error('boss node resolved no encounter');
    const handle = createLiveSimBattle({ encounter });
    let out = handle.snapshot();
    let guard = 0;
    while (!['VICTORY', 'DEFEAT', 'DRAW_ABORT'].includes(out.phase.phase) && guard < 800) {
      out = handle.step();
      guard += 1;
    }
    expect(out.phase.phase).toBe('VICTORY');
    const killBoss = (out.objectives ?? []).find((o) => o.kind === 'kill_boss');
    expect(killBoss?.complete).toBe(true);
    // The live bounty equals the disclosed 15 — the wallet pays what was shown.
    expect(out.bounty).toBe(15);
    expect(out.bounty).toBe(bountyForKinds(['kill_boss']));
  });

  it('the reward FLOW renders the same bounty after a mid-flow RELOAD (persisted kinds, no re-battle)', () => {
    // §9 victory-reload render seam: the ENGAGE + its completedKinds are on the
    // ledger; a reload mid-flow (before the reward screens) restores the run and
    // BOTH S53/S54 must derive the SAME bounty from the persisted record — the
    // reload never re-battles (the visit is already past ENGAGE, still
    // COMMITTED with the durable last-commit marker).
    const mgr = enteredCombatManager(307);
    const snap = mgr.snapshot();
    mgr.act({
      transactionId: actionTransactionId(snap.state.runId, snap.currentNodeId, 'ENGAGE', 'none'),
      nodeId: snap.currentNodeId,
      action: 'ENGAGE',
      completedKinds: ['kill_boss', 'survive_until'],
    });
    // RELOAD: restore from the persisted save (the manager's boot path).
    const restored = RunManager.restore();
    expect(restored).not.toBeNull();
    const rSnap = restored?.snapshot();
    const rNodeId = rSnap?.currentNodeId ?? '';
    const engageTx = actionTransactionId(rSnap?.state.runId ?? '', rNodeId, 'ENGAGE', 'none');
    // The persisted ENGAGE + kinds + the durable last-commit marker survived.
    expect(rSnap?.state.ledger[engageTx]?.completedKinds).toEqual(['kill_boss', 'survive_until']);
    expect(rSnap?.state.visits[rNodeId]?.status).toBe('COMMITTED');
    expect(rSnap?.state.visits[rNodeId]?.transactionId).toBe(engageTx);
    const renderFlow = (screen: JSX.Element): string => renderToStaticMarkup(createElement(LocaleProvider, {
      controller: controller(),
      children: screen,
    }));
    // S53: the result screen derives the bounty from the RESTORED record.
    const resultHtml = renderFlow(createElement(BattleResultScreen, { onContinue: () => undefined }));
    expect(resultHtml).toContain('Objective bounty');
    expect(resultHtml).toContain('+25 gold'); // kill_boss 15 + survive_until 10
    expect(resultHtml).toContain('kill_boss bounty');
    expect(resultHtml).toContain('survive_until bounty');
    // S54: the reward screen shows the same total + per-kind rows + the claim
    // affordances (the REWARD snapshot materialized at ENTER survived too).
    const rewardHtml = renderFlow(createElement(RewardChoiceScreen, { onDone: () => undefined }));
    expect(rewardHtml).toContain('Objective bounty');
    expect(rewardHtml).toContain('+25 gold');
    expect(rewardHtml).toContain('kill_boss');
    expect(rewardHtml).toContain('survive_until');
    expect(rewardHtml).toContain('Claim');
  });

  it('after a mid-fight REFRESH the restored NodeScreen re-creates the same live battle and keeps ENGAGE gated', () => {
    // §9 mid-fight refresh: ENTER is committed and persisted (visit COMMITTED,
    // REWARD snapshot placed, no ENGAGE claimed); a page refresh drops the
    // in-memory manager and restores from the persisted save. NodeScreen then
    // re-resolves the encounter and re-creates the live battle from the
    // restored node — the gate must re-lock with the in-progress reason and
    // the re-created mid-battle UI must be byte-identical to the pre-refresh
    // render (a refresh never changes the fight).
    const mgr = enteredCombatManager(306);
    const before = mgr.snapshot();
    const renderNode = (): string => renderToStaticMarkup(createElement(LocaleProvider, {
      controller: controller(),
      children: createElement(NodeScreen, { onResolved: () => undefined }),
    }));
    const beforeHtml = renderNode();
    expect(beforeHtml).toContain('Battle in progress — ENGAGE unlocks on victory');
    // The persisted mid-battle state really is only the ENTER commit.
    expect(Object.values(before.state.ledger).some((e) => e.action === 'ENGAGE')).toBe(false);

    // REFRESH: restore from the persisted save (what continueRun does on boot).
    const restored = RunManager.restore();
    expect(restored).not.toBeNull();
    expect(restored?.snapshot().currentNodeId).toBe(before.currentNodeId);
    expect(restored?.snapshot().gold).toBe(before.gold);
    expect(restored?.snapshot().killsEarned).toBe(before.killsEarned);
    expect(restored?.snapshot().state.visits[before.currentNodeId]?.status).toBe('COMMITTED');

    const afterHtml = renderNode();
    // The re-created battle gates identically: same disabled ENGAGE, same
    // reason, same disclosure — byte-identical mid-battle UI across the reload.
    expect(afterHtml).toBe(beforeHtml);
  });

  it('the gate seam maps every verdict × live-battle combination', () => {
    const engage = Object.freeze({ action: 'ENGAGE', available: true });
    const decline = Object.freeze({ action: 'DECLINE', available: true });
    // Mid-battle with a live battle: gated with the explicit reason.
    expect(gateEngageAction(engage, true, 'active')).toEqual(
      Object.freeze({ action: 'ENGAGE', available: false, descriptionKey: 'Battle in progress — ENGAGE unlocks on victory' }),
    );
    // A terminal VICTORY unlocks ENGAGE.
    expect(gateEngageAction(engage, true, 'victory')).toEqual(engage);
    // A lost / aborted fight keeps it gated with the actionable reason.
    expect(gateEngageAction(engage, true, 'defeat')).toEqual(
      Object.freeze({ action: 'ENGAGE', available: false, descriptionKey: 'The battle was lost — re-engage or retreat' }),
    );
    expect(gateEngageAction(engage, true, 'abort')).toEqual(
      Object.freeze({ action: 'ENGAGE', available: false, descriptionKey: 'The battle aborted — retreat to continue' }),
    );
    // The stand-in feed (no live battle for the node) keeps the legacy
    // always-available affordance — unresolvable nodes cannot soft-lock.
    expect(gateEngageAction(engage, false, 'active')).toEqual(engage);
    expect(gateEngageAction(engage, false, 'defeat')).toEqual(engage);
    // Non-ENGAGE actions pass through untouched.
    expect(gateEngageAction(decline, true, 'active')).toEqual(decline);
  });
});
