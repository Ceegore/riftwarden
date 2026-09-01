/**
 * Phase 21 §9 FULL-LOOP SPIRAL — shared helpers for
 * `phase21-full-loop-spiral.test.ts` (split to stay under the repo's
 * 301-line file budget, same pattern as phase32-helpers.ts). Owns the
 * clean-room oracles (instability / gold / kills folds), the REAL-content
 * live-battle engine, the expedition walker with the mid-walk restore cut,
 * and the end-screen settlement commit path. The test file owns the plans
 * and the loop-level assertions.
 */
import { expect } from 'vitest';
import { RunManager } from '../../src/game/expedition/run-manager.js';
import { mainPath } from '../../src/game/expedition/expedition-runner.js';
import { enterTransactionId, actionTransactionId } from '../../src/features/expedition/transaction-ids.js';
import { saveProfile, loadOrCreateProfile, createInitialProfile, ensureStarterHero } from '../../src/game/profile/profile-store.js';
import { saveFormationState, clearFormationState, loadFormationState } from '../../src/game/formations/formation-store.js';
import { clearMasteryState } from '../../src/game/mastery/mastery-store.js';
import { clearAllPersistentState, applyExpeditionTracking, saveAllPersistentStateExport, loadAllPersistentState } from '../../src/game/expedition/settlement-bridge.js';
import { buildSettlementRequests } from '../../src/game/expedition/expedition-settlement.js';
import { commitTransaction } from '../../src/game/profile/transaction-service.js';
import { recordMissionCompletion, saveMissionState, loadMissionState } from '../../src/game/mission/mission-store.js';
import { createLiveSimBattle, resolveExpeditionEncounter } from '../../src/features/battle/sim/sim-battle-host.js';
import { bountyForKinds, INSTABILITY_CEILING, MAX_REENGAGE_ATTEMPTS } from '../../src/game/expedition/nodes/handlers/combat.js';
import { MERCHANT_SERVICE_PRICE_GOLD } from '../../src/game/expedition/offers/offer-service.js';
import type { TransactionRecord } from '../../src/game/expedition/nodes/types.js';
import type { ExpeditionMap } from '../../src/game/expedition/types.js';

const store = new Map<string, string>();
(globalThis as { localStorage: unknown }).localStorage = {
  getItem(key: string) { return store.get(String(key)) ?? null; },
  setItem(key: string, value: string) { store.set(String(key), String(value)); },
  removeItem(key: string) { store.delete(String(key)); },
  clear() { store.clear(); },
  get length() { return store.size; },
  key(index: number) { return [...store.keys()][index] ?? null; },
};

/** Full store reset + one unlocked, formation-placed hero on the profile. */
export function bootLoopProfile(heroId: string): void {
  store.clear();
  clearMasteryState();
  clearFormationState();
  clearAllPersistentState();
  saveProfile(ensureStarterHero(createInitialProfile()));
  saveFormationState({ ...loadFormationState(), placement: { ...loadFormationState().placement, middle_center: heroId } });
}

const ENTER_DELTA_BY_TYPE: Readonly<Record<string, number>> = Object.freeze({
  battle: 5, elite: 12, boss: 0, event: 3, merchant: 3, recruitment: 4,
  treasure: 5, workshop: 2, altar: 8, scout: 2, anchor: -10, story: 0,
});

function typeOf(map: ExpeditionMap, nodeId: string): string {
  const node = map.nodes.find((candidate) => candidate.id === nodeId);
  return node?.type ?? 'story';
}

/** Clean-room instability fold: ENTER registry + 5×k defeats + services + altar ACCEPT. */
export function foldInstability(map: ExpeditionMap, ledger: Readonly<Record<string, TransactionRecord>>): number {
  let instability = 0;
  const defeatCountByNode = new Map<string, number>();
  for (const entry of Object.values(ledger)) {
    if (entry.status !== 'COMMITTED') continue;
    const type = typeOf(map, entry.nodeId);
    let delta = 0;
    if (entry.action === 'ENTER') {
      delta = ENTER_DELTA_BY_TYPE[type] ?? 0;
    } else if (entry.action === 'ENGAGE_DEFEAT') {
      const attempt = (defeatCountByNode.get(entry.nodeId) ?? 0) + 1;
      defeatCountByNode.set(entry.nodeId, attempt);
      delta = 5 * attempt;
    } else if (entry.action === 'SERVICE') {
      delta = type === 'merchant' ? -10 : type === 'anchor' ? -8 : 0;
    } else if (entry.action === 'ACCEPT' && type === 'altar') {
      delta = 10;
    }
    instability = Math.max(0, instability + delta);
  }
  return instability;
}

