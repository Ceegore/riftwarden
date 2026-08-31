/**
 * Phase 21 §9 SETTLEMENT / MASTERY PARITY DIFFERENTIAL. The mastery differential
 * proved `masteryKillsApplied` (the per-ENGAGE bridge) catches up to `killsEarned`
 * exactly-once. This differential pins the LAST mastery-adjacent fold —
 * `masteryKillsRemaining`, computed inside `applyExpeditionTracking` at
 * settlement:
 *
 *     remaining = max(0, killsEarned - max(state.masteryKillsApplied,
 *                                          processedCombatKillsForRun(mastery, runId)))
 *
 *   1. PARITY — over the whole flow the per-hero kills granted (per-ENGAGE
 *      `recordCombatMasteryKills` deltas + the settlement remainder) fold
 *      EXACTLY to `killsEarned`, never more:`max`/`Math.max(0,…)` can never
 *      over-apply when the two sources are both ≤ the earned total;
 *   2. REMAINDER — a partially-bridged run leaves a positive remainder, and
 *      settlement applies it to every tracked hero and records a
 *      `runId:settlement` marker of exactly that remainder;
 *   3. FULLY-BRIDGED — when `state.masteryKillsApplied == killsEarned`, the
 *      remainder is 0: settlement adds nothing to any hero AND writes NO
 *      `settlement` marker (a dead `runId:settlement:0` marker must not appear);
 *   4. IDEMPOTENCE — settling the SAME state a second time is a no-op: the
 *      first pass wrote the `runId:settlement` marker, so the second pass sees
 *      `processedCombatKillsForRun` already covering the earned total and the
 *      remainder falls to 0 (no double-count);
 *   5. MARKER-MAX — the fold uses the GREATER of `state.masteryKillsApplied`
 *      and the durable store markers, so a store marker exceeding the scalar
 *      (e.g. a marker written without the scalar, as the settlement path does)
 *      still leaves the remainder at 0.
 */
import { describe, expect, it } from 'vitest';
import { applyExpeditionTracking, recordCombatMasteryKills, trackingHeroIds } from '../../src/game/expedition/settlement-bridge.js';
import type { NodeRunState } from '../../src/game/expedition/nodes/types.js';
import { loadMasteryState, saveMasteryState, processedCombatKillsForRun, clearMasteryState } from '../../src/game/mastery/mastery-store.js';
import { loadAchievementState } from '../../src/game/achievements/achievement-store.js';
import { loadCodexState } from '../../src/game/codex/codex-store.js';
import { loadRecordsState } from '../../src/game/records/records-store.js';
import { loadStoryArchiveState } from '../../src/game/story/story-store.js';
import { saveProfile, createInitialProfile, ensureStarterHero } from '../../src/game/profile/profile-store.js';

const store = new Map<string, string>();
(globalThis as { localStorage: unknown }).localStorage = {
  getItem(key: string) { return store.get(key) ?? null; },
  setItem(key: string, value: string) { store.set(key, value); },
  removeItem(key: string) { store.delete(String(key)); },
  clear() { store.clear(); },
  get length() { return store.size; },
  key(index: number) { return [...store.keys()][index] ?? null; },
};

function resetStores(): void {
  store.clear();
  clearMasteryState();
}

/** Build a minimal NodeRunState carrying only the fields settlement reads. */
function runState(runId: string, killsEarned: number, masteryKillsApplied: number): NodeRunState {
  return {
    revision: 1,
    runId,
    modeId: 'mode_expedition',
    contentRevision: 'r1',
    seed: 1,
    mapHash: 'h',
    gold: 0,
    instability: 0,
    goldEarned: 0,
    killsEarned,
    masteryKillsApplied,
    securedLoot: [],
    unsecuredLoot: [],
    relics: [],
    recruits: [],
    knowledge: [],
    troopCopies: {},
    visits: {},
    snapshots: {},
    ledger: {},
    runStatus: 'active',
  };
}

function buildAllState() {
  return {
    achievements: loadAchievementState(),
    codex: loadCodexState(),
    records: loadRecordsState(),
    mastery: loadMasteryState(),
    story: loadStoryArchiveState(),
  };
}

