/**
 * Phase 21 §9.5 MONOLITHIC SAVE FIXED-POINT BATTERY. The codec contract proved
 * round-trips (encode → decode → deep-equals); this battery proves the codec
 * is a FIXED POINT — re-encoding a decoded save is BYTE-IDENTICAL to the
 * original serialization, on every shape of run:
 *
 *   RUNNER  → encode → decode → RE-ENCODE          byte-identical
 *   RUNNER  → encode → restore → encode → restore  byte-identical forever
 *   MID-BATTLE  (ENTER committed, fight ongoing)   fixed point
 *   COMMITTED VICTORY (ENGAGE + completedKinds)    fixed point
 *   COMMITTED DEFEAT (ENGAGE_DEFEAT + instability) fixed point
 *
 * A save that fails the fixed point would mean a reload could silently mutate
 * the persisted run (key reordering, field normalization, dropped optionals)
 * — every reload would drift the run.
 */
import { describe, expect, it } from 'vitest';
import { createExpedition } from '../../src/game/expedition/expedition-runner.js';
import { generateMap } from '../../src/game/expedition/map-generator.js';
import type { ExpeditionMap, MapProfile } from '../../src/game/expedition/types.js';
import { decodeExpeditionSave, encodeExpeditionSave, restoreExpeditionSave } from '../../src/game/expedition/expedition-save.js';
import { readMeta, restoreStoredExpedition, saveExpedition } from '../../src/game/expedition/expedition-store.js';
import type { ExpeditionRunner } from '../../src/game/expedition/expedition-runner.js';

// The store-layer fixed-point tests drive `expedition-store` (saveExpedition /
// restoreStoredExpedition), which persist through localStorage.
const store = new Map<string, string>();
(globalThis as { localStorage: unknown }).localStorage = {
  getItem(key: string) { return store.get(String(key)) ?? null; },
  setItem(key: string, value: string) { store.set(String(key), String(value)); },
  removeItem(key: string) { store.delete(String(key)); },
  clear() { store.clear(); },
  get length() { return store.size; },
  key(index: number) { return [...store.keys()][index] ?? null; },
};

const PROFILE: MapProfile = {
  id: 'exp-fixedpoint.v1',
  logicalLevels: 6,
  targetVisited: [5, 8] as const,
  mandatoryRoles: ['anchor', 'preparation', 'boss'],
  attemptCap: 50,
  fallbackTemplateId: 'fallback.v1',
};

function mapFor(seed: number): ExpeditionMap {
  return generateMap({ seed, profileId: 'exp-fixedpoint.v1', contentRevision: '32.0' }, PROFILE);
}

/** Deterministic full-map walk committing every action family (mirrors the codec contract walk). */
function walkRun(seed: number): ExpeditionRunner {
  let exp = createExpedition(mapFor(seed), { startGold: 250 });
  let step = 0;
  let guard = 0;
  while (exp.reachableNodes.length > 0 && guard < 300) {
    const type = exp.definition.type;
    const nodeId = exp.currentNodeId;
    exp = exp.enter(`fp-${String(seed)}-e-${String(step)}`);
    let action: { transactionId: string; nodeId: string; action: string; completedKinds?: readonly string[] };
    if (type === 'battle' || type === 'elite' || type === 'boss') {
      action = step % 2 === 0
        ? { transactionId: `fp-${String(seed)}-a-${String(step)}`, nodeId, action: 'ENGAGE', completedKinds: ['heal_sustain'] }
        : { transactionId: `fp-${String(seed)}-a-${String(step)}`, nodeId, action: 'ENGAGE_DEFEAT' };
    } else if (type === 'merchant') {
      action = exp.state.gold >= 30 && exp.state.instability >= 10
        ? { transactionId: `fp-${String(seed)}-a-${String(step)}`, nodeId, action: 'SERVICE' }
        : { transactionId: `fp-${String(seed)}-a-${String(step)}`, nodeId, action: 'DECLINE' };
    } else if (type === 'anchor') {
      action = exp.state.gold >= 30 && exp.state.instability >= 8
        ? { transactionId: `fp-${String(seed)}-a-${String(step)}`, nodeId, action: 'SERVICE' }
        : { transactionId: `fp-${String(seed)}-a-${String(step)}`, nodeId, action: 'SECURE' };
    } else if (type === 'altar') {
      action = exp.state.instability + 10 <= 100
        ? { transactionId: `fp-${String(seed)}-a-${String(step)}`, nodeId, action: 'ACCEPT' }
        : { transactionId: `fp-${String(seed)}-a-${String(step)}`, nodeId, action: 'DECLINE' };
    } else if (type === 'treasure') {
      action = { transactionId: `fp-${String(seed)}-a-${String(step)}`, nodeId, action: 'TAKE' };
    } else if (type === 'story') {
      action = { transactionId: `fp-${String(seed)}-a-${String(step)}`, nodeId, action: 'CONTINUE' };
    } else {
      action = { transactionId: `fp-${String(seed)}-a-${String(step)}`, nodeId, action: 'DECLINE' };
    }
    exp = exp.act(action);
    if ((type === 'battle' || type === 'elite' || type === 'boss') && action.action === 'ENGAGE_DEFEAT') {
      exp = exp.act({ transactionId: `fp-${String(seed)}-d-${String(step)}`, nodeId, action: 'DECLINE' });
    }
    exp = exp.resolve();
    const next = exp.reachableNodes[0];
    if (next === undefined) break;
    exp = exp.advance(next);
    step += 1;
    guard += 1;
  }
  return exp;
}

