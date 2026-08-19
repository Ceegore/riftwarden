import { KernelInvariantError } from '../core/invariant-error.js';
import { asciiCompare } from '../core/primitives.js';

/**
 * Phase 20 §3.3 temporary-entity model. Temporary entities (SUMMON, CONSTRUCT,
 * BOSS_OBJECT) are tracked in the Temporary Registry, separate from the regular
 * unit roster. Every record has a stable id (allocated before placement, §5.2),
 * owner side, source attribution, created tick/sequence, optional lifetime and
 * slot, a counted flag and optional removal policy + result attribution (§8).
 * All numbers are authoritative integers — no floats, no wallclock, no locale.
 */

export const SUMMON_CAP_PER_SIDE = 6;
export const RECURSIVE_SPAWN_BUDGET = 64;
export const REPAIR_DELAY_TICKS = 90;

export const TEMP_KINDS = ['SUMMON', 'CONSTRUCT', 'BOSS_OBJECT'] as const;
export type TempKind = (typeof TEMP_KINDS)[number];

export const CAP_POLICIES = ['BLOCK', 'REPLACE_OLDEST', 'BUFF_OLDEST'] as const;
export type CapPolicy = (typeof CAP_POLICIES)[number];

export const CONSTRUCT_SLOT_POLICIES = ['FAIL', 'REPLACE'] as const;
export type ConstructSlotPolicy = (typeof CONSTRUCT_SLOT_POLICIES)[number];

export const REMOVAL_REASONS = ['EXPIRED', 'DEFEATED', 'OWNER_DEFEAT', 'REPLACED', 'CLEANUP'] as const;
export type RemovalReason = (typeof REMOVAL_REASONS)[number];

export type TempSide = 'player' | 'enemy';

/** Result attribution carried on every temporary entity (§8). */
export interface TempAttribution {
  readonly sourceKind: 'ability' | 'synergy' | 'system';
  readonly sourceId: string;
  /** Synergy activation tier when sourceKind === 'synergy'; otherwise undefined. */
  readonly tier?: number;
}

export interface TempEntity {
  readonly id: string;
  readonly side: TempSide;
  readonly kind: TempKind;
  /** CountedFlag (§8): only committed, active summons count toward the cap. */
  readonly counted: boolean;
  /** Regular unit that owns this temporary entity (§6 owner binding). */
  readonly ownerId: string;
  /** Ability/synergy id that produced this entity (§3.3 Source). */
  readonly sourceId: string;
  readonly createdTick: number;
  readonly createdSequence: number;
  /** Lifetime in authoritative ticks; absent means no expiry (§6). */
  readonly expiresAtTick?: number;
  /** Construct slot / summon slot reference (§7); absent when slotless. */
  readonly slotId?: string;
  /** Content removal policy: owner death removes only when true (§6). */
  readonly removeOnOwnerDefeat?: boolean;
  /** Result attribution for battle-end bookkeeping (§8). */
  readonly attribution?: TempAttribution;
}

/** §5.1 reserved spawn request, ordered canonically before commit. */
export interface SpawnRequest {
  readonly reservedEntityId: string;
  readonly side: TempSide;
  readonly ownerId: string;
  readonly sourceId: string;
  readonly requestedTick: number;
  readonly sourcePriority: number;
  readonly sourceEntityId: string;
  readonly abilityId: string;
  readonly requestSequence: number;
  readonly policy: CapPolicy;
}

/** §5.3 commit outcome. BLOCKED consumes the reserved id (never reused). */
export interface SpawnResult {
  readonly kind: 'SPAWNED' | 'BLOCKED' | 'BUFFED' | 'REPLACED';
  readonly entityId: string;
  readonly removedId?: string;
  readonly diagnostic?: string;
}

const ID = /^[a-z][a-z0-9_]*$/;

function assertId(value: string, field: string): void {
  if (!ID.test(value)) throw new KernelInvariantError('P20_TEMP_INVALID', { field, value });
}

function assertTick(value: number, field: string): void {
  if (!Number.isSafeInteger(value) || value < 0 || Object.is(value, -0)) {
    throw new KernelInvariantError('P20_TEMP_INVALID', { field, value });
  }
}

export function isTempKind(value: unknown): value is TempKind {
  return typeof value === 'string' && (TEMP_KINDS as readonly string[]).includes(value);
}

export function isCapPolicy(value: unknown): value is CapPolicy {
  return typeof value === 'string' && (CAP_POLICIES as readonly string[]).includes(value);
}

export function isTempSide(value: unknown): value is TempSide {
  return value === 'player' || value === 'enemy';
}

export function validateTempEntity(entity: TempEntity): void {
  assertId(entity.id, 'id');
  if (!isTempSide(entity.side)) throw new KernelInvariantError('P20_TEMP_INVALID', { field: 'side', value: entity.side });
  if (!isTempKind(entity.kind)) throw new KernelInvariantError('P20_TEMP_INVALID', { field: 'kind', value: entity.kind });
  if (typeof entity.counted !== 'boolean') throw new KernelInvariantError('P20_TEMP_INVALID', { field: 'counted', value: entity.counted });
  assertId(entity.ownerId, 'ownerId');
  assertId(entity.sourceId, 'sourceId');
  assertTick(entity.createdTick, 'createdTick');
  assertTick(entity.createdSequence, 'createdSequence');
  if (entity.expiresAtTick !== undefined) assertTick(entity.expiresAtTick, 'expiresAtTick');
  if (entity.slotId !== undefined) assertId(entity.slotId, 'slotId');
  if (entity.removeOnOwnerDefeat !== undefined && typeof entity.removeOnOwnerDefeat !== 'boolean') {
    throw new KernelInvariantError('P20_TEMP_INVALID', { field: 'removeOnOwnerDefeat', value: entity.removeOnOwnerDefeat });
  }
  if (entity.attribution !== undefined) {
    const a = entity.attribution;
    assertId(a.sourceId, 'attribution.sourceId');
    if (a.tier !== undefined && (!Number.isSafeInteger(a.tier) || a.tier < 0)) {
      throw new KernelInvariantError('P20_TEMP_INVALID', { field: 'attribution.tier', value: a.tier });
    }
  }
}

/** Validates, deep-freezes and returns a temporary entity. */
export function createTempEntity(entity: TempEntity): TempEntity {
  validateTempEntity(entity);
  const attribution = entity.attribution === undefined ? undefined : Object.freeze({ ...entity.attribution });
  const frozen: TempEntity = attribution === undefined ? Object.freeze({ ...entity }) : Object.freeze({ ...entity, attribution });
  return frozen;
}

/** §8 canonical iteration order: code-unit compare on id, never localeCompare. */
export function compareTempEntity(a: TempEntity, b: TempEntity): number {
  return asciiCompare(a.id, b.id);
}
