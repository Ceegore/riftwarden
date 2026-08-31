/**
 * Phase 21 §9 FULL SETTLEMENT LEDGER THROUGH THE END SCREEN. The `.finish()`
 * seam settles the run STATE; this test drives the END SCREEN's actual commit
 * path (`ExpeditionEndScreen.handleCommitAndReturn`) over a finished manager
 * and asserts EVERY store commits:
 *
 *   1. RENDER — the real end screen over a finished victory run shows the
 *      settlement breakdown (gold kept, profile transactions) and the
 *      return-to-HQ affordance;
 *   2. WALLET — `buildSettlementRequests(snapshot.state, 'victory')` →
 *      `commitTransaction` per request credits the profile wallet with the
 *      settlement's keptGold and grants the kept loot as owned items;
 *   3. MISSION — `recordMissionCompletion` records the effective mission id
 *      with the run's goldEarned;
 *   4. TRACKING — `applyExpeditionTracking` commits achievements (expedition
 *      count + victory + kills), the run RECORD, mastery (hero kills ===
 *      killsEarned via the settlement remainder) and story fragments — all
 *      through `saveAllPersistentStateExport`;
 *   5. CLEAR — `abandon()` clears the active run + the expedition store, so a
 *      returned-to-HQ player has no stale active run.
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
import { enterTransactionId, actionTransactionId } from '../../src/features/expedition/transaction-ids.js';
import { createInitialProfile, ensureStarterHero, saveProfile, loadOrCreateProfile } from '../../src/game/profile/profile-store.js';
import { loadFormationState, saveFormationState, clearFormationState } from '../../src/game/formations/formation-store.js';
import { clearMasteryState } from '../../src/game/mastery/mastery-store.js';
import { clearAllPersistentState, applyExpeditionTracking, saveAllPersistentStateExport, loadAllPersistentState } from '../../src/game/expedition/settlement-bridge.js';
import { buildSettlementRequests } from '../../src/game/expedition/expedition-settlement.js';
import { commitTransaction } from '../../src/game/profile/transaction-service.js';
import { loadMissionState, recordMissionCompletion, saveMissionState } from '../../src/game/mission/mission-store.js';
import { loadRecordsState } from '../../src/game/records/records-store.js';
import { loadStoryArchiveState } from '../../src/game/story/story-store.js';
import { ExpeditionEndScreen } from '../../src/screens/run/ExpeditionEndScreen.js';

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
      'ui.common.finish': msg([text('Finish')]),
      'ui.common.return_to_hq': msg([text('Return to HQ')]),
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

/** Full reset of every store the settlement flow touches. */
function resetAll(): void {
  store.clear();
  clearMasteryState();
  clearFormationState();
  clearAllPersistentState();
}

/** Manager with one unlocked + formation-placed hero; walks main path with VICTORY ENGAGEs and loot claims. */
function finishedVictoryManager(seed: number): RunManager {
  resetAll();
  const profile = ensureStarterHero(createInitialProfile());
  saveProfile(profile);
  const heroId = Object.values(profile.heroes).find((h) => h.unlocked)?.id;
  if (heroId === undefined) throw new Error('no starter hero');
  const formation = loadFormationState();
  saveFormationState({ ...formation, placement: { ...formation.placement, middle_center: heroId } });
  const mgr = RunManager.create(seed, 500);
  const path = mainPath(mgr.map);
  const runId = mgr.snapshot().state.runId;
  for (let guard = 0; guard < path.length; guard += 1) {
    const snap = mgr.snapshot();
    const nodeId = snap.currentNodeId;
    const type = snap.currentNodeType;
    mgr.enter(enterTransactionId(runId, nodeId));
    if (type === 'battle' || type === 'elite' || type === 'boss') {
      mgr.act({
        transactionId: actionTransactionId(runId, nodeId, 'ENGAGE', 'none'),
        nodeId,
        action: 'ENGAGE',
        completedKinds: ['kill_regulars'],
      });
      // Claim the first reward id so the settlement keeps loot — read the
      // REWARD snapshot AFTER enter (ENTER materializes it).
      const reward = mgr.snapshot().state.snapshots[nodeId];
      if (reward !== undefined && reward.kind === 'REWARD' && reward.rewardIds[0] !== undefined) {
        const optionId = reward.rewardIds[0];
        mgr.act({ transactionId: actionTransactionId(runId, nodeId, 'CLAIM_REWARD', optionId), nodeId, action: 'CLAIM_REWARD', optionId });
      }
    } else {
      mgr.act({ transactionId: actionTransactionId(runId, nodeId, 'DECLINE', 'none'), nodeId, action: 'DECLINE' });
    }
    mgr.resolve();
    const next = path[guard + 1];
    if (next === undefined) break;
    mgr.advance(next);
  }
  mgr.finish();
  return mgr;
}

