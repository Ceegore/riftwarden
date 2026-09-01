import { KernelInvariantError } from './invariant-error.js';
import type { KernelSystem, TickContext } from './tick-context.js';
import type { KernelEntity } from './entity.js';
import type { KernelEventInput } from '../events/event-types.js';
import type { EventType } from '../events/event-spec.js';
import { TemporaryRegistry } from '../summon/temporary-registry.js';
import { commitSummon, sortRequests } from '../summon/summon-manager.js';
import type { CapPolicy, SpawnRequest, TempEntity } from '../summon/temporary-entity.js';
import { synergyTiers, type SynergyUnitInput } from '../synergy/synergy-counter.js';
import { laneOrdinal } from '../geometry/x100.js';
import type { EffectCommand } from '../ability/effect-command.js';

/**
 * Phase 20 runtime wiring (§9). Three deterministic systems:
 * - stage D commits the synergy tier map once from content traits (§4 step 7);
 * - stage K expires temporary entities and commits reserved `spawn_request`
 *   effects into the registry through the summon manager (§5.1–§6).
 * The registry is the authoritative cap/counter/index structure; combat bodies
 * (stats + placement) remain a Phase-15/17/18 content port (§9 steps 4–6).
 */

export interface Phase20RuntimeConfig {
  /** Content: trait ids per regular unit id (≤2 closed synergy ids). */
  readonly unitTraits?: Readonly<Record<string, readonly string[]>>;
  /** Content: cap policy per summon source ability; default BLOCK. */
  readonly spawnPolicies?: Readonly<Record<string, CapPolicy>>;
  /** Content: lifetime ticks per summon source ability; absent = permanent. */
  readonly spawnLifetimes?: Readonly<Record<string, number>>;
}

function eventInput(type: EventType, sourceId: string | null, targetIds: readonly string[], contentIds: readonly string[], payload: Readonly<Record<string, number>>): KernelEventInput {
  return Object.freeze({ type, sourceId, targetIds: Object.freeze([...targetIds]), contentIds: Object.freeze([...contentIds]), payload: Object.freeze({ ...payload }), logTags: Object.freeze(['sim.phase20']) });
}

function isDeployed(entity: KernelEntity): boolean {
  return entity.phase.phase !== 'DEFEATED' && entity.phase.phase !== 'REMOVED';
}

function isRegular(entity: KernelEntity): boolean {
  return entity.origin === undefined || entity.origin === 'regular';
}

function registryOf(state: Readonly<{ temporaryEntities?: readonly TempEntity[] }>): TemporaryRegistry {
  return TemporaryRegistry.restore(state.temporaryEntities ?? Object.freeze([]));
}

function ownerOf(entities: readonly KernelEntity[], ownerId: string): KernelEntity | undefined {
  return entities.find((e) => e.id === ownerId);
}

/** Stage D: compute + commit synergy tiers once (locked at battle start). */
export function createSynergyCommitSystem(config: Phase20RuntimeConfig = {}): KernelSystem {
  return Object.freeze({
    id: 'phase20.d1.synergy_commit',
    stage: 'D' as const,
    run(context: TickContext): void {
      if (context.state.synergyTiers !== undefined) return; // already committed
      const traits = config.unitTraits ?? {};
      const units: SynergyUnitInput[] = context.state.entities.map((entity) => Object.freeze({
        id: entity.id,
        side: entity.side,
        deployed: isDeployed(entity),
        regular: isRegular(entity),
        traits: Object.freeze([...(traits[entity.id] ?? [])]),
      }));
      context.commands.push({ kind: 'set_synergy_tiers', tiers: synergyTiers(units) });
    },
  });
}

function spawnRequestOf(context: TickContext, effect: Extract<EffectCommand, { readonly kind: 'spawn_request' }>, config: Phase20RuntimeConfig): SpawnRequest | null {
  const owner = ownerOf(context.state.entities, effect.sourceId);
  if (owner === undefined) throw new KernelInvariantError('P20_SPAWN_INVALID', { reason: 'missing-owner', ownerId: effect.sourceId });
  const lifetime = config.spawnLifetimes?.[effect.abilityId];
  return Object.freeze({
    reservedEntityId: effect.summonId,
    side: owner.side,
    ownerId: effect.sourceId,
    sourceId: effect.abilityId,
    requestedTick: effect.scheduledTick,
    sourcePriority: 0,
    sourceEntityId: effect.sourceId,
    abilityId: effect.abilityId,
    requestSequence: effect.sequence,
    policy: config.spawnPolicies?.[effect.abilityId] ?? 'BLOCK',
    ...(lifetime === undefined ? {} : { expiresAtTick: effect.scheduledTick + lifetime }),
    ...(effect.targetRef.slotId === null ? {} : { slotId: effect.targetRef.slotId }),
  });
}

