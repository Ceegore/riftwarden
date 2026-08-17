import { KernelInvariantError } from '../core/invariant-error.js';
import type { KernelEventInput } from '../events/event-types.js';
import type { KernelEntity } from '../core/entity.js';
import type { KernelSystem, TickContext } from '../core/tick-context.js';
import { asFieldX100, asX100, laneOrdinal, nonNegativeX100, type Lane, type X100 } from '../geometry/x100.js';
import { overlapDepthX100, type Body } from '../geometry/distance.js';
import { baseBehindFront, resolveSpawn } from './spawn-resolver.js';
import { assertReplacementPolicy, placeConstruct, type ReplacementPolicy } from './construct-placement.js';
import { asciiCompare, type Tick } from '../core/primitives.js';

/** §7.2: a spawn must stay at least this far on its own side of the nearest enemy. */
export const SPAWN_ENEMY_MARGIN_X100 = 50;

/** Reason ordinals for the §7.1.7 `SpawnRejected` diagnostic payload. */
export const SPAWN_REJECT_NO_POSITION = 0;
export const SPAWN_REJECT_SLOT_OCCUPIED = 1;
export const SPAWN_REJECT_POLICY_MISSING = 2;
export const SPAWN_REJECT_DISPLACEMENT_FAILED = 3;

export interface SummonRequest {
  readonly kind: 'summon';
  readonly reservedId: string;
  readonly side: 'player' | 'enemy';
  readonly targetLane: Lane;
  readonly radiusX100: X100;
  readonly maxLp: number;
  /** Own front start zone, used only when no ally occupies the target lane. */
  readonly startZoneX100: X100;
  /** §7.4: 'displace' marks a large summon that may push overlapped allies back. */
  readonly displacementPolicy?: 'displace';
}

export interface ConstructRequest {
  readonly kind: 'construct';
  readonly reservedId: string;
  readonly side: 'player' | 'enemy';
  readonly slotId: string;
  readonly lane: Lane;
  readonly x100: X100;
  readonly radiusX100: X100;
  readonly maxLp: number;
  readonly replacementPolicy: ReplacementPolicy | null;
}

export type SpawnRequest = SummonRequest | ConstructRequest;

export interface SpawnSystemConfig {
  /** Produces this tick's summon/construct requests from the frozen tick context. */
  readonly requests?: (context: TickContext) => readonly SpawnRequest[];
  /**
   * Static arena objects (GDD: a spawn must never overlap an arena object).
   * Optional because Phase 15 has no arena-object model yet; battle harnesses
   * that model obstacles feed them here so the rule is enforced, not faked.
   */
  readonly arenaBodies?: (context: TickContext) => readonly Body[];
}

function eventFor(type: 'Spawned' | 'SpawnRejected', entityId: string, payload: Record<string, number>): KernelEventInput {
  return Object.freeze({ type, sourceId: entityId, targetIds: Object.freeze([]), contentIds: Object.freeze([]), payload: Object.freeze(payload), logTags: Object.freeze(['sim.phase15']) });
}

function validateRequest(request: SpawnRequest): void {
  nonNegativeX100(request.radiusX100, 'P15_RADIUS_NEGATIVE');
  if (!Number.isSafeInteger(request.maxLp) || request.maxLp < 0 || Object.is(request.maxLp, -0)) {
    throw new KernelInvariantError('P14_SNAPSHOT_INVALID', { reason: 'spawn-max-lp-invalid', reservedId: request.reservedId, maxLp: request.maxLp });
  }
  if (request.kind === 'summon') {
    laneOrdinal(request.targetLane);
    asFieldX100(request.startZoneX100);
    const displacementPolicy: unknown = request.displacementPolicy;
    if (displacementPolicy !== undefined && displacementPolicy !== 'displace') {
      throw new KernelInvariantError('P15_SPAWN_POLICY_MISSING', { reservedId: request.reservedId, displacementPolicy });
    }
  } else {
    laneOrdinal(request.lane);
    asFieldX100(request.x100);
    if (request.replacementPolicy !== null) assertReplacementPolicy(request.replacementPolicy);
  }
}

function buildEntity(request: SpawnRequest, x100: X100, lane: Lane, tick: Tick): KernelEntity {
  return Object.freeze({
    id: request.reservedId,
    side: request.side,
    phase: Object.freeze({ phase: 'ACTIVE', enteredTick: tick, controlledReturn: null }),
    maxLp: request.maxLp,
    lp: request.maxLp,
    shield: 0,
    lane,
    x100,
    targetId: null,
    timers: Object.freeze({}),
    radiusX100: request.radiusX100,
    movementRemainder: 0,
    laneChange: null,
    normalLaneChangeCooldownUntilTick: 0,
    noProgressTicks: 0,
    repathTicks: Object.freeze([]),
    laneFallbackUsed: false,
    stuckStopGapBonusUntilTick: 0,
    frontDeadlockBlockedTicks: 0,
    deadlockBuffConsumed: false,
    deadlockBuffedEntityId: null,
  });
}

