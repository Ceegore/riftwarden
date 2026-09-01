import { KernelInvariantError } from '../core/invariant-error.js';
import { asciiCompare } from '../core/primitives.js';
import type { KernelEntity } from '../core/entity.js';
import type { KernelSystem, TickContext } from '../core/tick-context.js';
import type { KernelEventInput } from '../events/event-types.js';
import { asFieldX100, LANES, type Lane } from '../geometry/x100.js';
import { TemporaryRegistry } from '../summon/temporary-registry.js';
import type { TempEntity, TempSide } from '../summon/temporary-entity.js';

/**
 * Phase 21 §6 boss-object manager (T03). A `boss_object` is its own
 * temporary-entity category — never a regular unit or troop copy. Four stable
 * object slots are described by slot id, lane, x100 position, targetability,
 * objective link, damage/status policy and cleanup policy. The entity id is
 * reserved before placement; a blocked spawn emits a stable diagnostic and
 * follows only the defined fallback policy (never silent improvisation).
 */

export const BOSS_OBJECT_SLOTS = 4;
export const BOSS_OBJECT_SLOT_IDS = ['boss_slot_0', 'boss_slot_1', 'boss_slot_2', 'boss_slot_3'] as const;
export type BossObjectSlotId = (typeof BOSS_OBJECT_SLOT_IDS)[number];

export const BOSS_OBJECT_FALLBACKS = ['FAIL', 'DEFER'] as const;
export type BossObjectFallback = (typeof BOSS_OBJECT_FALLBACKS)[number];

export const DAMAGE_POLICIES = ['normal', 'immune', 'shield_only'] as const;
export type DamagePolicy = (typeof DAMAGE_POLICIES)[number];

export const STATUS_POLICIES = ['allow', 'block'] as const;
export type StatusPolicy = (typeof STATUS_POLICIES)[number];

export const CLEANUP_POLICIES = ['on_objective', 'on_battle_end', 'manual'] as const;
export type CleanupPolicy = (typeof CLEANUP_POLICIES)[number];

export interface BossObjectSpec {
  readonly slotId: BossObjectSlotId;
  readonly lane: Lane;
  readonly x100: number;
  readonly targetable: boolean;
  readonly objectiveLink: string | null;
  readonly damagePolicy: DamagePolicy;
  readonly statusPolicy: StatusPolicy;
  readonly cleanupPolicy: CleanupPolicy;
  /** Fallback when the slot is already occupied (§6). */
  readonly fallback: BossObjectFallback;
}

export interface BossObjectPlacement {
  readonly kind: 'PLACED' | 'BLOCKED' | 'DEFERRED';
  readonly entity: TempEntity | null;
  readonly diagnostic: string | null;
}

/** Content entry: one encounter boss object, resolved to a registry record (§6). */
export interface BossObjectContent {
  readonly entityId: string;
  readonly side: TempSide;
  readonly ownerId: string;
  readonly sourceId: string;
  readonly spec: BossObjectSpec;
  /** Combat-body stats: the placed object is also a targetable kernel entity. */
  readonly maxLp: number;
  readonly radiusX100: number;
}

import { validateBossObjectContent, buildBossObjectBody, bossObjectDamageAmount, bossObjectHpDelta } from './boss-object-combat.js';
export { validateBossObjectContent, buildBossObjectBody, bossObjectDamageAmount, bossObjectHpDelta };


const ID = /^[a-z][a-z0-9_]*$/;

function assertId(value: string, field: string): void {
  if (!ID.test(value)) throw new KernelInvariantError('P21_OBJECT_INVALID', { field, value });
}

/** Validates a boss-object id format (mirrors ContentIdSchema, §6). */
export function assertBossObjectId(value: string, field: string): void {
  assertId(value, field);
}

