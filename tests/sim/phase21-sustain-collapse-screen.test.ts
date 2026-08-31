/**
 * Phase 21 §10 SUSTAIN-COLLAPSE AT THE SCREEN LEVEL. The nine-encounter sweep
 * pinned the collapse fixture through the live handle; this test closes the
 * loop for what the SCREEN would do with that encounter on a battle node:
 *
 *   1. RESOLUTION — a battle node carrying `encounter_fixture_sustain_collapse`
 *      as its payload key resolves payload-key-first (the registry), so a
 *      sustain group in the map pool genuinely reaches the collapse fixture;
 *   2. LIVE TERMINAL — the battle the screen would own ends DEFEAT at the
 *      canonical tick 1985 with the §10 window opened at the content override
 *      (tick 1800) and the in-window death (the honest loss path);
 *   3. GATE — `battleResultOf` is 'defeat' → the ENGAGE gate closes with the
 *      explicit "lost — re-engage or retreat" reason (the screen's mapping);
 *   4. DEFEAT PANEL — the exact panel the screen renders at that verdict
 *      (retreat/re-engage affordance + the escalating +5 first tax);
 *   5. LOSS-PATH GATING — on the relabeled node a lost fight keeps the visit
 *      COMMITTED (advance throws) until the retreat clears it.
 */
import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { LocaleProvider } from '../../src/locales/locale-context.js';
import { LocaleController } from '../../src/locales/locale-state.js';
import { createLocaleRegistry } from '../../src/locales/registry.js';
import type { CompiledBundle, CompiledMessage, CompiledNode } from '../../src/locales/format/compiled-types.js';
import { createExpedition } from '../../src/game/expedition/expedition-runner.js';
import { generateMap } from '../../src/game/expedition/map-generator.js';
import type { ExpeditionMap, MapProfile } from '../../src/game/expedition/types.js';
import { createLiveSimBattle, battleResultOf, engageAvailableFor, gateEngageAction, resolveExpeditionEncounter } from '../../src/features/battle/sim/sim-battle-host.js';
import { DefeatPanel } from '../../src/features/battle/outbound/DefeatPanel.js';
import { bountyForKinds } from '../../src/game/expedition/nodes/handlers/combat.js';

const SUSTAIN_COLLAPSE = 'encounter_fixture_sustain_collapse';

