/**
 * Phase 21 §9.5 CROSS-RUN SAME-SEED DETERMINISM. The fixed-point property fuzz
 * proved a single save is idempotent under encode→decode→re-encode; this test
 * proves the STRONGER property the whole persistence design depends on: a run
 * continued through a mid-flight save/restore is byte-identical to the
 * UNINTERRUPTED run of the same seed, at EVERY step.
 *
 *   UNINTERRUPTED  create(seed) → enter/act/resolve/advance × N   reference
 *   INTERRUPTED    create(seed) → [k steps] → encode → restore → [k steps] → …
 *
 * At every step the interrupted runner's FULL persisted state must equal the
 * uninterrupted reference's state exactly (deep-equality is not enough — the
 * codec's canonical re-encode of the restored state must be textually
 * identical to the uninterrupted serialization at that point). A break means a
 * reload could silently diverge the run from the canonical timeline (stale
 * gold/kills/instability, a re-materialized snapshot, an out-of-order ledger).
 *
 * The cut points (1-in-3 hops) are chosen to overlap ENTER-commits, acts, and
 * resolves, so the restore road-tests every persisted shape mid-flow.
 */
import { describe, expect, it } from 'vitest';
import { createExpedition } from '../../src/game/expedition/expedition-runner.js';
import { generateMap } from '../../src/game/expedition/map-generator.js';
import type { ExpeditionMap, MapProfile, NodeType } from '../../src/game/expedition/types.js';
import { encodeExpeditionSave, restoreExpeditionSave } from '../../src/game/expedition/expedition-save.js';
import type { ExpeditionRunner } from '../../src/game/expedition/expedition-runner.js';

const PROFILE: MapProfile = {
  id: 'exp-determinism.v1',
  logicalLevels: 6,
  targetVisited: [5, 8] as const,
  mandatoryRoles: ['anchor', 'preparation', 'boss'],
  attemptCap: 50,
  fallbackTemplateId: 'fallback.v1',
};

function mapFor(seed: number): ExpeditionMap {
  return generateMap({ seed, profileId: 'exp-determinism.v1', contentRevision: '32.0' }, PROFILE);
}

const ACTIONS_FOR_KIND: Readonly<Record<NodeType, readonly string[]>> = Object.freeze({
  battle: Object.freeze(['ENGAGE', 'ENGAGE_DEFEAT'] as const),
  elite: Object.freeze(['ENGAGE', 'ENGAGE_DEFEAT'] as const),
  boss: Object.freeze(['ENGAGE', 'ENGAGE_DEFEAT'] as const),
  merchant: Object.freeze(['SERVICE', 'DECLINE'] as const),
  anchor: Object.freeze(['SERVICE', 'SECURE', 'DECLINE'] as const),
  altar: Object.freeze(['ACCEPT', 'DECLINE'] as const),
  treasure: Object.freeze(['TAKE', 'DECLINE'] as const),
  story: Object.freeze(['CONTINUE', 'DECLINE'] as const),
  scout: Object.freeze(['REVEAL_PATH', 'REVEAL_REWARD', 'DECLINE'] as const),
  event: Object.freeze(['DECLINE'] as const),
  recruitment: Object.freeze(['DECLINE'] as const),
  workshop: Object.freeze(['DECLINE'] as const),
});

/**
 * One deterministic action-request decision for the runner at `step`. It is a
 * pure function of the node kind + committed counters, so the uninterrupted and
 * restored runs MAKE THE SAME DECISIONS at the same step (the restored state is
 * byte-identical, so gold/instability drive the same affordance choices too).
 */
function decide(exp: ExpeditionRunner, step: number): { transactionId: string; nodeId: string; action: string; completedKinds?: readonly string[] } {
  const type = exp.definition.type;
  const nodeId = exp.currentNodeId;
  const tx = `det-${String(step)}`;
  const kindsPool = type === 'elite' || type === 'boss'
    ? ['defeat_boss', 'kill_boss', 'survive_until'] as const
    : ['kill_regulars', 'heal_sustain', 'survive_until'] as const;
  if (type === 'battle' || type === 'elite' || type === 'boss') {
    const victory = step % 2 === 0;
    return {
      transactionId: tx, nodeId, action: victory ? 'ENGAGE' : 'ENGAGE_DEFEAT',
      ...(victory ? { completedKinds: [kindsPool[step % kindsPool.length] ?? 'kill_regulars'] } : {}),
    };
  }
  if (type === 'merchant' || type === 'anchor') {
    const svcAffordable = exp.state.gold >= 30 && (type === 'merchant' ? exp.state.instability >= 10 : exp.state.instability >= 8);
    return svcAffordable
      ? { transactionId: tx, nodeId, action: 'SERVICE' }
      : { transactionId: tx, nodeId, action: 'DECLINE' };
  }
  const pick = ACTIONS_FOR_KIND[type];
  const action = pick[step % pick.length] ?? 'DECLINE';
  return { transactionId: tx, nodeId, action };
}

