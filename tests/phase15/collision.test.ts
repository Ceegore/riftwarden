import { describe, it, expect } from 'vitest';
import { enemyContactDistanceX100, preservesFrontOrder, resolveEnemyStop, violatesEnemyPassThrough, type MoveIntent } from '../../src/game/sim/collision/collision-resolver.js';
import { isOvertakeAuthorized, separateAllies, separateAlliesTowardEnemy, SEPARATION_MAX_X100_PER_ENTITY_TICK, validateOvertakeGrant } from '../../src/game/sim/collision/separation.js';
import { overlapDepthX100, type Body } from '../../src/game/sim/geometry/distance.js';
import { asFieldX100, asX100, type Lane } from '../../src/game/sim/geometry/x100.js';
import { resolveMovement } from '../../src/game/sim/movement/movement-system.js';
import { KernelInvariantError } from '../../src/game/sim/core/invariant-error.js';

function body(id: string, x100: number, radiusX100: number, lane: Lane = 'middle'): Body {
  return { id, x100: asFieldX100(x100), radiusX100: asX100(radiusX100), lane };
}

describe('enemy collision', () => {
  it('computes the contact distance and detects pass-through overlap', () => {
    const a = body('e1', 100, 20);
    const b = body('e2', 130, 30);
    expect(enemyContactDistanceX100(a, b)).toBe(50);
    expect(violatesEnemyPassThrough(a, b)).toBe(true);
    expect(overlapDepthX100(a, b)).toBe(20);
  });

  it('stops a mover at the enemy boundary without a gap', () => {
    const intent: MoveIntent = { entityId: 'm', fromX100: asX100(100), radiusX100: asX100(20), lane: 'middle', direction: 1, desiredStepX100: asX100(1000) };
    const enemy = body('e1', 500, 30);
    expect(resolveEnemyStop(intent, [enemy], asX100(0))).toBe(350);
  });

  it('honours the melee stop gap of 10', () => {
    const intent: MoveIntent = { entityId: 'm', fromX100: asX100(100), radiusX100: asX100(20), lane: 'middle', direction: 1, desiredStepX100: asX100(1000) };
    const enemy = body('e1', 500, 30);
    expect(resolveEnemyStop(intent, [enemy], asX100(10))).toBe(340);
  });

  it('ignores enemies behind the mover', () => {
    const intent: MoveIntent = { entityId: 'm', fromX100: asX100(500), radiusX100: asX100(20), lane: 'middle', direction: 1, desiredStepX100: asX100(1000) };
    const enemy = body('e1', 100, 30);
    expect(resolveEnemyStop(intent, [enemy], asX100(0))).toBe(1000);
  });

  it('detects enemy front-order swaps', () => {
    const before = [body('e1', 100, 10), body('e2', 300, 10)];
    expect(preservesFrontOrder(before, [body('e1', 150, 10), body('e2', 350, 10)])).toBe(true);
    expect(preservesFrontOrder(before, [body('e2', 150, 10), body('e1', 350, 10)])).toBe(false);
  });
});

describe('ally separation', () => {
  it('separates an overlapping ally pair within the 25-X100 cap per tick', () => {
    const result = separateAllies([body('a', 100, 20), body('b', 110, 20)]);
    expect(result.residualOverlaps).toBe(0);
    const a = result.bodies.find((b) => b.id === 'a');
    const b = result.bodies.find((b) => b.id === 'b');
    if (a === undefined || b === undefined) throw new Error('missing separated body');
    expect(overlapDepthX100(a, b)).toBe(0);
    expect(Math.abs(a.x100 - 100)).toBeLessThanOrEqual(SEPARATION_MAX_X100_PER_ENTITY_TICK * 2);
  });

  it('is permutation-invariant across input order', () => {
    const ids = ['a', 'b', 'c'];
    const build = (order: string[]) => order.map((id) => body(id, 100 + ['a', 'b', 'c'].indexOf(id) * 12, 20));
    const r1 = separateAllies(build(ids));
    const r2 = separateAllies(build([...ids].reverse()));
    const canon = (r: typeof r1) => [...r.bodies].sort((x, y) => (x.id < y.id ? -1 : x.id > y.id ? 1 : 0)).map((b) => `${b.id}:${String(b.x100)}`);
    expect(canon(r1)).toEqual(canon(r2));
  });

  it('reports residual overlap when the safety cap is exhausted', () => {
    // Depth 60 (two radius-30 bodies on one point) exceeds the 25-per-entity
    // tick budget, so one iteration cannot fully separate them (§8.2).
    const result = separateAllies([body('a', 100, 30), body('b', 100, 30)], 1);
    expect(result.safetyCapReached).toBe(true);
    expect(result.residualOverlaps).toBeGreaterThan(0);
  });

  it('lets the rear absorb the overlap when the front is pinned at the enemy boundary', () => {
    const result = separateAlliesTowardEnemy([body('rear', 130, 20), body('front', 135, 20)], 8, { frontDirection: 1, frontLimitX100: { front: 135 } });
    const front = result.bodies.find((b) => b.id === 'front');
    const rear = result.bodies.find((b) => b.id === 'rear');
    if (front === undefined || rear === undefined) throw new Error('missing separated body');
    expect(front.x100).toBe(135); // never pushed past the enemy boundary
    expect(rear.x100).toBe(105); // absorbed the full 25-X100 budget
    expect(result.residualOverlaps).toBe(1);
  });

  it('advances the front into free space before moving the rear (§8.2)', () => {
    const result = separateAlliesTowardEnemy([body('rear', 130, 20), body('front', 140, 20)], 8, { frontDirection: 1, frontLimitX100: { front: 200 } });
    const front = result.bodies.find((b) => b.id === 'front');
    const rear = result.bodies.find((b) => b.id === 'rear');
    if (front === undefined || rear === undefined) throw new Error('missing separated body');
    expect(front.x100).toBe(165);
    expect(rear.x100).toBe(125);
    expect(result.residualOverlaps).toBe(0);
  });
});

describe('ally overtake', () => {
  it('allows only an explicit, time-boxed grant', () => {
    const grant = { entityId: 'a', effectId: 'fx1', startTick: 10, endTick: 20 };
    expect(isOvertakeAuthorized(grant, 'a', 15)).toBe(true);
    expect(isOvertakeAuthorized(grant, 'a', 21)).toBe(false);
    expect(isOvertakeAuthorized(grant, 'b', 15)).toBe(false);
  });

  it('rejects an invalid grant window', () => {
    expect(() => {
      validateOvertakeGrant({ entityId: 'a', effectId: 'fx1', startTick: 20, endTick: 10 });
    }).toThrow(KernelInvariantError);
  });
});

describe('movement system', () => {
  it('advances the remainder from the desired step even when blocked', () => {
    const r = resolveMovement(
      { entityId: 'm', x100: asX100(100), radiusX100: asX100(20), lane: 'middle', movementRemainder: 0, speedX100PerSecond: 300, direction: 1 },
      [body('e1', 150, 30)],
      asX100(10),
    );
    expect(r.desiredStepX100).toBe(10);
    expect(r.appliedStepX100).toBe(0);
    expect(r.newRemainder).toBe(0);
    expect(r.newX100).toBe(100);
  });

  it('clamps the applied step to the field boundary', () => {
    const r = resolveMovement(
      { entityId: 'm', x100: asX100(9995), radiusX100: asX100(20), lane: 'middle', movementRemainder: 0, speedX100PerSecond: 300, direction: 1 },
      [],
      asX100(0),
    );
    expect(r.appliedStepX100).toBe(5);
    expect(r.newX100).toBe(10000);
  });
});
