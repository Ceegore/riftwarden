/**
 * Phase 21 §9 battle-verdict wiring: the live battle's terminal outcome must
 * decide whether a combat node clears or gates. `resolveBattle(won)` is the
 * seam — a WON fight marks the visit RESOLVED so advancement works; a LOST
 * fight leaves the visit COMMITTED, so `advance` throws until the player
 * retreats. `battleResultOf` maps the live outbound sense to the UI verdict.
 */
import { describe, expect, it } from 'vitest';
import { createExpedition } from '../../src/game/expedition/expedition-runner.js';
import { generateMap } from '../../src/game/expedition/map-generator.js';
import type { ExpeditionMap, MapProfile } from '../../src/game/expedition/types.js';
import { battleResultOf } from '../../src/features/battle/sim/sim-battle-host.js';
import type { LiveOutboundInput } from '../../src/features/battle/outbound/phase21-outbound-presenter.js';

const FALLBACK_PROFILE: MapProfile = {
  id: 'exp-verdict.v1',
  logicalLevels: 6,
  targetVisited: [5, 8] as const,
  mandatoryRoles: ['anchor', 'preparation', 'boss'],
  attemptCap: 50,
  fallbackTemplateId: 'fallback.v1',
};

function mapFor(seed: number): ExpeditionMap {
  return generateMap({ seed, profileId: 'exp-verdict.v1', contentRevision: '32.0' }, FALLBACK_PROFILE);
}

/** Walks enter→resolve→advance along the first edge until a combat node is reached (unentered). */
function advanceToCombat(seed: number): ReturnType<typeof createExpedition> {
  let exp = createExpedition(mapFor(seed), { startGold: 200 });
  let guard = 0;
  while (!['battle', 'elite', 'boss'].includes(exp.handler.type) && guard < 60) {
    const next = exp.reachableNodes[0];
    if (next === undefined) throw new Error(`dead-end at ${exp.currentNodeId}`);
    exp = exp.enter(`tx-combat-walk-${String(guard)}`).resolve().advance(next);
    guard += 1;
  }
  if (!['battle', 'elite', 'boss'].includes(exp.handler.type)) {
    throw new Error(`no combat node reached for seed ${String(seed)}`);
  }
  return exp;
}

describe('phase21 battle verdict gating', () => {
  it('maps the live outbound phase to the four UI verdicts', () => {
    const phase = (p: string): LiveOutboundInput => Object.freeze({
      encounterId: 'e',
      objective: 'defeat_all',
      tick: 100,
      phase: Object.freeze({ phase: p, endReason: null }),
      bossPhase: null,
      modifierHookLog: Object.freeze([]),
      events: Object.freeze([]),
    });
    expect(battleResultOf(phase('ACTIVE'))).toBe('active');
    expect(battleResultOf(phase('VICTORY'))).toBe('victory');
    expect(battleResultOf(phase('DEFEAT'))).toBe('defeat');
    expect(battleResultOf(phase('DRAW_ABORT'))).toBe('abort');
  });

  it('a WON battle resolves the node so advancement works', () => {
    let exp = advanceToCombat(203);
    const nodeId = exp.currentNodeId;
    exp = exp.enter('tx-verdict-win-enter');
    expect(exp.state.visits[nodeId]?.status).toBe('COMMITTED');
    exp = exp.resolveBattle(true);
    expect(exp.state.visits[nodeId]?.status).toBe('RESOLVED');
    const next = exp.reachableNodes[0];
    if (next !== undefined) {
      const advanced = exp.advance(next);
      expect(advanced.currentNodeId).toBe(next);
    }
  });

  it('a LOST battle leaves the node unresolved so advancement is gated', () => {
    let exp = advanceToCombat(204);
    const nodeId = exp.currentNodeId;
    exp = exp.enter('tx-verdict-lose-enter');
    exp = exp.resolveBattle(false);
    // The visit stays COMMITTED — the node is cleared only by an explicit retreat.
    expect(exp.state.visits[nodeId]?.status).toBe('COMMITTED');
    const next = exp.reachableNodes[0];
    if (next !== undefined) {
      expect(() => exp.advance(next)).toThrow('expedition.VISIT_STATE_INVALID');
    }
    // Retreat (resolve) clears the node and unlocks advancement.
    exp = exp.resolve();
    expect(exp.state.visits[nodeId]?.status).toBe('RESOLVED');
    if (next !== undefined) {
      expect(exp.advance(next).currentNodeId).toBe(next);
    }
  });

  it('resolveBattle is a no-op on an already-resolved node (won)', () => {
    let exp = advanceToCombat(205);
    const nodeId = exp.currentNodeId;
    exp = exp.enter('tx-verdict-re-enter').resolve();
    expect(exp.state.visits[nodeId]?.status).toBe('RESOLVED');
    const revision = exp.state.revision;
    const again = exp.resolveBattle(true);
    expect(again.state.revision).toBe(revision);
  });
});
