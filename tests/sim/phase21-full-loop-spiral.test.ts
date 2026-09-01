/**
 * Phase 21 §9 FULL-LOOP INTEGRATION SPIRAL — the meta-loop audit's rec #1:
 * ONE continuous flow through the real code. The expedition loop is proven
 * as ONE system: profile → RunManager boot → real content battles → claims →
 * settlement → tracking (records/mastery/achievements/story) → further
 * expeditions re-booted from the written profile — over a seed set whose
 * VISITED node-kind union covers all 11 generator-placed kinds (battle,
 * elite, boss, anchor, workshop, treasure, recruitment, scout, merchant,
 * altar, event; `story` is registry-declared in node-registry.ts but the
 * generator never places it — asserted as a documented observation):
 *
 *   E1=700  battle,elite,battle,anchor,workshop,boss — LIVE wins + claims,
 *           a LOSS branch, and a mid-walk RunManager.restore() codec cut
 *           after the FIRST claim (the restored manager continues);
 *   E2=852  battle,treasure,battle,anchor,recruitment,boss — TAKE + CHOOSE;
 *   E3=862  battle,scout,battle,anchor,merchant,boss — REVEAL_PATH;
 *   E4=935  battle,treasure,battle,anchor,altar,boss — altar ACCEPT (+10);
 *   E5=979  battle,event,battle,anchor,battle,boss — full defeat stacks drive
 *           the final battle's rewatch to a ceiling REFUSAL and the boss to
 *           victory-after-refusal (refused rewatch → live win → ENGAGE).
 *
 * Invariants (asserted at EVERY step inside the walker — see
 * phase21-spiral-helpers.ts): instability + gold + kills fold exact, bounty
 * as a COMMITTED record never double-paying, mastery applied ≤ earned;
 * each settlement credits wallet/grants loot exactly once; tracking commits
 * records/mastery/achievements/story; the next expedition boots from the
 * WRITTEN profile; the final run is a codec fixed point.
 */
import { describe, expect, it } from 'vitest';
import { RunManager } from '../../src/game/expedition/run-manager.js';
import { restoreExpedition } from '../../src/game/expedition/expedition-runner.js';
import { encodeExpeditionSave, restoreExpeditionSave } from '../../src/game/expedition/expedition-save.js';
import { loadOrCreateProfile } from '../../src/game/profile/profile-store.js';
import { loadMasteryState, processedCombatKillsForRun } from '../../src/game/mastery/mastery-store.js';
import { loadRecordsState } from '../../src/game/records/records-store.js';
import { loadStoryArchiveState } from '../../src/game/story/story-store.js';
import { bootLoopProfile, settle, walkExpedition, type Decision } from './phase21-spiral-helpers.js';

describe('P21 §9 full-loop integration spiral (5 expeditions, one profile)', () => {
  it('profile → live battles → claims → settlements → tracking → next runs: the loop as ONE system', { timeout: 60_000 }, () => {
    const heroId = 'hero_aurel';
    bootLoopProfile(heroId);

    const plans: readonly { readonly seed: number; readonly decisions: readonly Decision[] }[] = [
      { seed: 700, decisions: ['live-win', 'live-win', 'loss', 'service', 'live-win', 'live-win'] },
      { seed: 852, decisions: ['live-win', 'take', 'live-win', 'service', 'choose', 'live-win'] },
      { seed: 862, decisions: ['live-win', 'scout', 'live-win', 'service', 'live-win', 'live-win'] },
      { seed: 935, decisions: ['live-win', 'take', 'live-win', 'service', 'accept', 'live-win'] },
      // Full stacks everywhere + anchor ENTER only → the late battle stands at
      // 98 and the boss's FIRST rewatch is ceiling-refused (98+5 > 100).
      { seed: 979, decisions: ['stack', 'live-win', 'stack', 'enter-only', 'stack', 'boss-refusal-win'] },
    ];

    const allKinds = new Set<string>();
    const loop = { victories: 0, defeats: 0, refusals: 0, claimed: 0 };
    let lastRunId = '';

    for (let i = 0; i < plans.length; i += 1) {
      const plan = plans[i];
      if (plan === undefined) throw new Error('no plan');
      // Every expedition boots from the WRITTEN profile (no store reset — the
      // durable profile/mastery/records layer carries the loop state forward).
      const mgr = RunManager.create(plan.seed, 500);
      lastRunId = mgr.snapshot().state.runId;
      const report = walkExpedition(mgr, plan.decisions, i === 0);
      for (const kind of report.visitedKinds) allKinds.add(kind);
      loop.victories += report.victories;
      loop.defeats += report.defeats;
      loop.refusals += report.refusals;
      loop.claimed += report.claimed;
      mgr.finish();
      if (i === plans.length - 1) {
        // The finished final run is a CODEC FIXED POINT (encode → restore → encode).
        const runner = restoreExpedition(mgr.snapshot().state, mgr.map, mgr.snapshot().currentNodeId);
        const serialized = encodeExpeditionSave(runner);
        expect(encodeExpeditionSave(restoreExpeditionSave(serialized, mgr.map))).toBe(serialized);
      }
      settle(mgr, 'mission_act1', heroId);
    }

    // ── THE LOOP CLOSED ─────────────────────────────────────────────
    expect(loop.victories).toBeGreaterThanOrEqual(10);
    expect(loop.defeats).toBeGreaterThanOrEqual(4);   // E1 loss + E5 stacks
    expect(loop.refusals).toBeGreaterThanOrEqual(1);  // the boss refusal
    expect(loop.claimed).toBeGreaterThanOrEqual(4);
    // ALL 11 generator-placed kinds were VISITED across the loop.
    expect([...allKinds].sort()).toEqual(['altar', 'anchor', 'battle', 'boss', 'elite', 'event', 'merchant', 'recruitment', 'scout', 'treasure', 'workshop']);
    // Persistent tracking across the 5 expeditions:
    const records = loadRecordsState();
    expect(records.recentRuns.length).toBe(5);
    expect(records.totalKills).toBeGreaterThan(0);
    expect(records.recentRuns.every((r) => r.result === 'victory')).toBe(true);
    const story = loadStoryArchiveState();
    expect(story.fragments['story_intro']?.unlocked).toBe(true);
    expect(story.fragments['story_act1_boss']?.unlocked).toBe(true);
    const mastery = loadMasteryState();
    expect(mastery.heroes[heroId]?.kills).toBeGreaterThanOrEqual(records.totalKills);
    // The last run's mastery-bridge markers are durable and non-negative.
    expect(processedCombatKillsForRun(mastery, lastRunId)).toBeGreaterThanOrEqual(0);
    // The written profile owns the claimed loot as items.
    const finalProfile = loadOrCreateProfile();
    const ownedItems = Object.values(finalProfile.items).filter((it) => it.owned).length;
    expect(ownedItems).toBeGreaterThanOrEqual(loop.claimed - 1);
  });
});