const PROFILE: MapProfile = {
  id: 'exp-collapse-screen.v1',
  logicalLevels: 6,
  targetVisited: [5, 8] as const,
  mandatoryRoles: ['anchor', 'preparation', 'boss'],
  attemptCap: 50,
  fallbackTemplateId: 'fallback.v1',
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

/** Builds the relabeled map: the FIRST battle node carries the collapse payload key. */
function collapseMap(seed: number): { readonly map: ExpeditionMap; readonly battleId: string; readonly path: readonly string[] } {
  const base = generateMap({ seed, profileId: PROFILE.id, contentRevision: '32.0' }, PROFILE);
  let probe = createExpedition(base, { startGold: 200 });
  const path: string[] = [probe.currentNodeId];
  while (probe.handler.type !== 'battle') {
    const next = probe.reachableNodes[0];
    if (next === undefined) throw new Error('no path to a battle node');
    probe = probe.enter(`sc-walk-${String(path.length)}`).resolve().advance(next);
    path.push(next);
  }
  const battleId = probe.currentNodeId;
  const map: ExpeditionMap = {
    ...base,
    nodes: Object.freeze(base.nodes.map((n) => n.id === battleId ? { ...n, previewKey: SUSTAIN_COLLAPSE } : n)),
  };
  return { map, battleId, path };
}

describe('P21 §10 sustain-collapse at the screen level', () => {
  it('a battle node keyed to the collapse encounter resolves it, the live battle ends DEFEAT at 1985, and the gate closes', { timeout: 60_000 }, () => {
    const { map, battleId } = collapseMap(710);
    // 1. RESOLUTION: payload-key-first through the real registry.
    const encounter = resolveExpeditionEncounter('battle', SUSTAIN_COLLAPSE);
    expect(encounter).not.toBeNull();
    if (encounter === null) throw new Error('collapse node unresolved');
    expect(encounter.id).toBe(SUSTAIN_COLLAPSE);
    expect(encounter.objective).toBe('heal_sustain');
    // The relabeled map node carries the same key.
    const node = map.nodes.find((n) => n.id === battleId);
    expect(node?.previewKey).toBe(SUSTAIN_COLLAPSE);

    // 2. LIVE TERMINAL: the screen's battle ends DEFEAT at the canonical tick
    //    with the §10 window opened at the override (1800).
    const handle = createLiveSimBattle({ encounter });
    let out = handle.snapshot();
    let guard = 0;
    while (!['VICTORY', 'DEFEAT', 'DRAW_ABORT'].includes(out.phase.phase) && guard < 3000) {
      out = handle.step();
      guard += 1;
    }
    expect(out.phase.phase).toBe('DEFEAT');
    expect(out.tick).toBe(1985);
    expect(out.timeCollapseSinceTick).toBe(1800);
    // Nothing completed → the live bounty is zero (nothing can be claimed).
    expect((out.objectives ?? []).filter((o) => o.complete).map((o) => o.kind)).toEqual([]);
    expect(out.bounty).toBe(0);
    expect(out.bounty).toBe(bountyForKinds([]));

    // 3. GATE: the defeat verdict closes ENGAGE with the explicit reason — the
    //    exact mapping NodeScreen applies to this node's actions.
    expect(battleResultOf(out)).toBe('defeat');
    expect(engageAvailableFor('defeat')).toBe(false);
    const engage = Object.freeze({ action: 'ENGAGE', available: true });
    expect(gateEngageAction(engage, true, 'defeat')).toEqual(
      Object.freeze({ action: 'ENGAGE', available: false, descriptionKey: 'The battle was lost — re-engage or retreat' }),
    );
  });

  it('the DefeatPanel the screen renders at that verdict shows the retreat/re-engage affordance and the escalating tax', () => {
    const html = renderToStaticMarkup(createElement(LocaleProvider, {
      controller: controller(),
      children: createElement(DefeatPanel, {
        onReengage: () => undefined,
        instabilityDelta: 5,
        reengaged: false,
        attemptsRemaining: 3,
      }),
    }));
    expect(html).toContain('Defeated — the node is gated; retreat or re-engage.');
    expect(html).toContain('Re-engage');
    // The re-engage button is enabled with three attempts left.
    expect(html).not.toContain('No re-engages left');
    // After one rewatch the panel shows the escalating next cost (+10 = 5×2).
    const reengagedHtml = renderToStaticMarkup(createElement(LocaleProvider, {
      controller: controller(),
      children: createElement(DefeatPanel, {
        onReengage: () => undefined,
        instabilityDelta: 10,
        reengaged: true,
        attemptsRemaining: 2,
      }),
    }));
    expect(reengagedHtml).toContain('Re-engaged — the battle replays identically.');
    expect(reengagedHtml).toContain('Re-engage costs +10 instability (escalating).');
    // At the cap the affordance disables with the retreat-only message.
    const cappedHtml = renderToStaticMarkup(createElement(LocaleProvider, {
      controller: controller(),
      children: createElement(DefeatPanel, {
        onReengage: () => undefined,
        instabilityDelta: 15,
        reengaged: true,
        attemptsRemaining: 0,
      }),
    }));
    expect(cappedHtml).toContain('No re-engages left — retreat only.');
    expect(cappedHtml).toContain('disabled');
  });

  it('on the relabeled node a lost fight keeps the visit COMMITTED (advance throws) until the retreat clears it', { timeout: 60_000 }, () => {
    const { map, battleId, path } = collapseMap(711);
    let run = createExpedition(map, { startGold: 200 });
    for (const nodeId of path) {
      if (nodeId === battleId) break;
      const next = run.reachableNodes[0];
      if (next === undefined) throw new Error('path dead-end');
      run = run.enter(`sc-r-${nodeId}`).resolve().advance(next);
    }
    expect(run.currentNodeId).toBe(battleId);
    run = run.enter('sc-enter');
    expect(run.state.visits[battleId]?.status).toBe('COMMITTED');
    // The live verdict is a DEFEAT → resolveBattle(false) keeps the visit open.
    run = run.resolveBattle(false);
    expect(run.state.visits[battleId]?.status).toBe('COMMITTED');
    const onward = run.reachableNodes[0];
    if (onward !== undefined) {
      expect(() => run.advance(onward)).toThrow('VISIT_STATE_INVALID');
    }
    // The retreat clears the gated node: DECLINE → resolve → advance works.
    run = run.act({ transactionId: 'sc-retreat', nodeId: battleId, action: 'DECLINE' });
    run = run.resolve();
    expect(run.state.visits[battleId]?.status).toBe('RESOLVED');
    if (onward !== undefined) {
      expect(run.advance(onward).currentNodeId).toBe(onward);
    }
  });
});