interface FoldSource {
  readonly ledger: Readonly<Record<string, TransactionRecord>>;
  readonly snapshots: Readonly<Record<string, { readonly kind: string; readonly rollSlots?: Readonly<Record<string, number>> }>>;
}

/** Victory-ENGAGE base gold from the materialized REWARD snapshot (the real
 * handler: battle 45 + roll%26, elite 90 + roll%51, boss 0 — goldMin 0). */
function baseVictoryGold(type: string, snapshots: FoldSource['snapshots'], nodeId: string): number {
  const roll = snapshots[nodeId]?.rollSlots?.['gold'] ?? 0;
  if (type === 'battle') return 45 + (roll % 26);
  if (type === 'elite') return 90 + (roll % 51);
  return 0;
}

/** Victory-ENGAGE kills from the same roll slot (battle 3 + roll%4; else 5 + roll%8). */
function killsForEngage(type: string, snapshots: FoldSource['snapshots'], nodeId: string): number {
  const roll = snapshots[nodeId]?.rollSlots?.['gold'] ?? 0;
  if (type === 'battle') return 3 + (roll % 4);
  return 5 + (roll % 8);
}

/** Clean-room gold fold: start − 30×services + Σ (base + bounty) of committed victory ENGAGEs. */
export function foldGold(start: number, map: ExpeditionMap, src: FoldSource): number {
  let gold = start;
  for (const entry of Object.values(src.ledger)) {
    if (entry.status !== 'COMMITTED') continue;
    if (entry.action === 'SERVICE') gold -= MERCHANT_SERVICE_PRICE_GOLD;
    if (entry.action === 'ENGAGE') gold += baseVictoryGold(typeOf(map, entry.nodeId), src.snapshots, entry.nodeId) + bountyForKinds(entry.completedKinds ?? []);
  }
  return gold;
}

/** Clean-room kills fold: Σ kills awarded by committed victory ENGAGEs. */
export function foldKills(map: ExpeditionMap, src: FoldSource): number {
  let kills = 0;
  for (const entry of Object.values(src.ledger)) {
    if (entry.status !== 'COMMITTED' || entry.action !== 'ENGAGE') continue;
    kills += killsForEngage(typeOf(map, entry.nodeId), src.snapshots, entry.nodeId);
  }
  return kills;
}

export interface RunReport {
  visitedKinds: readonly string[];
  victories: number;
  defeats: number;
  refusals: number;
  claimed: number;
}

export type Decision =
  | 'live-win'
  | 'loss'
  | 'stack'           // full 3-attempt defeat stack (rewatch ceiling)
  | 'service'         // anchor/merchant SERVICE
  | 'enter-only'      // anchor ENTER only, decline the service
  | 'accept'          // altar ACCEPT
  | 'choose'          // recruitment CHOOSE offer 0 (free)
  | 'take'            // treasure TAKE
  | 'scout'           // scout REVEAL_PATH
  | 'boss-refusal-win'; // refused first rewatch → live win → ENGAGE

/** Step the node's REAL content battle to its terminal; returns the live kinds. */
export function liveKinds(mgr: RunManager): readonly string[] {
  const snap = mgr.snapshot();
  const encounter = resolveExpeditionEncounter(snap.currentNodeType, snap.currentNodePayloadKey);
  if (encounter === null) throw new Error('node resolved no encounter');
  const handle = createLiveSimBattle({ encounter });
  let out = handle.snapshot();
  let guard = 0;
  while (!['VICTORY', 'DEFEAT', 'DRAW_ABORT'].includes(out.phase.phase) && guard < 4000) {
    out = handle.step();
    guard += 1;
  }
  expect(out.phase.phase).toBe('VICTORY');
  return (out.objectives ?? []).filter((o) => o.complete).map((o) => o.kind);
}

/** Walk one expedition through the REAL manager; `cutAfterFirstClaim` inserts
 * a RunManager.restore() codec cut mid-walk and continues on the restored
 * manager. Folds asserted at EVERY step. */
