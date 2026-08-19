import { KernelInvariantError } from '../core/invariant-error.js';
import { asciiCompare } from '../core/primitives.js';
import { asX100, LANES, type Lane } from '../geometry/x100.js';
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

const ID = /^[a-z][a-z0-9_]*$/;

function assertId(value: string, field: string): void {
  if (!ID.test(value)) throw new KernelInvariantError('P21_OBJECT_INVALID', { field, value });
}

/** Validates a boss-object slot specification (§6). */
export function validateBossObjectSpec(spec: BossObjectSpec): void {
  if (!(BOSS_OBJECT_SLOT_IDS as readonly string[]).includes(spec.slotId)) {
    throw new KernelInvariantError('P21_OBJECT_INVALID', { field: 'slotId', slotId: spec.slotId });
  }
  if (!(LANES as readonly string[]).includes(spec.lane)) throw new KernelInvariantError('P21_OBJECT_INVALID', { field: 'lane', lane: spec.lane });
  asX100(spec.x100);
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