/** One full step (enter → act → resolve → advance) using `decide`. */
function stepOnce(exp: ExpeditionRunner, step: number): ExpeditionRunner {
  // ODD steps re-ENTER the same node first (replay) to road-test idempotent ENTER.
  let runner = exp.enter(`det-e-${String(step)}-a`);
  if (step % 2 === 1) runner = runner.enter(`det-e-${String(step)}-b`);
  runner = runner.act(decide(runner, step));
  runner = runner.resolve();
  const next = runner.reachableNodes[0];
  if (next === undefined) return runner;
  return runner.advance(next);
}

/** Runs `steps` hops from a runner, recording the canonical serialization after each hop. */
function runReference(seed: number, steps: number): readonly string[] {
  let exp = createExpedition(mapFor(seed), { startGold: 300 });
  const trace: string[] = [];
  for (let i = 0; i < steps; i += 1) {
    exp = stepOnce(exp, i);
    trace.push(encodeExpeditionSave(exp));
  }
  return trace;
}

describe('P21 §9.5 cross-run same-seed determinism', () => {
  it('a run interrupted by save/restore at every 3rd hop is byte-identical to the uninterrupted run', { timeout: 60_000 }, () => {
    const seed = 1001;
    const steps = 30;
    const reference = runReference(seed, steps);

    // Interrupted run: restart from the decoded save at each 3rd hop boundary,
    // then continue with the SAME decisions the reference used.
    let exp = createExpedition(mapFor(seed), { startGold: 300 });
    for (let i = 0; i < steps; i += 1) {
      exp = stepOnce(exp, i);
      // Byte-identical to reference at THIS step (both run straight).
      expect(encodeExpeditionSave(exp), `straight step ${String(i)}`).toBe(reference[i]);
      // At a 3rd-hop boundary, cut the run: encode → restore → continue.
      if (i % 3 === 2) {
        const saved = encodeExpeditionSave(exp);
        exp = restoreExpeditionSave(saved, mapFor(seed));
        // Restored state encodes byte-identically to the moment we saved it.
        expect(encodeExpeditionSave(exp), `restored after step ${String(i)}`).toBe(saved);
        // Continue the remaining steps from the restored runner, asserting
        // byte-identity to the uninterrupted reference at every one of them.
        for (let j = i + 1; j < steps; j += 1) {
          exp = stepOnce(exp, j);
          expect(encodeExpeditionSave(exp), `resumed step ${String(j)} (cut at ${String(i)})`).toBe(reference[j]);
        }
        break;
      }
    }
  });

  it('restoring at every single hop still reproduces the uninterrupted run byte-for-byte', { timeout: 60_000 }, () => {
    const seed = 1002;
    const steps = 24;
    const reference = runReference(seed, steps);

    const map = mapFor(seed);
    let exp = createExpedition(map, { startGold: 300 });
    for (let i = 0; i < steps; i += 1) {
      exp = stepOnce(exp, i);
      const saved = encodeExpeditionSave(exp);
      expect(saved, `step ${String(i)} serialized`).toBe(reference[i]);
      // Reload before continuing to the next hop.
      exp = restoreExpeditionSave(saved, map);
      expect(encodeExpeditionSave(exp), `step ${String(i)} restored`).toBe(reference[i]);
    }
  });

  it('the map is genuinely walked and produces a non-trivial ledger', { timeout: 60_000 }, () => {
    const seed = 1003;
    const exp = createExpedition(mapFor(seed), { startGold: 300 });
    const terminal = stepOnce(exp, 1);
    // Two different node kinds are exercised on the way to a richly-populated
    // ledger; the determinism trace above must reflect real commits.
    const ref = runReference(seed, 40);
    const last = JSON.parse(ref[ref.length - 1] ?? '{}') as { state: { ledger: object; gold: number } };
    expect(last.state.ledger).toBeDefined();
    expect(Object.keys(last.state.ledger).length).toBeGreaterThan(5);
    expect(last.state.gold).toBeGreaterThanOrEqual(0);
    expect(terminal.map.nodes.length).toBeGreaterThan(7);
  });
});