/** Walks to the first combat node (unentered). */
function walkToCombat(seed: number): ExpeditionRunner {
  let exp = createExpedition(mapFor(seed), { startGold: 300 });
  let guard = 0;
  while (!['battle', 'elite', 'boss'].includes(exp.definition.type)) {
    const next = exp.reachableNodes[0];
    if (next === undefined) throw new Error(`dead-end at ${exp.currentNodeId}`);
    exp = exp.enter(`fp-walk-${String(guard)}`).resolve().advance(next);
    guard += 1;
    if (guard > 150) throw new Error('walk diverged');
  }
  return exp;
}

/** Re-encodes the decode of a serialization — the FIXED-POINT probe. */
function reencode(serialized: string): string {
  const decoded = decodeExpeditionSave(JSON.parse(serialized));
  // encodeExpeditionSave reads only currentNodeId + state (the runner's other
  // members are irrelevant to the codec boundary).
  return encodeExpeditionSave({ currentNodeId: decoded.currentNodeId, state: decoded.state } as unknown as ExpeditionRunner);
}

/** The full fixed-point chain: runner → encode → restore → encode → restore → … */
function restoreChain(seed: number, runner: ExpeditionRunner): void {
  const s1 = encodeExpeditionSave(runner);
  let serialized = s1;
  for (let hop = 0; hop < 3; hop += 1) {
    const restored = restoreExpeditionSave(serialized, mapFor(seed));
    const next = encodeExpeditionSave(restored);
    expect(next).toBe(s1);
    serialized = next;
  }
}

const STORE_KEY = 'rw.expedition.v1';

