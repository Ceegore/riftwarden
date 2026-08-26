import { KernelInvariantError } from '../core/invariant-error.js';
import { asciiCompare } from '../core/primitives.js';
import { GAME_RULES } from '../../rules/game-rules.js';
import { createTempEntity, type SpawnRequest, type SpawnResult, type TempEntity } from './temporary-entity.js';
import type { TemporaryRegistry } from './temporary-registry.js';

/**
 * Phase 20 §5 summon manager. Reserved spawn requests in one tick batch are
 * ordered canonically (§5.1); the id is reserved before placement (§5.2) and
 * the cap policy is applied atomically (§5.3). No policy may exceed cap 6 even
 * momentarily — replacement removes the oldest first, then commits.
 */

/** §5.1 canonical batch order: requestedTick, sourcePriority, sourceEntityId, abilityId, requestSequence, reservedEntityId. */
export function sortRequests(requests: readonly SpawnRequest[]): readonly SpawnRequest[] {
  return Object.freeze(
    [...requests].sort(
      (a, b) =>
        a.requestedTick - b.requestedTick ||
        a.sourcePriority - b.sourcePriority ||
        asciiCompare(a.sourceEntityId, b.sourceEntityId) ||
        asciiCompare(a.abilityId, b.abilityId) ||
        a.requestSequence - b.requestSequence ||
        asciiCompare(a.reservedEntityId, b.reservedEntityId),
    ),
  );
}

function makeSummon(request: SpawnRequest): TempEntity {
  const extras: { expiresAtTick?: number; slotId?: string } = {};
  if (request.expiresAtTick !== undefined) extras.expiresAtTick = request.expiresAtTick;
  if (request.slotId !== undefined) extras.slotId = request.slotId;
  return createTempEntity({
    id: request.reservedEntityId,
    side: request.side,
    kind: 'SUMMON',
    counted: true,
    ownerId: request.ownerId,
    sourceId: request.sourceId,
    createdTick: request.requestedTick,
    createdSequence: request.requestSequence,
    removeOnOwnerDefeat: false,
    ...extras,
  });
}

/** §5.2/§5.3 single atomic commit against the registry. */
export function commitSummon(registry: TemporaryRegistry, request: SpawnRequest): SpawnResult {
  if (registry.summonCount(request.side) >= GAME_RULES.maxActiveSummonsPerSide) {
    const oldest = registry.oldestSummon(request.side);
    if (request.policy === 'BLOCK') {
      return Object.freeze({ kind: 'BLOCKED', entityId: request.reservedEntityId, diagnostic: 'SpawnLimitBlocked' });
    }
    if (oldest === undefined) throw new KernelInvariantError('P20_SUMMON_INVALID', { reason: 'InvariantMissingOldest', side: request.side });
    if (request.policy === 'BUFF_OLDEST') {
      return Object.freeze({ kind: 'BUFFED', entityId: oldest.id });
    }
    registry.remove(oldest.id);
    const entity = makeSummon(request);
    registry.add(entity);
    return Object.freeze({ kind: 'REPLACED', entityId: entity.id, removedId: oldest.id });
  }
  const entity = makeSummon(request);
  registry.add(entity);
  return Object.freeze({ kind: 'SPAWNED', entityId: entity.id });
}

/**
 * §5.4 batch commit (start summons, per-tick batches). Requests are sorted
 * canonically, then committed in order; a mid-batch BLOCK never exceeds cap 6.
 */
export function commitSummonBatch(registry: TemporaryRegistry, requests: readonly SpawnRequest[]): readonly SpawnResult[] {
  return Object.freeze(sortRequests(requests).map((request) => commitSummon(registry, request)));
}