function emitSpawn(context: TickContext, request: SpawnRequest, x100: X100, lane: Lane): void {
  context.commands.push({ kind: 'spawn_entity', entity: buildEntity(request, x100, lane, context.state.tick) });
  context.commands.push({ kind: 'append_event', event: eventFor('Spawned', request.reservedId, { x100, laneOrdinal: laneOrdinal(lane) }) });
  // §9.4: a committed spawn is qualifying progress that resets both counters.
  context.commands.push({ kind: 'set_global_progress', noProgressTicks: 0, collapseTicks: 0, warned: false });
}

function emitReject(context: TickContext, request: SpawnRequest, reasonOrdinal: number): void {
  context.commands.push({ kind: 'append_event', event: eventFor('SpawnRejected', request.reservedId, { reasonOrdinal }) });
}

/** §8.1 + §7.2: no enemy overlap, the 50-X100 own-side margin, and no arena-object overlap. */
function summonCandidateValid(request: SummonRequest, enemies: readonly Body[], arena: readonly Body[]): (x: X100) => boolean {
  const body: Body = { id: request.reservedId, x100: asX100(0), radiusX100: request.radiusX100, lane: request.targetLane };
  return (x: X100): boolean => {
    if (x < 0 || x > 10000) return false;
    const candidate = { ...body, x100: x };
    if (arena.some((object) => object.lane === request.targetLane && overlapDepthX100(candidate, object) > 0)) return false;
    let nearest: Body | null = null;
    let nearestDistance = Number.POSITIVE_INFINITY;
    for (const enemy of enemies) {
      if (enemy.lane !== request.targetLane) continue;
      if (overlapDepthX100(candidate, enemy) > 0) return false;
      const distance = Math.abs(enemy.x100 - x);
      if (distance < nearestDistance) {
        nearest = enemy;
        nearestDistance = distance;
      }
    }
    if (nearest === null) return true;
    return request.side === 'player' ? nearest.x100 - x >= SPAWN_ENEMY_MARGIN_X100 : x - nearest.x100 >= SPAWN_ENEMY_MARGIN_X100;
  };
}

function enemiesOf(context: TickContext, side: 'player' | 'enemy'): readonly Body[] {
  return context.state.entities
    .filter((e) => e.side !== side && e.phase.phase === 'ACTIVE')
    .map((e) => ({ id: e.id, x100: asX100(e.x100), radiusX100: asX100(e.radiusX100 ?? 0), lane: e.lane }));
}

function bodyOf(entity: KernelEntity): Body {
  return { id: entity.id, x100: asX100(entity.x100), radiusX100: asX100(entity.radiusX100 ?? 0), lane: entity.lane };
}

/** §7.4: nearest valid backoff (50..400) that clears the summon, all enemies and arena objects. */
function displacedTarget(ally: KernelEntity, summon: Body, enemies: readonly Body[], arena: readonly Body[]): number | null {
  const backward = ally.side === 'player' ? -1 : 1;
  for (let offset = 50; offset <= 400; offset += 50) {
    const candidate = ally.x100 + backward * offset;
    if (candidate < 0 || candidate > 10000) continue;
    const body: Body = { ...bodyOf(ally), x100: asX100(candidate) };
    if (overlapDepthX100(body, summon) > 0) continue;
    if (enemies.some((enemy) => enemy.lane === body.lane && overlapDepthX100(body, enemy) > 0)) continue;
    if (arena.some((object) => object.lane === body.lane && overlapDepthX100(body, object) > 0)) continue;
    return candidate;
  }
  return null;
}