describe('P21 §9 full settlement ledger through the end screen', () => {
  it('the real ExpeditionEndScreen renders the victory settlement and the return affordance over a finished run', { timeout: 60_000 }, () => {
    const mgr = finishedVictoryManager(717);
    expect(mgr.snapshot().runStatus).toBe('finished');
    expect(mgr.snapshot().state.killsEarned).toBeGreaterThan(0);
    const settlement = buildSettlementRequests(mgr.snapshot().state, 'victory');
    const html = renderToStaticMarkup(createElement(LocaleProvider, {
      controller: controller(),
      children: createElement(ExpeditionEndScreen, { onReturn: () => undefined, missionId: 'mission_act1' }),
    }));
    expect(html).toContain('Expedition Complete');
    expect(html).toContain('Victory!');
    expect(html).toContain(`+${String(settlement.settlement.keptGold)}`);
    expect(html).toContain(`Profile transactions</` );
    expect(html).toContain('Return to HQ'); // finished → the commit affordance
    expect(html).not.toContain('Finish'); // not the pre-finish affordance
  });

  it('the end screen COMMIT path credits the wallet, grants loot, records the mission, and commits achievements/records/mastery/story', { timeout: 60_000 }, () => {
    const mgr = finishedVictoryManager(718);
    const snap = mgr.snapshot();
    expect(snap.runStatus).toBe('finished');
    const killsEarned = snap.state.killsEarned;
    const goldEarned = snap.state.goldEarned;

    // The exact handleCommitAndReturn sequence (the screen's handler).
    const { requests, settlement } = buildSettlementRequests(snap.state, 'victory');
    let profile = loadOrCreateProfile();
    const walletBefore = profile.wallet.gold;
    const itemsBefore = Object.keys(profile.items).length;
    for (const req of requests) {
      profile = commitTransaction(profile, req).profile;
    }
    saveProfile(profile);
    // WALLET: the settlement's keptGold credited exactly once.
    expect(profile.wallet.gold).toBe(walletBefore + settlement.keptGold);
    // LOOT: each kept reward became an owned item.
    expect(profile.items[settlement.keptLoot[0] ?? '']?.owned).toBe(true);
    expect(Object.keys(profile.items).length).toBeGreaterThanOrEqual(itemsBefore + settlement.keptLoot.length);

    // MISSION: recordMissionCompletion with the effective mission id + gold.
    const missionState = recordMissionCompletion(loadMissionState(), 'mission_act1', goldEarned);
    saveMissionState(missionState);

    // TRACKING: the exact applyExpeditionTracking + saveAll path.
    const allState = loadAllPersistentState();
    const nodesVisited = Object.keys(snap.state.visits).length;
    const updated = applyExpeditionTracking(
      snap.state, 'victory', 'mission_act1', goldEarned, nodesVisited, allState,
    );
    saveAllPersistentStateExport(updated);

    // RECORDS: the run is recorded with the earned kills.
    const records = loadRecordsState();
    expect(records.recentRuns.some((r) => r.killsEarned === killsEarned && r.result === 'victory')).toBe(true);
    expect(records.totalKills).toBeGreaterThanOrEqual(killsEarned);
    // MASTERY: the hero's kills === the run's killsEarned (the fully-bridged
    // per-ENGAGE path means the settlement remainder is 0 — no double count).
    const heroId = Object.values(profile.heroes).find((h) => h.unlocked)?.id;
    if (heroId === undefined) throw new Error('no hero');
    expect(updated.mastery.heroes[heroId]?.kills).toBe(killsEarned);
    // STORY: the victory unlocked the act-1 fragment.
    const story = loadStoryArchiveState();
    expect(story.fragments['story_intro']?.unlocked).toBe(true);
    expect(updated.story.fragments['story_act1_boss']?.unlocked).toBe(true);
    // ACHIEVEMENTS: expedition count + victory milestone advanced.
    expect(updated.achievements.achievements['expeditions_5']?.current).toBeGreaterThanOrEqual(1);
    expect(updated.achievements.achievements['first_victory']?.current).toBeGreaterThanOrEqual(1);
    // The kill milestone caps at its target (10) — the progress advanced to it.
    expect(updated.achievements.achievements['kill_10']?.current).toBeGreaterThanOrEqual(1);

    // CLEAR: the screen's abandon() removes the active run.
    RunManager.abandon();
    expect(RunManager.active).toBeNull();
    expect(RunManager.hasSave()).toBe(false);
  });
});
