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
import type { ExpeditionRunner } from '../../src/game/expedition/expedition-runner.js';

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
});