describe('P21 §9 settlement × mastery parity differential', () => {
  it('the settlement remainder folds with the per-ENGAGE bridge to EXACTLY killsEarned, never over', () => {
    resetStores();
    const heroId = 'hero_parity_a';
    saveProfile(ensureStarterHero(createInitialProfile()));
    const runId = 'run_parity_1';
    const killsEarned = 14;

    // Per-ENGAGE bridge already applied 6 of the 14 kills to the hero.
    const bridged = recordCombatMasteryKills([heroId], 6, runId, 'tx_engage_1');
    expect(bridged).toBe(true);
    const afterBridge = loadMasteryState();
    expect(afterBridge.heroes[heroId]?.kills).toBe(6);

    // Settlement over the same state → remaining = 14 - max(0, 6) = 8.
    const settled = applyExpeditionTracking(runState(runId, killsEarned, 0), 'victory', 'mission_act1', 42, 9, buildAllState(), [heroId]);
    expect(settled.mastery.heroes[heroId]?.kills).toBe(6 + 8);
    // Exactly ONE settlement marker, of exactly the remainder.
    expect(settled.mastery.processedCombatTransactions?.[`${runId}:settlement`]).toBe(8);
    // Total over ALL runId markers (engage 6 + settlement 8) == killsEarned.
    expect(processedCombatKillsForRun(settled.mastery, runId)).toBe(killsEarned);
  });

  it('a fully-bridged run has remainder 0 — settlement adds nothing and writes no settlement marker', () => {
    resetStores();
    const heroId = 'hero_parity_b';
    saveProfile(ensureStarterHero(createInitialProfile()));
    const runId = 'run_parity_2';
    const killsEarned = 9;

    // Bridge fully caught up to killsEarned.
    expect(recordCombatMasteryKills([heroId], killsEarned, runId, 'tx_engage_1')).toBe(true);
    expect(loadMasteryState().heroes[heroId]?.kills).toBe(killsEarned);

    // Settlement with state.masteryKillsApplied == killsEarned.
    const state = { ...runState(runId, killsEarned, killsEarned) };
    const settled = applyExpeditionTracking(state, 'victory', 'mission_act1', 12, 6, {
      achievements: loadAchievementState(),
      codex: loadCodexState(),
      records: loadRecordsState(),
      mastery: loadMasteryState(),
      story: loadStoryArchiveState(),
    }, [heroId]);

    // Remainder 0: no extra kills, and NO settlement marker.
    expect(settled.mastery.heroes[heroId]?.kills).toBe(killsEarned);
    expect(settled.mastery.processedCombatTransactions?.[`${runId}:settlement`]).toBeUndefined();
  });

  it('settling the same state twice never double-counts (settlement is idempotent)', () => {
    resetStores();
    const heroId = 'hero_parity_c';
    saveProfile(ensureStarterHero(createInitialProfile()));
    const runId = 'run_parity_3';
    const killsEarned = 20;

    const state = runState(runId, killsEarned, 0);
    const first = applyExpeditionTracking(state, 'victory', 'mission_act1', 40, 10, buildAllState(), [heroId]);
    const firstKills = first.mastery.heroes[heroId]?.kills ?? 0;
    expect(firstKills).toBe(killsEarned);
    expect(first.mastery.processedCombatTransactions?.[`${runId}:settlement`]).toBe(killsEarned);

    // Persist the first settlement's mastery, then settle the same run AGAIN.
    saveMasteryState(first.mastery);
    const second = applyExpeditionTracking(state, 'victory', 'mission_act1', 40, 10, buildAllState(), [heroId]);
    // The second pass sees the durable marker already covering the total → remainder 0.
    expect(second.mastery.heroes[heroId]?.kills).toBe(firstKills);
    // And the marker does not grow (still just the one settlement marker, unchanged).
    expect(second.mastery.processedCombatTransactions?.[`${runId}:settlement`]).toBe(killsEarned);
    // processedCombatKillsForRun never exceeds the earned total.
    expect(processedCombatKillsForRun(second.mastery, runId)).toBe(killsEarned);
  });

  it('the fold honours the GREATER of the scalar and the durable store markers', () => {
    resetStores();
    const heroId = 'hero_parity_d';
    saveProfile(ensureStarterHero(createInitialProfile()));
    const runId = 'run_parity_4';
    const killsEarned = 7;

    // The store has a marker covering ALL 7 (written without the scalar moving),
    // while state.masteryKillsApplied is only 3.
    saveMasteryState({
      heroes: { [heroId]: { heroId, kills: 7, expeditions: 0 } },
      processedCombatTransactions: { [`${runId}:tx_engage_9`]: 7 },
    });
    const state = runState(runId, killsEarned, 3);
    const settled = applyExpeditionTracking(state, 'victory', 'mission_act1', 30, 4, {
      achievements: loadAchievementState(),
      codex: loadCodexState(),
      records: loadRecordsState(),
      mastery: loadMasteryState(),
      story: loadStoryArchiveState(),
    }, [heroId]);
    // max(3, 7) = 7 → remaining = 0 → the hero gains nothing at settlement and
    // no settlement marker appears.
    expect(settled.mastery.heroes[heroId]?.kills).toBe(7);
    expect(settled.mastery.processedCombatTransactions?.[`${runId}:settlement`]).toBeUndefined();
    expect(processedCombatKillsForRun(settled.mastery, runId)).toBe(7);
  });

  it('a zero-kill run contributes nothing to mastery and writes no settlement marker', () => {
    resetStores();
    const heroId = 'hero_parity_e';
    saveProfile(ensureStarterHero(createInitialProfile()));
    const runId = 'run_parity_5';
    const settled = applyExpeditionTracking(runState(runId, 0, 0), 'retreat', 'mission_act1', 0, 2, buildAllState(), [heroId]);
    expect(settled.mastery.heroes[heroId]?.kills ?? 0).toBe(0);
    expect(settled.mastery.processedCombatTransactions?.[`${runId}:settlement`]).toBeUndefined();
    expect(processedCombatKillsForRun(settled.mastery, runId)).toBe(0);
    // The expedition count still advanced (mastery is touched, kills are not).
    expect(settled.mastery.heroes[heroId]?.expeditions).toBe(1);
  });

  it('trackingHeroIds de-duplicates explicit ids and falls back to unlocked placed heroes', () => {
    resetStores();
    expect(trackingHeroIds(['hero_a', 'hero_a', 'hero_b'])).toEqual(['hero_a', 'hero_b']);
    expect(trackingHeroIds([])).toEqual([]);
    expect(trackingHeroIds(undefined)).toHaveLength(0);
  });
});
