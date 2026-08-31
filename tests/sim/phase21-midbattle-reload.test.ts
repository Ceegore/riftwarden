/**
 * Phase 21 §9 ENGAGE AFTER A MID-BATTLE RELOAD. The live battle handle is an
 * in-memory stateless replay of the node's content encounter — the expedition
 * SAVE never holds a battle: at load the screen recreates the deterministic
 * battle and its REAL live outbound sense before the player can commit ENGAGE.
 * The exact-tick boundary that must hold across a refresh:
 *
 *   1. the persisted mid-battle state is ONLY the ENTER commit + the REWARD
 *      snapshot (no ENGAGE ever pre-claims a fight that wasn't finished);
 *   2. after a reload the fresh battle starts ACTIVE → ENGAGE is gated (the
 *      gate reason shows), exactly as before the refresh;
 *   3. the replays battle reaches the SAME terminal VICTORY with the SAME
 *      completed kinds and the SAME bounty (deterministic re-simulation — the
 *      reload never changes the fight, so the win is never re-litigated);
 *   4. committing ENGAGE on the restored run grants EXACTLY the oracle amount
 *      (base + per-kind bounty), equal to a no-reload victory.
 */
import { describe, expect, it } from 'vitest';
import { createExpedition } from '../../src/game/expedition/expedition-runner.js';
import { generateMap } from '../../src/game/expedition/map-generator.js';
import type { ExpeditionMap, MapProfile } from '../../src/game/expedition/types.js';
import {
  battleResultOf,
  createLiveSimBattle,
  engageAvailableFor,
  gateEngageAction,
  resolveExpeditionEncounter,
  type LiveSimBattleHandle,
} from '../../src/features/battle/sim/sim-battle-host.js';
import { bountyForKinds } from '../../src/game/expedition/nodes/handlers/combat.js';
import { decodeExpeditionSave, encodeExpeditionSave, restoreExpeditionSave } from '../../src/game/expedition/expedition-save.js';

const PROFILE: MapProfile = {
  id: 'exp-midreload.v1',
  logicalLevels: 6,
  targetVisited: [5, 8] as const,
  mandatoryRoles: ['anchor', 'preparation', 'boss'],
  attemptCap: 50,
  fallbackTemplateId: 'fallback.v1',
};

function mapFor(seed: number): ExpeditionMap {
  return generateMap({ seed, profileId: 'exp-midreload.v1', contentRevision: '32.0' }, PROFILE);
}

/** Deterministic walk to a combat node (battle/elite/boss); returns the expedition positioned there UNENTERED. */
function walkToCombat(seed: number): ReturnType<typeof createExpedition> {
  let exp = createExpedition(mapFor(seed), { startGold: 300 });
  let guard = 0;
  while (!['battle', 'elite', 'boss'].includes(exp.definition.type)) {
    const next = exp.reachableNodes[0];
    if (next === undefined) throw new Error(`dead-end at ${exp.currentNodeId}`);
    exp = exp.enter(`mr-walk-${String(guard)}`).resolve().advance(next);
    guard += 1;
    if (guard > 150) throw new Error('walk diverged');
  }
  return exp;
}

function battleAndKinds(seed: number): { handle: LiveSimBattleHandle; kinds: readonly string[]; bounty: number; grantedTotal: number } {
  let exp = walkToCombat(seed);
  const nodeId = exp.currentNodeId;
  const type = exp.definition.type;
  // ENTER materialises the REWARD snapshot whose roll slots decide the base gold.
  exp = exp.enter('mr-ref-enter');
  const snap = exp.state.snapshots[nodeId];
  const rollSlots = snap !== undefined && snap.kind === 'REWARD' ? snap.rollSlots : {};
  const goldSlot = rollSlots['gold'] ?? 0;
  const base = type === 'elite' ? 90 + (goldSlot % 51) : type === 'battle' ? 45 + (goldSlot % 26) : 0;
  const encounter = resolveExpeditionEncounter(type, exp.definition.payloadKey);
  if (encounter === null) throw new Error(`no encounter at ${nodeId}`);
  const handle = createLiveSimBattle({ encounter });
  let out = handle.snapshot();
  const preVerdict = battleResultOf(out);
  // Mid-battle the ENGAGE button is gated with the in-progress reason.
  expect(gateEngageAction(Object.freeze({ action: 'ENGAGE', available: true }), true, preVerdict)).toEqual(
    Object.freeze({ action: 'ENGAGE', available: false, descriptionKey: 'Battle in progress — ENGAGE unlocks on victory' }),
  );
  let guard = 0;
  while (!['VICTORY', 'DEFEAT', 'DRAW_ABORT'].includes(out.phase.phase) && guard < 2000) {
    out = handle.step();
    guard += 1;
  }
  if (guard >= 2000) throw new Error('battle did not terminate');
  expect(out.phase.phase).toBe('VICTORY');
  const kinds = (out.objectives ?? []).filter((o) => o.complete).map((o) => o.kind);
  const bounty = out.bounty ?? bountyForKinds(kinds);
  expect(bounty).toBe(bountyForKinds(kinds));
  // The terminal victory unlocks ENGAGE.
  expect(engageAvailableFor('victory')).toBe(true);
  const winGate = gateEngageAction(Object.freeze({ action: 'ENGAGE', available: true }), true, battleResultOf(out));
  expect(winGate.available).toBe(true);
  return { handle, kinds, bounty, grantedTotal: base + bounty };
}

