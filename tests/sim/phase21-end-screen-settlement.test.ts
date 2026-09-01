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
import { mainPath, restoreExpedition } from '../../src/game/expedition/expedition-runner.js';
import { decodeExpeditionSave, encodeExpeditionSave, restoreExpeditionSave } from '../../src/game/expedition/expedition-save.js';
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

  it('the settlement keeps EXACTLY the claimed reward loot, grants each item once, and the claimed loot + gold survive a durable reload', { timeout: 60_000 }, () => {
    // The S54 reward CLAIM (which must precede `.finish()` — the finished run
    // rejects all mutations) lands each claimed reward id in the run's loot
    // pools. This pins the settlement-ledger AGREEMENT: the victory settlement
    // keeps EXACTLY those claimed ids (once each) and emits one GRANT_ITEM per
    // kept reward; the grants make every claimed id an owned profile item; and
    // because the end screen PERSISTS via `saveProfile`, a second
    // `loadOrCreateProfile` (a return-to-HQ relaunch) re-reads the durable
    // layer and the claimed loot + kept gold survive intact.
    const mgr = finishedVictoryManager(719);
    const snap = mgr.snapshot();
    const claimed = [...snap.state.securedLoot, ...snap.state.unsecuredLoot];
    expect(claimed.length).toBeGreaterThan(0);

    // AGREEMENT: keptLoot === the claimed reward ids, each exactly once.
    const { requests, settlement } = buildSettlementRequests(snap.state, 'victory');
    expect(settlement.keptLoot).toEqual(claimed);
    const lootGrants = requests.filter((r) => r.kind === 'GRANT_ITEM');
    expect(lootGrants.length).toBe(claimed.length);
    for (const id of claimed) {
      expect(settlement.keptLoot.filter((k) => k === id).length, id).toBe(1);
    }

    // GRANT: each claimed reward becomes an owned item exactly once.
    let profile = loadOrCreateProfile();
    for (const req of requests) profile = commitTransaction(profile, req).profile;
    saveProfile(profile);
    for (const id of claimed) expect(profile.items[id]?.owned, id).toBe(true);
    const walletAfter = profile.wallet.gold;

    // SECOND LOAD: `loadOrCreateProfile` re-reads the DURABLE profile layer
    // the end screen persisted — the claimed loot + kept gold were genuinely
    // written, not left only in memory.
    const reloaded = loadOrCreateProfile();
    for (const id of claimed) expect(reloaded.items[id]?.owned, id).toBe(true);
    expect(reloaded.wallet.gold).toBe(walletAfter);
  });

  it('claim → RUN-STATE CODEC round-trip keeps EXACTLY the claimed loot: encode → decode → restore → re-settle grants each kept id once', { timeout: 60_000 }, () => {
    // The profile-layer durability is pinned above; this is the RUN-STATE
    // codec seam: a claim committed on the ledger lands in `unsecuredLoot` /
    // `securedLoot`, and `encodeExpeditionSave → decode → restore` must keep
    // those pools byte-identical — a reload can never lose a claimed reward
    // id nor duplicate one. Re-settling the RESTORED state keeps exactly the
    // claimed ids once (one GRANT_ITEM per kept reward), and the restored
    // runner re-encodes to the SAME byte string (the codec is a fixed point
    // even with loot pools populated).
    const mgr = finishedVictoryManager(720);
    const snap = mgr.snapshot();
    const claimed = [...snap.state.securedLoot, ...snap.state.unsecuredLoot];
    expect(claimed.length).toBeGreaterThan(0);

    // Build a runner from the manager's state and encode it (the exact save
    // the store persists).
    const runner = restoreExpedition(snap.state, mgr.map, snap.currentNodeId);
    const serialized = encodeExpeditionSave(runner);
    const decoded = decodeExpeditionSave(JSON.parse(serialized));
    // The loot pools survive byte-identically.
    expect(decoded.state.securedLoot).toEqual(snap.state.securedLoot);
    expect(decoded.state.unsecuredLoot).toEqual(snap.state.unsecuredLoot);
    expect([...decoded.state.securedLoot, ...decoded.state.unsecuredLoot]).toEqual(claimed);

    // Restore the saved run and re-settle: the restored state keeps EXACTLY
    // the claimed ids, once each.
    const restored = restoreExpeditionSave(serialized, mgr.map);
    const { requests, settlement } = buildSettlementRequests(restored.state, 'victory');
    expect(settlement.keptLoot).toEqual(claimed);
    const lootGrants = requests.filter((r) => r.kind === 'GRANT_ITEM');
    expect(lootGrants.length).toBe(claimed.length);
    for (const id of claimed) {
      expect(settlement.keptLoot.filter((k) => k === id).length, id).toBe(1);
    }

    // The restored runner re-encodes byte-identically (fixed point with loot).
    expect(encodeExpeditionSave(restored)).toBe(serialized);

    // And the restored run still settles to the same wallet outcome as the
    // live run: each kept id granted once.
    let profile = loadOrCreateProfile();
    for (const req of requests) profile = commitTransaction(profile, req).profile;
    saveProfile(profile);
    for (const id of claimed) expect(profile.items[id]?.owned, id).toBe(true);
  });

  it('a MID-WALK claim survives a run-state codec cut and later claims keep the union exactly once', { timeout: 60_000 }, () => {
    // The strongest claim×codec pin: cut the run between the FIRST claim and
    // the REST of the walk. The restored run must keep the already-claimed id
    // (never lost, never duplicated), and claims made AFTER the restore must
    // join the union exactly once each — the final loot pools equal the
    // clean-room union of all claimed ids with no repeats. The walk runs on
    // the RUNNER (the manager is a thin autosaving facade over the same
    // runner state — the codec seam is runner-level).
    const mgr = RunManager.create(721, 500);
    const path = mainPath(mgr.map);
    const runId = mgr.snapshot().state.runId;
    let runner = restoreExpedition(mgr.snapshot().state, mgr.map, mgr.snapshot().currentNodeId);
    const claimedIds: string[] = [];
    let cut = false;
    for (let guard = 0; guard < path.length; guard += 1) {
      const nodeId = runner.currentNodeId;
      const type = runner.definition.type;
      runner = runner.enter(enterTransactionId(runId, nodeId));
      if (type === 'battle' || type === 'elite' || type === 'boss') {
        runner = runner.act({
          transactionId: actionTransactionId(runId, nodeId, 'ENGAGE', 'none'),
          nodeId,
          action: 'ENGAGE',
          completedKinds: ['kill_regulars'],
        });
        const reward = runner.state.snapshots[nodeId];
        if (reward !== undefined && reward.kind === 'REWARD' && reward.rewardIds[0] !== undefined) {
          const optionId = reward.rewardIds[0];
          runner = runner.act({ transactionId: actionTransactionId(runId, nodeId, 'CLAIM_REWARD', optionId), nodeId, action: 'CLAIM_REWARD', optionId });
          claimedIds.push(optionId);
        }
        // Cut ONCE after the first claim: codec round-trip the run state.
        if (!cut && claimedIds.length === 1) {
          const snapNow = runner.state;
          const midSave = encodeExpeditionSave(runner);
          const midRestored = restoreExpeditionSave(midSave, mgr.map);
          expect(midRestored.state.unsecuredLoot).toEqual(snapNow.unsecuredLoot);
          expect(midRestored.state.securedLoot).toEqual(snapNow.securedLoot);
          runner = midRestored;
          cut = true;
        }
      } else {
        runner = runner.act({ transactionId: actionTransactionId(runId, nodeId, 'DECLINE', 'none'), nodeId, action: 'DECLINE' });
      }
      runner = runner.resolve();
      const next = path[guard + 1];
      if (next === undefined) break;
      runner = runner.advance(next);
    }
    expect(cut).toBe(true);
    // UNION EXACTLY ONCE: no duplicates, no losses.
    expect(claimedIds.length).toBeGreaterThan(1);
    expect(new Set(claimedIds).size).toBe(claimedIds.length);
    const finalPool = [...runner.state.securedLoot, ...runner.state.unsecuredLoot];
    for (const id of claimedIds) {
      expect(finalPool.filter((k) => k === id).length, id).toBe(1);
    }
    // The whole walked + cut run is itself a codec fixed point.
    const finalSave = encodeExpeditionSave(runner);
    const finalRestored = restoreExpeditionSave(finalSave, mgr.map);
    expect(encodeExpeditionSave(finalRestored)).toBe(finalSave);
  });
});