/** Validates a boss-object slot specification (§6). */
export function validateBossObjectSpec(spec: BossObjectSpec): void {
  if (!(BOSS_OBJECT_SLOT_IDS as readonly string[]).includes(spec.slotId)) {
    throw new KernelInvariantError('P21_OBJECT_INVALID', { field: 'slotId', slotId: spec.slotId });
  }
  if (!(LANES as readonly string[]).includes(spec.lane)) throw new KernelInvariantError('P21_OBJECT_INVALID', { field: 'lane', lane: spec.lane });
  asFieldX100(spec.x100); // slot x100 is a field position: must be 0..10000 (§6)
  if (typeof spec.targetable !== 'boolean') throw new KernelInvariantError('P21_OBJECT_INVALID', { field: 'targetable' });
  if (spec.objectiveLink !== null) assertId(spec.objectiveLink, 'objectiveLink');
  if (!(DAMAGE_POLICIES as readonly string[]).includes(spec.damagePolicy)) throw new KernelInvariantError('P21_OBJECT_INVALID', { field: 'damagePolicy', damagePolicy: spec.damagePolicy });
  if (!(STATUS_POLICIES as readonly string[]).includes(spec.statusPolicy)) throw new KernelInvariantError('P21_OBJECT_INVALID', { field: 'statusPolicy', statusPolicy: spec.statusPolicy });
  if (!(CLEANUP_POLICIES as readonly string[]).includes(spec.cleanupPolicy)) throw new KernelInvariantError('P21_OBJECT_INVALID', { field: 'cleanupPolicy', cleanupPolicy: spec.cleanupPolicy });
  if (!(BOSS_OBJECT_FALLBACKS as readonly string[]).includes(spec.fallback)) throw new KernelInvariantError('P21_OBJECT_INVALID', { field: 'fallback', fallback: spec.fallback });
}

/** §6: boss objects are their own category and never count as summons or constructs. */
export function isBossObjectCategory(entity: TempEntity): boolean {
  return entity.kind === 'BOSS_OBJECT';
}

/** §6: builds the BOSS_OBJECT temp entity for a valid spec (id reserved before placement). */
export function buildBossObject(
  spec: BossObjectSpec,
  entityId: string,
  side: TempSide,
  ownerId: string,
  sourceId: string,
  createdTick: number,
  createdSequence: number,
): TempEntity {
  validateBossObjectSpec(spec);
  assertId(entityId, 'entityId');
  assertId(ownerId, 'ownerId');
  assertId(sourceId, 'sourceId');
  return Object.freeze({
    id: entityId,
    side,
    kind: 'BOSS_OBJECT' as const,
    counted: false,
    ownerId,
    sourceId,
    createdTick,
    createdSequence,
    slotId: spec.slotId,
  });
}

/**
 * §6 placement against the live registry. An occupied slot is never silently
 * stacked: it resolves to FAIL (blocked, no placement) or DEFER (stable
 * diagnostic, no placement yet) per the spec's fallback policy.
 */
export function placeBossObject(spec: BossObjectSpec, entity: TempEntity, occupied: boolean): BossObjectPlacement {
  validateBossObjectSpec(spec);
  if (!occupied) return Object.freeze({ kind: 'PLACED', entity, diagnostic: null });
  if (spec.fallback === 'DEFER') return Object.freeze({ kind: 'DEFERRED', entity: null, diagnostic: 'P21_OBJECT_SLOT_BLOCKED' });
  return Object.freeze({ kind: 'BLOCKED', entity: null, diagnostic: 'P21_OBJECT_SLOT_BLOCKED' });
}

/** Canonical order for boss-object specs: slot id code-unit compare (§6 stable slots). */
export function compareBossObjectSpecs(a: BossObjectSpec, b: BossObjectSpec): number {
  return asciiCompare(a.slotId, b.slotId);
}

function cleanupEvent(entity: TempEntity): KernelEventInput {
  return Object.freeze({
    type: 'Removed',
    sourceId: entity.ownerId,
    targetIds: Object.freeze([entity.id]),
    contentIds: Object.freeze([entity.sourceId]),
    payload: Object.freeze({}),
    logTags: Object.freeze(['sim.phase21']),
  });
}

/**
 * §6 stage-K cleanup system. Implements the boss-object cleanup lifecycle:
 * - `on_objective`: the registry entry (and its combat body, if still ACTIVE)
 *   is removed once the linked objective completes;
 * - `on_battle_end`: removed as soon as the battle enters its ending phase
 *   (RESOLVING_END or a terminal outcome — every end path passes through
 *   RESOLVING_END, so the final terminal snapshot is clean);
 * - `manual`: never auto-removed.
 * Each removal emits the canonical `Removed` event (owner source, object
 * target) and re-publishes the registry. Content config is static and
 * re-supplied on resume, matching the wave/spawn hooks.
 */