export function walkExpedition(mgr: RunManager, decisions: readonly Decision[], cutAfterFirstClaim = false): RunReport {
  const path = mainPath(mgr.map);
  const runId = mgr.snapshot().state.runId;
  const start = mgr.snapshot().state.gold;
  const visitedKinds = new Set<string>();
  const report: RunReport = { visitedKinds: [], victories: 0, defeats: 0, refusals: 0, claimed: 0 };
  const isCombat = (t: string): boolean => t === 'battle' || t === 'elite' || t === 'boss';
  const claimFirstReward = (): void => {
    const nodeId = mgr.snapshot().currentNodeId;
    const reward = mgr.snapshot().state.snapshots[nodeId];
    if (reward?.kind === 'REWARD' && reward.rewardIds[0] !== undefined) {
      const optionId = reward.rewardIds[0];
      const claim = mgr.act({ transactionId: actionTransactionId(runId, nodeId, 'CLAIM_REWARD', optionId), nodeId, action: 'CLAIM_REWARD', optionId });
      expect(claim.status).toBe('COMMITTED');
      report.claimed += 1;
    }
  };
  const assertFolds = (label: string): void => {
    const snap = mgr.snapshot();
    const src: FoldSource = { ledger: snap.state.ledger, snapshots: snap.state.snapshots };
    expect(snap.state.instability, `${label} instability fold`).toBe(foldInstability(mgr.map, src.ledger));
    expect(snap.state.gold, `${label} gold fold`).toBe(foldGold(start, mgr.map, src));
    expect(snap.state.killsEarned, `${label} kills fold`).toBe(foldKills(mgr.map, src));
    expect(snap.state.instability, `${label} ≤ ceiling`).toBeLessThanOrEqual(INSTABILITY_CEILING);
    expect(snap.state.gold, `${label} gold ≥ 0`).toBeGreaterThanOrEqual(0);
    expect(snap.state.masteryKillsApplied, `${label} applied ≤ earned`).toBeLessThanOrEqual(snap.state.killsEarned);
  };
  for (let guard = 0; guard < path.length; guard += 1) {
    const snap = mgr.snapshot();
    const nodeId = snap.currentNodeId;
    const type = snap.currentNodeType;
    visitedKinds.add(type);
    const decision = decisions[guard] ?? 'live-win';
    mgr.enter(enterTransactionId(runId, nodeId));
    assertFolds(`enter ${type}@${String(guard)}`);
    if (isCombat(type)) {
      if (decision === 'loss') {
        const lost = mgr.act({ transactionId: actionTransactionId(runId, nodeId, 'ENGAGE_DEFEAT', `l-${String(guard)}`), nodeId, action: 'ENGAGE_DEFEAT' });
        expect(lost.status).toBe('COMMITTED');
        report.defeats += 1;
        mgr.act({ transactionId: actionTransactionId(runId, nodeId, 'DECLINE', `dl-${String(guard)}`), nodeId, action: 'DECLINE' });
      } else if (decision === 'stack') {
        for (let attempt = 1; attempt <= MAX_REENGAGE_ATTEMPTS; attempt += 1) {
          const record = mgr.act({ transactionId: actionTransactionId(runId, nodeId, 'ENGAGE_DEFEAT', `s-${String(guard)}-${String(attempt)}`), nodeId, action: 'ENGAGE_DEFEAT' });
          if (record.status !== 'COMMITTED') {
            expect(record.reason).toBe('OPTION_UNAVAILABLE');
            report.refusals += 1;
            break;
          }
          report.defeats += 1;
        }
        mgr.act({ transactionId: actionTransactionId(runId, nodeId, 'DECLINE', `ds-${String(guard)}`), nodeId, action: 'DECLINE' });
      } else {
        if (decision === 'boss-refusal-win') {
          const refused = mgr.act({ transactionId: actionTransactionId(runId, nodeId, 'ENGAGE_DEFEAT', `r-${String(guard)}`), nodeId, action: 'ENGAGE_DEFEAT' });
          expect(refused.status).toBe('REJECTED');
          expect(refused.reason).toBe('OPTION_UNAVAILABLE');
          report.refusals += 1;
        }
        const kinds = liveKinds(mgr);
        const record = mgr.act({ transactionId: actionTransactionId(runId, nodeId, 'ENGAGE', `w-${String(guard)}`), nodeId, action: 'ENGAGE', completedKinds: kinds });
        expect(record.status).toBe('COMMITTED');
        report.victories += 1;
        claimFirstReward();
        if (cutAfterFirstClaim && report.claimed === 1) {
          const restored = RunManager.restore();
          expect(restored, 'restore cut').not.toBeNull();
          if (restored === null) throw new Error('restore failed');
          expect(restored.snapshot().currentNodeId).toBe(mgr.snapshot().currentNodeId);
          expect(restored.snapshot().state.ledger).toEqual(mgr.snapshot().state.ledger);
          mgr = restored;
        }
      }
    } else if (type === 'anchor' || type === 'merchant') {
      const record = decision === 'service' ? mgr.act({ transactionId: actionTransactionId(runId, nodeId, 'SERVICE', `sv-${String(guard)}`), nodeId, action: 'SERVICE' }) : undefined;
      if (record !== undefined && record.status !== 'COMMITTED') {
        mgr.act({ transactionId: actionTransactionId(runId, nodeId, 'DECLINE', `sx-${String(guard)}`), nodeId, action: 'DECLINE' });
      } else if (record === undefined) {
        mgr.act({ transactionId: actionTransactionId(runId, nodeId, 'DECLINE', `sy-${String(guard)}`), nodeId, action: 'DECLINE' });
      }
    } else if (type === 'recruitment' && decision === 'choose') {
      const offers = mgr.snapshot().state.snapshots[nodeId];
      const offer = offers?.kind === 'OFFERS' ? offers.offers[0] : undefined;
      if (offer !== undefined) {
        const choose = mgr.act({ transactionId: actionTransactionId(runId, nodeId, 'CHOOSE', offer.offerId), nodeId, action: 'CHOOSE', optionId: offer.offerId });
        expect(choose.status).toBe('COMMITTED');
      } else {
        mgr.act({ transactionId: actionTransactionId(runId, nodeId, 'DECLINE', `rn-${String(guard)}`), nodeId, action: 'DECLINE' });
      }
    } else if (type === 'treasure' && decision === 'take') {
      const take = mgr.act({ transactionId: actionTransactionId(runId, nodeId, 'TAKE', `t-${String(guard)}`), nodeId, action: 'TAKE' });
      expect(take.status).toBe('COMMITTED');
    } else if (type === 'scout' && decision === 'scout') {
      const reveal = mgr.act({ transactionId: actionTransactionId(runId, nodeId, 'REVEAL_PATH', `sc-${String(guard)}`), nodeId, action: 'REVEAL_PATH' });
      expect(reveal.status).toBe('COMMITTED');
    } else if (type === 'altar' && decision === 'accept') {
      const accept = mgr.act({ transactionId: actionTransactionId(runId, nodeId, 'ACCEPT', `a-${String(guard)}`), nodeId, action: 'ACCEPT' });
      expect(accept.status).toBe('COMMITTED');
    } else {
      mgr.act({ transactionId: actionTransactionId(runId, nodeId, 'DECLINE', `d-${String(guard)}`), nodeId, action: 'DECLINE' });
    }
    assertFolds(`action ${type}@${String(guard)}`);
    mgr.resolve();
    assertFolds(`resolve ${type}@${String(guard)}`);
    const next = path[guard + 1];
    if (next === undefined) break;
    mgr.advance(next);
  }
  report.visitedKinds = [...visitedKinds].sort();
  return report;
}

/** The end screen's exact commit path over a FINISHED manager. */
export function settle(mgr: RunManager, missionId: string, heroId: string): void {
  const snap = mgr.snapshot();
  const { requests } = buildSettlementRequests(snap.state, 'victory');
  let profile = loadOrCreateProfile();
  for (const req of requests) profile = commitTransaction(profile, req).profile;
  saveProfile(profile);
  const missionState = recordMissionCompletion(loadMissionState(), missionId, snap.state.goldEarned);
  saveMissionState(missionState);
  const nodesVisited = Object.keys(snap.state.visits).length;
  const updated = applyExpeditionTracking(snap.state, 'victory', missionId, snap.state.goldEarned, nodesVisited, loadAllPersistentState(), heroId);
  saveAllPersistentStateExport(updated);
  RunManager.abandon();
}
