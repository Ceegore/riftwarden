import { KernelInvariantError } from '../core/invariant-error.js';

/**
 * Phase 18 T01 status-instance model (§5). All values are closed unions or
 * safe integers; content names and localized text are never simulation keys.
 *
 * The closed `StatusKind` union below is derived from the authoritative
 * content schema (`content/schemas/status.ts` kind enum) minus `shield`:
 * shields are stacked and removed by the Phase-17 shield ledger, not as
 * status instances (§6, §9.2).
 */

export const STATUS_KINDS = [
  'attack_up',
  'attack_speed_up',
  'move_speed_up',
  'resistance_up',
  'regeneration',
  'burn',
  'poison',
  'slow',
  'weaken',
  'silence',
  'stun',
  'mark',
  'confusion',
] as const;
export type StatusKind = (typeof STATUS_KINDS)[number];

/** §6: exactly these five stack policies are allowed. */
export const STACK_POLICIES = [
  'replace_if_stronger',
  'refresh_duration',
  'extend_duration_capped',
  'independent_by_source',
  'no_reapply',
] as const;
export type StackPolicy = (typeof STACK_POLICIES)[number];

/** §9: closed removal reasons (expiry, removal and end-of-battle paths). */
export const REMOVAL_REASONS = [
  'expired',
  'cleansed',
  'dispelled',
  'replaced',
  'consumed',
  'target_defeated',
  'battle_ended',
] as const;
export type RemovalReason = (typeof REMOVAL_REASONS)[number];

/** Dispel category is the content-supplied polarity of a status. */
export type StatusPolarity = 'positive' | 'negative' | 'control';

/** §8.1: hard control (stun/silence/confusion) vs soft control (slow). */
export type ControlCategory = 'hard' | 'soft';

/** §7.2: closed periodic effect kinds (burn, poison, regeneration). */
export const PERIODIC_EFFECT_KINDS = ['burn', 'poison', 'regeneration'] as const;
export type PeriodicEffectKind = (typeof PERIODIC_EFFECT_KINDS)[number];

const HARD_CONTROL_KINDS: ReadonlySet<string> = new Set(['stun', 'silence', 'confusion']);

export function controlCategoryOf(kind: StatusKind): ControlCategory | null {
  if (kind === 'slow') return 'soft';
  return HARD_CONTROL_KINDS.has(kind) ? 'hard' : null;
}

/** End-tick sentinel for a status with no expiry (safe integer, §5.1). */
export const PERMANENT_END_TICK = Number.MAX_SAFE_INTEGER;

/**
 * Closed per-instance flags. `unremovable` blocks cleanse/dispel (§9.1);
 * `initial_tick` authorizes a periodic tick at apply time (§7.1); the kernel
 * sets `expiry_marked` when stage B marks an instance for stable removal.
 */
export const STATUS_FLAGS = ['unremovable', 'initial_tick', 'expiry_marked'] as const;
export type StatusFlag = (typeof STATUS_FLAGS)[number];

/**
 * §7.1: persisted periodic scheduling state. `nextTick` advances by exactly
 * `intervalTicks` each firing (no drift after resume); `tickIndex` is the
 * monotonic firing ordinal; `dedupKey` binds the effect to its content source.
 */
export interface PeriodicState {
  readonly effectKind: PeriodicEffectKind;
  readonly intervalTicks: number;
  readonly nextTick: number;
  readonly tickIndex: number;
  readonly initialTick: boolean;
  readonly dedupKey: string;
}

/**
 * §5.1: authoritative status instance. `endTick` is exclusive — the status is
 * active for ticks `< endTick`. Numbers are safe integers; `sequence` is the
 * monotonic apply ordinal within the battle.
 */
export interface StatusInstance {
  readonly statusId: string;
  readonly kind: StatusKind;
  readonly polarity: StatusPolarity;
  readonly targetId: string;
  readonly sourceId: string;
  readonly effectId: string;
  readonly startTick: number;
  readonly endTick: number;
  readonly strength: number;
  readonly stackGroup: string;
  readonly sequence: number;
  readonly stackPolicy: StackPolicy;
  readonly maxStacks: number;
  readonly flags: readonly StatusFlag[];
  readonly periodic?: PeriodicState;
  readonly contentIconId?: string;
}

const ID = /^[a-z][a-z0-9_]*$/;

/** Stable ordinal for the closed kind union (never derived from array index at runtime). */
const KIND_ORDINAL: Readonly<Record<StatusKind, number>> = Object.freeze(
  STATUS_KINDS.reduce((acc, kind, index) => ({ ...acc, [kind]: index }), {} as Record<StatusKind, number>),
);