describe('P21 §9.5 monolithic save fixed-point battery', () => {
  it('a full mixed-ledger run is a fixed point: encode → decode → re-encode is byte-identical', () => {
    for (const seed of [501, 502, 503]) {
      const runner = walkRun(seed);
      expect(Object.keys(runner.state.ledger).length).toBeGreaterThan(5);
      const s1 = encodeExpeditionSave(runner);
      expect(reencode(s1)).toBe(s1);
      // Deep round-trip too: the decode equals the original state.
      const decoded = decodeExpeditionSave(JSON.parse(s1));
      expect(decoded.state).toEqual(runner.state);
      // And the restore path is a fixed point forever.
      restoreChain(seed, runner);
    }
  });

  it('a MID-BATTLE save (ENTER committed, fight ongoing) is a fixed point', () => {
    for (const seed of [504, 505]) {
      const exp = walkToCombat(seed).enter('fp-mid-enter');
      const nodeId = exp.currentNodeId;
      expect(exp.state.visits[nodeId]?.status).toBe('COMMITTED');
      const s1 = encodeExpeditionSave(exp);
      expect(reencode(s1)).toBe(s1);
      restoreChain(seed, exp);
    }
  });

  it('a COMMITTED VICTORY save (ENGAGE + completedKinds) is a fixed point', () => {
    for (const seed of [506, 507]) {
      const walked = walkToCombat(seed);
      const nodeId = walked.currentNodeId;
      const exp = walked.enter('fp-victory-enter').act({
        transactionId: 'fp-victory-engage', nodeId, action: 'ENGAGE', completedKinds: ['kill_regulars', 'heal_sustain'],
      });
      expect(exp.state.ledger['fp-victory-engage']?.status).toBe('COMMITTED');
      const s1 = encodeExpeditionSave(exp);
      expect(reencode(s1)).toBe(s1);
      restoreChain(seed, exp);
    }
  });

  it('a COMMITTED DEFEAT save (ENGAGE_DEFEAT + instability tax) is a fixed point', () => {
    const seed = 508;
    const walked = walkToCombat(seed);
    const nodeId = walked.currentNodeId;
    const exp = walked.enter('fp-defeat-enter').act({ transactionId: 'fp-defeat-engage', nodeId, action: 'ENGAGE_DEFEAT' });
    expect(exp.state.ledger['fp-defeat-engage']?.status).toBe('COMMITTED');
    expect(exp.state.instability).toBeGreaterThan(walkToCombat(seed).enter('fp-x').state.instability);
    const s1 = encodeExpeditionSave(exp);
    expect(reencode(s1)).toBe(s1);
    restoreChain(seed, exp);
  });

  it('the STORE layer is a fixed point: saveExpedition → restoreStoredExpedition → saveExpedition keeps the payload byte-identical', () => {
    for (const seed of [509, 510]) {
      const runner = walkRun(seed);
      // saveExpedition writes the serialized save + the meta envelope.
      saveExpedition(runner);
      const first = store.get(STORE_KEY);
      if (first === undefined) throw new Error('saveExpedition wrote nothing');
      const meta = readMeta();
      expect(meta?.mapSeed).toBe(runner.state.seed);
      expect(meta?.mapHash).toBe(runner.state.mapHash);
      expect(meta?.profileId).toBe(runner.state.modeId);
      // restoreStoredExpedition (mapHash-guarded) rebuilds the runner from the
      // stored payload; re-encoding it reproduces the EXACT stored string.
      const restored = restoreStoredExpedition(mapFor(seed));
      expect(restored).not.toBeNull();
      if (restored === null) throw new Error('store restore failed');
      expect(encodeExpeditionSave(restored)).toBe(first);
      // save → restore → save: the stored payload is a FIXED POINT.
      saveExpedition(restored);
      expect(store.get(STORE_KEY)).toBe(first);
      const meta2 = readMeta();
      expect(meta2?.runId).toBe(meta?.runId);
      expect(meta2?.mapSeed).toBe(meta?.mapSeed);
      expect(meta2?.mapHash).toBe(meta?.mapHash);
    }
  });

  it('the store fixed point holds for a MID-BATTLE save and a COMMITTED-VICTORY save', () => {
    const seed = 511;
    const walked = walkToCombat(seed);
    const nodeId = walked.currentNodeId;
    // Mid-battle: only the ENTER commit + the REWARD snapshot.
    const mid = walked.enter('fp-store-mid-enter');
    saveExpedition(mid);
    const firstMid = store.get(STORE_KEY);
    const restoredMid = restoreStoredExpedition(mapFor(seed));
    if (restoredMid === null || firstMid === undefined) throw new Error('mid-battle store restore failed');
    expect(encodeExpeditionSave(restoredMid)).toBe(firstMid);
    // Committed victory: the ENGAGE + completedKinds on the ledger.
    const victory = mid.act({ transactionId: 'fp-store-engage', nodeId, action: 'ENGAGE', completedKinds: ['kill_regulars'] });
    saveExpedition(victory);
    const firstVictory = store.get(STORE_KEY);
    const restoredVictory = restoreStoredExpedition(mapFor(seed));
    if (restoredVictory === null || firstVictory === undefined) throw new Error('victory store restore failed');
    expect(encodeExpeditionSave(restoredVictory)).toBe(firstVictory);
    expect(restoredVictory.state.ledger['fp-store-engage']?.completedKinds).toEqual(['kill_regulars']);
    // And re-saving the restored victory is byte-identical again.
    saveExpedition(restoredVictory);
    expect(store.get(STORE_KEY)).toBe(firstVictory);
  });
});