function commitSummon(context: TickContext, request: SummonRequest, arena: readonly Body[]): void {
  const teamForward = request.side === 'player' ? 1 : -1;
  const backwardDirection = request.side === 'player' ? -1 : 1;
  const allies = context.state.entities.filter((e) => e.side === request.side && e.phase.phase === 'ACTIVE' && e.lane === request.targetLane);
  let base: X100;
  if (allies.length === 0) {
    base = request.startZoneX100;
  } else {
    const front = allies.reduce((best, e) => (teamForward === 1 ? (e.x100 > best ? e.x100 : best) : e.x100 < best ? e.x100 : best), teamForward === 1 ? -1 : 10001);
    base = baseBehindFront(asX100(front), teamForward);
  }
  const enemies = enemiesOf(context, request.side);
  const result = resolveSpawn({ reservedId: request.reservedId, baseX100: base, backwardDirection, valid: summonCandidateValid(request, enemies, arena) });
  if (result.rejected || result.positionX100 === null) {
    emitReject(context, request, SPAWN_REJECT_NO_POSITION);
    return;
  }
  if (request.displacementPolicy === 'displace') {
    // §7.4 large summon: overlapping allies are displaced backward in stable id
    // order; if any single displacement fails, the whole transaction fails
    // atomically (no partial displacement, no phantom entity).
    const summon: Body = { id: request.reservedId, x100: result.positionX100, radiusX100: request.radiusX100, lane: request.targetLane };
    const overlapped = context.state.entities
      .filter((e) => e.side === request.side && e.phase.phase === 'ACTIVE' && e.lane === request.targetLane && overlapDepthX100(bodyOf(e), summon) > 0)
      .sort((a, b) => asciiCompare(a.id, b.id));
    const displacements: { entityId: string; x100: number }[] = [];
    for (const ally of overlapped) {
      const target = displacedTarget(ally, summon, enemies, arena);
      if (target === null) {
        emitReject(context, request, SPAWN_REJECT_DISPLACEMENT_FAILED);
        return;
      }
      displacements.push({ entityId: ally.id, x100: target });
    }
    for (const displacement of displacements) {
      context.commands.push({ kind: 'set_position', entityId: displacement.entityId, lane: request.targetLane, x100: asX100(displacement.x100) });
    }
  }
  emitSpawn(context, request, result.positionX100, request.targetLane);
}

/** An ACTIVE entity already sitting at the construct slot's exact (lane, x100). */
function slotOccupant(entities: readonly KernelEntity[], lane: Lane, x100: X100): string | null {
  const occupants = [...entities].sort((a, b) => asciiCompare(a.id, b.id)).filter((e) => e.phase.phase === 'ACTIVE' && e.lane === lane && e.x100 === x100);
  return occupants[0]?.id ?? null;
}

function commitConstruct(context: TickContext, request: ConstructRequest, arena: readonly Body[]): void {
  const slotBody: Body = { id: request.reservedId, x100: asX100(request.x100), radiusX100: request.radiusX100, lane: request.lane };
  if (arena.some((object) => object.lane === request.lane && overlapDepthX100(slotBody, object) > 0)) {
    emitReject(context, request, SPAWN_REJECT_NO_POSITION);
    return;
  }
  const occupiedBy = slotOccupant(context.state.entities, request.lane, request.x100);
  if (occupiedBy !== null && request.replacementPolicy === 'replace') {
    // §7.3 'replace': the occupant retires (direct ACTIVE -> REMOVED despawn,
    // not a death) and the new construct takes the slot in the same tick.
    context.commands.push({ kind: 'remove_entity', entityId: occupiedBy });
    emitSpawn(context, request, request.x100, request.lane);
    return;
  }
  const result = placeConstruct({ slotId: request.slotId, x100: request.x100, occupiedBy }, request.replacementPolicy);
  if (!result.placed) {
    emitReject(context, request, request.replacementPolicy === null ? SPAWN_REJECT_POLICY_MISSING : SPAWN_REJECT_SLOT_OCCUPIED);
    return;
  }
  emitSpawn(context, request, request.x100, request.lane);
}

/**
 * Stage-K spawn system (§7, §10). Summons reserve their stable id before
 * placement, resolve the deterministic base + 50..400 backoff candidates against
 * field, enemy bodies and the own-side margin, and commit or reject atomically.
 * Constructs use their defined slot: an empty slot commits, an occupied slot
 * blocks with the policy-appropriate code, and the content `replace` policy
 * retires the occupant in the same tick (§7.3). Requests are processed in a
 * deterministic order so the result is permutation-invariant (§8.4).
 */
export function createSpawnSystem(config: SpawnSystemConfig = {}): KernelSystem {
  return {
    id: 'phase15.k1.spawn',
    stage: 'K',
    run(context: TickContext): void {
      const requests = config.requests ? [...config.requests(context)] : [];
      const arena = config.arenaBodies ? [...config.arenaBodies(context)] : [];
      const ordered = [...requests].sort((a, b) => {
        const kindOf = (r: SpawnRequest): number => (r.kind === 'summon' ? 0 : 1);
        return kindOf(a) - kindOf(b) || asciiCompare(a.reservedId, b.reservedId);
      });
      for (const request of ordered) {
        validateRequest(request);
        if (request.kind === 'summon') commitSummon(context, request, arena);
        else commitConstruct(context, request, arena);
      }
    },
  };
}