describe('P21 §9 ENGAGE after a mid-battle reload', () => {
  it('after a reload the fresh ACTIVE battle keeps ENGAGE gated, then a deterministic VICTORY unlocks it', { timeout: 60_000 }, () => {
    const seed = 701;
    // First pass (no reload): the reference terminal.
    const reference = battleAndKinds(seed);

    // The persisted MID-BATTLE state is only the ENTER commit + reward snapshot.
    let exp = walkToCombat(seed);
    const nodeId = exp.currentNodeId;
    exp = exp.enter('mr-persist-enter');
    expect(exp.state.visits[nodeId]?.status).toBe('COMMITTED');
    expect(exp.state.ledger['mr-persist-enter']?.status).toBe('COMMITTED');
    // Nothing has been ENGAGE-claimed (the fight is ongoing).
    expect(Object.values(exp.state.ledger).some((e) => e.action === 'ENGAGE')).toBe(false);
    expect(exp.state.snapshots[nodeId]?.kind).toBe('REWARD');

    // RELOAD: encode → decode (proves the mid-battle state survives) → restore.
    const serialized = encodeExpeditionSave(exp);
    const decoded = decodeExpeditionSave(JSON.parse(serialized));
    expect(decoded.state.visits[nodeId]?.status).toBe('COMMITTED');
    expect(decoded.state.snapshots[nodeId]?.kind).toBe('REWARD');
    const restored = restoreExpeditionSave(serialized, mapFor(seed));
    expect(restored.currentNodeId).toBe(nodeId);
    expect(restored.state.gold).toBe(exp.state.gold);
    const rType = restored.definition.type;
    expect(rType).toBe(exp.definition.type);

    // Recreate the live battle on the RESTORED run (what NodeScreen does on mount).
    const encounter = resolveExpeditionEncounter(rType, restored.definition.payloadKey);
    if (encounter === null) throw new Error('restored node resolved no encounter');
    const replayed = createLiveSimBattle({ encounter });
    let out = replayed.snapshot();
    // Immediately after the reload the fight is ACTIVE again → ENGAGE is gated.
    expect(battleResultOf(out)).toBe('active');
    expect(engageAvailableFor(battleResultOf(out))).toBe(false);
    expect(gateEngageAction(Object.freeze({ action: 'ENGAGE', available: true }), true, battleResultOf(out)).available).toBe(false);
    // Step the replayed battle to its terminal.
    let guard = 0;
    while (!['VICTORY', 'DEFEAT', 'DRAW_ABORT'].includes(out.phase.phase) && guard < 2000) {
      out = replayed.step();
      guard += 1;
    }
    expect(out.phase.phase).toBe('VICTORY');
    // The re-simulated victory is IDENTICAL: same kinds, same bounty — the
    // reload never re-litigates a deterministically-won fight.
    const replayKinds = (out.objectives ?? []).filter((o) => o.complete).map((o) => o.kind);
    expect(replayKinds).toEqual(reference.kinds);
    expect(out.bounty).toBe(reference.bounty);

    // ENGAGE on the restored run grants the oracle amount — the same total a
    // no-reload victory paid (the deterministic seed decides the reward).
    const goldBefore = restored.state.gold;
    const engageTx = `mr-reload-engage-${String(seed)}`;
    const committed = restored.act({ transactionId: engageTx, nodeId, action: 'ENGAGE', completedKinds: replayKinds });
    expect(committed.state.ledger[engageTx]?.status).toBe('COMMITTED');
    expect(committed.state.gold - goldBefore).toBe(reference.grantedTotal);
  });

  it('the reward snapshot the restore re-places is byte-identical to the one persisted (roll slots decide the grant)', { timeout: 60_000 }, () => {
    const seed = 702;
    let exp = walkToCombat(seed);
    const nodeId = exp.currentNodeId;
    exp = exp.enter('mr-snap-enter');
    const before = exp.state.snapshots[nodeId];
    const restored = restoreExpeditionSave(encodeExpeditionSave(exp), mapFor(seed));
    expect(restored.state.snapshots[nodeId]).toEqual(before);
    // The restored snapshot's roll slots deterministically produce the SAME base
    // gold as a fresh ENTER on the same node (identical seed + node id).
    const reEntered = walkToCombat(seed).enter('mr-snap-enter-2');
    expect(reEntered.state.snapshots[nodeId]).toEqual(before);
  });
});