export function createBossObjectCleanupSystem(config: { readonly bossObjects?: readonly BossObjectContent[] } = {}): KernelSystem {
  return Object.freeze({
    id: 'boss.object.k2.cleanup',
    stage: 'K' as const,
    run(context: TickContext): void {
      const entries = config.bossObjects;
      if (entries === undefined || entries.length === 0) return;
      const registry = TemporaryRegistry.restore(context.state.temporaryEntities ?? Object.freeze([]));
      const objectives = new Map((context.state.objectives ?? Object.freeze([])).map((o) => [o.id, o] as const));
      const phase = context.state.phase.phase;
      const battleEnding = phase === 'RESOLVING_END' || phase === 'VICTORY' || phase === 'DEFEAT' || phase === 'DRAW_ABORT';
      const removed: TempEntity[] = [];
      for (const entry of entries) {
        const entity = registry.get(entry.entityId);
        if (entity === undefined) continue; // never placed / already removed
        const spec = entry.spec;
        if (spec.cleanupPolicy === 'manual') continue;
        if (spec.cleanupPolicy === 'on_battle_end' && battleEnding) {
          removed.push(entity);
          continue;
        }
        if (spec.cleanupPolicy === 'on_objective' && spec.objectiveLink !== null) {
          const objective = objectives.get(spec.objectiveLink);
          if (objective?.complete === true) removed.push(entity);
        }
      }
      if (removed.length === 0) return;
      const existingIds = new Set(context.state.entities.map((e) => e.id));
      for (const entity of removed) {
        registry.remove(entity.id);
        context.commands.push({ kind: 'append_event', event: cleanupEvent(entity) });
        // The combat body follows the registry entry: a cleaned object never
        // lingers as an attackable ACTIVE body.
        if (existingIds.has(entity.id)) context.commands.push({ kind: 'remove_entity', entityId: entity.id });
      }
      context.commands.push({ kind: 'set_temporary_entities', entities: registry.snapshot() });
    },
  });
}

/**
 * §6 stage-K placement system. Commits content-defined boss objects into the
 * temporary registry once at battle start (state tick 0, canonical slot order);
 * a resumed battle already carries its placed objects in the restored registry
 * and the system is a no-op on later ticks. Occupied slots follow only the
 * spec's fallback (BLOCKED/DEFERRED, stable P21_OBJECT_SLOT_BLOCKED
 * diagnostic) — never silent stacking, never improvised placement.
 */
export function createBossObjectPlacementSystem(config: { readonly bossObjects?: readonly BossObjectContent[] } = {}): KernelSystem {
  return Object.freeze({
    id: 'boss.object.k1.place',
    stage: 'K' as const,
    run(context: TickContext): void {
      const entries = config.bossObjects;
      if (entries === undefined || entries.length === 0) return;
      const seen = new Set<string>();
      for (const entry of entries) {
        validateBossObjectContent(entry);
        if (seen.has(entry.entityId)) throw new KernelInvariantError('P21_OBJECT_INVALID', { reason: 'duplicate-entry-id', entityId: entry.entityId });
        seen.add(entry.entityId);
      }
      if (context.state.tick !== 0) return; // placed once at battle start (§6)
      const existingIds = new Set(context.state.entities.map((e) => e.id));
      const registry = TemporaryRegistry.restore(context.state.temporaryEntities ?? Object.freeze([]));
      const ordered = [...entries].sort((a, b) => compareBossObjectSpecs(a.spec, b.spec));
      const placedEntities: TempEntity[] = [];
      const placedBodies: KernelEntity[] = [];
      ordered.forEach((entry, index) => {
        if (registry.has(entry.entityId) || existingIds.has(entry.entityId)) return; // already committed/resumed
        const entity = buildBossObject(entry.spec, entry.entityId, entry.side, entry.ownerId, entry.sourceId, context.state.tick, index);
        const result = placeBossObject(entry.spec, entity, registry.slotOccupied(entry.side, entry.spec.slotId));
        if (result.kind === 'PLACED') {
          placedEntities.push(entity);
          // §6 combat body: the placed object is a targetable kernel entity.
          const body = buildBossObjectBody(entry, context.state.tick);
          existingIds.add(body.id);
          placedBodies.push(body);
        }
        // BLOCKED/DEFERRED: no placement; the fallback contract is the
        // diagnostic, never a silent replacement. (§6)
      });
      for (const placed of placedEntities) registry.add(placed);
      if (placedEntities.length > 0) context.commands.push({ kind: 'set_temporary_entities', entities: registry.snapshot() });
      for (const body of placedBodies) context.commands.push({ kind: 'spawn_entity', entity: body });
    },
  });
}