/** Stage K: commit reserved spawn_request effects into the registry (§5). */
export function createSummonCommitSystem(config: Phase20RuntimeConfig = {}): KernelSystem {
  return Object.freeze({
    id: 'phase20.k1.summon_commit',
    stage: 'K' as const,
    run(context: TickContext): void {
      const planned = context.state.plannedEffects;
      if (planned === undefined || planned.length === 0) return;
      const now = context.state.tick;
      const registry = registryOf(context.state);
      const requests: SpawnRequest[] = [];
      const consumed = new Set<string>();
      for (const effect of planned) {
        if (effect.kind !== 'spawn_request' || effect.stage !== 'K' || effect.scheduledTick > now) continue;
        const request = spawnRequestOf(context, effect, config);
        if (request !== null) {
          requests.push(request);
          consumed.add(effect.commandId);
        }
      }
      if (requests.length === 0) return;
      for (const request of sortRequests(requests)) {
        const result = commitSummon(registry, request);
        const owner = ownerOf(context.state.entities, request.ownerId);
        if (result.kind === 'SPAWNED' || result.kind === 'REPLACED') {
          context.commands.push({
            kind: 'append_event',
            event: eventInput('Spawned', request.ownerId, [result.entityId], [request.abilityId], {
              x100: owner?.x100 ?? 0,
              laneOrdinal: owner === undefined ? 0 : laneOrdinal(owner.lane),
            }),
          });
          if (result.removedId !== undefined) {
            context.commands.push({ kind: 'append_event', event: eventInput('Removed', request.ownerId, [result.removedId], [request.abilityId], {}) });
          }
        } else if (result.kind === 'BLOCKED') {
          context.commands.push({
            kind: 'append_event',
            event: eventInput('SummonLimitBlocked', request.ownerId, [], [request.abilityId], { activeCount: registry.summonCount(request.side) }),
          });
        }
      }
      context.commands.push({ kind: 'set_temporary_entities', entities: registry.snapshot() });
      context.commands.push({ kind: 'set_planned_effects', effects: planned.filter((effect) => !consumed.has(effect.commandId)) });
    },
  });
}

/** Stage K: expire temporary entities and remove owner-bound summons (§6). */
export function createTemporaryExpirySystem(): KernelSystem {
  return Object.freeze({
    id: 'phase20.k0.temporary_expiry',
    stage: 'K' as const,
    run(context: TickContext): void {
      const temps = context.state.temporaryEntities;
      if (temps === undefined || temps.length === 0) return;
      const now = context.state.tick;
      const removed: TempEntity[] = [];
      const remaining = temps.filter((entity) => {
        const expired = entity.expiresAtTick !== undefined && now >= entity.expiresAtTick;
        const ownerDead = entity.removeOnOwnerDefeat === true && (() => {
          const owner = ownerOf(context.state.entities, entity.ownerId);
          return owner === undefined || owner.phase.phase === 'DEFEATED' || owner.phase.phase === 'REMOVED';
        })();
        if (expired || ownerDead) {
          removed.push(entity);
          return false;
        }
        return true;
      });
      if (removed.length === 0) return;
      for (const entity of removed) {
        context.commands.push({ kind: 'append_event', event: eventInput('Removed', entity.ownerId, [entity.id], [entity.sourceId], {}) });
      }
      context.commands.push({ kind: 'set_temporary_entities', entities: remaining });
    },
  });
}

/** Phase 20 A–M composition: synergy commit, expiry and summon commit. */
export function createPhase20Systems(config: Phase20RuntimeConfig = {}): readonly KernelSystem[] {
  return Object.freeze([createSynergyCommitSystem(config), createSummonCommitSystem(config), createTemporaryExpirySystem()]);
}