export function statusKindOrdinal(kind: StatusKind): number {
  return KIND_ORDINAL[kind];
}

export function isStatusKind(value: string): value is StatusKind {
  return (STATUS_KINDS as readonly string[]).includes(value);
}

/**
 * §5.2/§5.3 strict validation: unknown kinds/policies/flags, non-safe or
 * negative integers, non-exclusive endTick and duplicate flags are hard
 * errors — never "last write wins".
 */
export function validateStatusInstance(instance: StatusInstance): void {
  for (const [key, value] of Object.entries({
    statusId: instance.statusId,
    targetId: instance.targetId,
    sourceId: instance.sourceId,
    effectId: instance.effectId,
    stackGroup: instance.stackGroup,
  })) {
    if (!ID.test(value)) {
      throw new KernelInvariantError('P14_SNAPSHOT_INVALID', { reason: 'status-id-invalid', key, value });
    }
  }
  if (!isStatusKind(instance.kind)) {
    throw new KernelInvariantError('P14_SNAPSHOT_INVALID', { reason: 'status-kind-unknown', kind: instance.kind });
  }
  if (!(STACK_POLICIES as readonly string[]).includes(instance.stackPolicy)) {
    throw new KernelInvariantError('P14_SNAPSHOT_INVALID', { reason: 'status-policy-unknown', stackPolicy: instance.stackPolicy });
  }
  for (const [key, value] of Object.entries({
    startTick: instance.startTick,
    endTick: instance.endTick,
    strength: instance.strength,
    sequence: instance.sequence,
    maxStacks: instance.maxStacks,
  })) {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new KernelInvariantError('P14_SNAPSHOT_INVALID', { reason: 'status-integer-invalid', key, value });
    }
  }
  if (instance.maxStacks < 1) {
    throw new KernelInvariantError('P14_SNAPSHOT_INVALID', { reason: 'status-max-stacks', maxStacks: instance.maxStacks });
  }
  if (instance.endTick !== PERMANENT_END_TICK && instance.endTick <= instance.startTick) {
    throw new KernelInvariantError('P14_SNAPSHOT_INVALID', { reason: 'status-end-before-start', startTick: instance.startTick, endTick: instance.endTick });
  }
  const seen = new Set<string>();
  for (const flag of instance.flags) {
    if (!(STATUS_FLAGS as readonly string[]).includes(flag)) {
      throw new KernelInvariantError('P14_SNAPSHOT_INVALID', { reason: 'status-flag-unknown', flag });
    }
    if (seen.has(flag)) {
      throw new KernelInvariantError('P14_SNAPSHOT_INVALID', { reason: 'status-flag-duplicate', flag });
    }
    seen.add(flag);
  }
  if (instance.periodic !== undefined) {
    if (!(PERIODIC_EFFECT_KINDS as readonly string[]).includes(instance.periodic.effectKind)) {
      throw new KernelInvariantError('P14_SNAPSHOT_INVALID', { reason: 'status-periodic-kind-unknown', effectKind: instance.periodic.effectKind });
    }
    for (const [key, value] of Object.entries({
      intervalTicks: instance.periodic.intervalTicks,
      nextTick: instance.periodic.nextTick,
      tickIndex: instance.periodic.tickIndex,
    })) {
      if (!Number.isSafeInteger(value) || value < 0) {
        throw new KernelInvariantError('P14_SNAPSHOT_INVALID', { reason: 'status-periodic-integer-invalid', key, value });
      }
    }
    if (instance.periodic.intervalTicks < 1) {
      throw new KernelInvariantError('P14_SNAPSHOT_INVALID', { reason: 'status-periodic-interval', intervalTicks: instance.periodic.intervalTicks });
    }
    if (!ID.test(instance.periodic.dedupKey)) {
      throw new KernelInvariantError('P14_SNAPSHOT_INVALID', { reason: 'status-periodic-dedup-invalid', dedupKey: instance.periodic.dedupKey });
    }
  }
}

/**
 * Canonical §11 ordering comparator: targetId, kind, stackGroup, sourceId,
 * statusId, sequence. Pure code-unit comparison, never localeCompare.
 */
export function compareStatusInstances(a: StatusInstance, b: StatusInstance): number {
  const keys = [
    [a.targetId, b.targetId],
    [statusKindOrdinal(a.kind), statusKindOrdinal(b.kind)],
    [a.stackGroup, b.stackGroup],
    [a.sourceId, b.sourceId],
    [a.statusId, b.statusId],
    [a.sequence, b.sequence],
  ] as const;
  for (const [x, y] of keys) {
    if (x < y) return -1;
    if (x > y) return 1;
  }
  return 0;
}
