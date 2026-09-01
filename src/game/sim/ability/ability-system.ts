import { KernelInvariantError } from '../core/invariant-error.js';
import { mulDivRound } from '../math/fixed-math.js';
import { PERCENT_SCALE } from '../../rules/mechanic-rules.js';
import type { TargetSnapshot } from './ability-target-query.js';
import type { SourceSnapshot } from './effect-command.js';

/**
 * Phase 19 T04 charge/cooldown/cast/interrupt lifecycle (§8). A closed, pure
 * state machine over integer ticks — no wall clock, no animation authority.
 *
 * States: `charging → ready → waiting_target → casting_precommit →
 * cast_committed → recovering → cooldown → charging`, plus `disabled`
 * (silenced) and `exhausted` (uses consumed).
 *
 * GDD V5 is authoritative for the config fields: `chargeTicks` (nullable
 * charge duration), `cooldownTicks`, `castTicks`, `recoveryTicks`,
 * `interruptPolicy`, `usesPerBattle`. The handbook §4 fields
 * `startChargeTicks`/`commitTickOffset` are not present in GDD V5 and are
 * deferred pending a single APPROVED decision; here the commit point is
 * `castStartTick + castTicks` and charge always accumulates from zero.
 *
 * §8.1: charge progresses (silence does not stop it), silence only blocks a
 * new cast. §8.2: before commit the cast is interruptible per policy; once
 * committed, effects run from the source/target snapshots regardless of
 * source death; default interrupt loss is 35% of current charge.
 */

export type AbilityState =
  | 'charging'
  | 'ready'
  | 'waiting_target'
  | 'casting_precommit'
  | 'cast_committed'
  | 'recovering'
  | 'cooldown'
  | 'disabled'
  | 'exhausted';

export const ABILITY_STATES = [
  'charging',
  'ready',
  'waiting_target',
  'casting_precommit',
  'cast_committed',
  'recovering',
  'cooldown',
  'disabled',
  'exhausted',
] as const;

export type InterruptPolicy = 'interruptible' | 'cast_committed' | 'uninterruptible';
export type InvalidTargetPolicy = 'wait' | 'retarget_once_then_wait' | 'consume_without_effect';

export interface AbilityConfig {
  readonly abilityId: string;
  readonly chargeTicks: number | null;
  readonly cooldownTicks: number | null;
  readonly castTicks: number;
  readonly recoveryTicks: number;
  readonly interruptPolicy: InterruptPolicy;
  readonly usesPerBattle: number | null;
  readonly invalidTargetPolicy: InvalidTargetPolicy;
  readonly bossPhaseCancelAllowed: boolean;
}

export interface AbilityInstance {
  readonly abilityInstanceId: string;
  readonly abilityId: string;
  readonly ownerId: string;
  readonly state: AbilityState;
  readonly chargeTicks: number;
  readonly cooldownRemaining: number;
  readonly usesRemaining: number;
  readonly castStartTick: number | null;
  readonly commitTick: number | null;
  readonly recoveryEndTick: number | null;
  readonly targetSnapshot: TargetSnapshot | null;
  readonly sourceSnapshot: SourceSnapshot | null;
  readonly sequence: number;
  /** §11: once-per-battle trigger marker (persisted, snapshot-projected). */
  readonly onceFired: boolean;
}

export type AbilityEvent =
  | 'ready'
  | 'cast_started'
  | 'committed'
  | 'recovery_started'
  | 'cooldown_started'
  | 'interrupted'
  | 'rejected'
  | 'consumed'
  | 'exhausted';

export interface AbilityStep {
  readonly instance: AbilityInstance;
  readonly events: readonly AbilityEvent[];
}

const ID = /^[a-z][a-z0-9_]*$/;
const DEFAULT_INTERRUPT_LOSS_PERCENT = 35;

const step = (instance: AbilityInstance, events: readonly AbilityEvent[] = []): AbilityStep =>
  Object.freeze({ instance, events: Object.freeze([...events]) });

function assertNonNegative(value: number, code: string, field: string): void {
  if (!Number.isSafeInteger(value) || value < 0 || Object.is(value, -0)) throw new KernelInvariantError(code, { [field]: value });
}

function assertNullableTicks(value: number | null, code: string, field: string): void {
  if (value !== null) assertNonNegative(value, code, field);
}

/** §4/§8 validation: closed policies, safe integer tick thresholds. */
export function validateAbilityConfig(config: AbilityConfig): void {
  if (!ID.test(config.abilityId)) throw new KernelInvariantError('P19_ABILITY_INVALID', { abilityId: config.abilityId });
  assertNullableTicks(config.chargeTicks, 'P19_ABILITY_INVALID', 'chargeTicks');
  assertNullableTicks(config.cooldownTicks, 'P19_ABILITY_INVALID', 'cooldownTicks');
  assertNonNegative(config.castTicks, 'P19_ABILITY_INVALID', 'castTicks');
  assertNonNegative(config.recoveryTicks, 'P19_ABILITY_INVALID', 'recoveryTicks');
  if (config.usesPerBattle !== null) {
    assertNonNegative(config.usesPerBattle, 'P19_ABILITY_INVALID', 'usesPerBattle');
    if (config.usesPerBattle < 1) throw new KernelInvariantError('P19_ABILITY_INVALID', { reason: 'uses-per-battle-zero', usesPerBattle: config.usesPerBattle });
  }
  if (!['interruptible', 'cast_committed', 'uninterruptible'].includes(config.interruptPolicy)) {
    throw new KernelInvariantError('P19_ABILITY_INVALID', { interruptPolicy: config.interruptPolicy });
  }
  if (!['wait', 'retarget_once_then_wait', 'consume_without_effect'].includes(config.invalidTargetPolicy)) {
    throw new KernelInvariantError('P19_ABILITY_INVALID', { invalidTargetPolicy: config.invalidTargetPolicy });
  }
}

export function validateAbilityInstance(instance: AbilityInstance): void {
  if (!ID.test(instance.abilityInstanceId) || !ID.test(instance.abilityId) || !ID.test(instance.ownerId)) {
    throw new KernelInvariantError('P19_ABILITY_INVALID', { abilityInstanceId: instance.abilityInstanceId, abilityId: instance.abilityId, ownerId: instance.ownerId });
  }
  if (!(ABILITY_STATES as readonly string[]).includes(instance.state)) {
    throw new KernelInvariantError('P19_ABILITY_INVALID', { state: instance.state });
  }
  for (const [field, value] of [
    ['chargeTicks', instance.chargeTicks],
    ['cooldownRemaining', instance.cooldownRemaining],
    ['usesRemaining', instance.usesRemaining],
    ['sequence', instance.sequence],
  ] as const) {
    assertNonNegative(value, 'P19_ABILITY_INVALID', field);
  }
  for (const [field, value] of [
    ['castStartTick', instance.castStartTick],
    ['commitTick', instance.commitTick],
    ['recoveryEndTick', instance.recoveryEndTick],
  ] as const) {
    if (value !== null) assertNonNegative(value, 'P19_ABILITY_INVALID', field);
  }
  if (typeof instance.onceFired !== 'boolean') throw new KernelInvariantError('P19_ABILITY_INVALID', { onceFired: instance.onceFired });
}

/** §8.1 initial charge: no charge phase ⇒ immediately `ready`. */
export function createAbilityInstance(config: AbilityConfig, abilityInstanceId: string, ownerId: string): AbilityInstance {
  validateAbilityConfig(config);
  const noCharge = config.chargeTicks === null || config.chargeTicks === 0;
  return Object.freeze({
    abilityInstanceId,
    abilityId: config.abilityId,
    ownerId,
    state: noCharge ? 'ready' : 'charging',
    chargeTicks: 0,
    cooldownRemaining: 0,
    usesRemaining: config.usesPerBattle ?? Number.MAX_SAFE_INTEGER,
    castStartTick: null,
    commitTick: null,
    recoveryEndTick: null,
    targetSnapshot: null,
    sourceSnapshot: null,
    sequence: 0,
    onceFired: false,
  });
}

function fullCharge(config: AbilityConfig): number {
  return config.chargeTicks ?? 0;
}

/** §8.2: default interrupt loss is 35% of current charge (integer, round half away from zero). */
export function interruptChargeLoss(instance: AbilityInstance): number {
  return mulDivRound(instance.chargeTicks, DEFAULT_INTERRUPT_LOSS_PERCENT, PERCENT_SCALE);
}

/** Pure per-tick advance (§8.1/§8.2). */
export function advanceAbilityTick(instance: AbilityInstance, config: AbilityConfig, tick: number): AbilityStep {
  validateAbilityInstance(instance);
  switch (instance.state) {
    case 'charging': {
      const next = instance.chargeTicks + 1;
      if (next >= fullCharge(config)) return step(freeze(instance, { state: 'ready', chargeTicks: fullCharge(config) }), ['ready']);
      return step(freeze(instance, { chargeTicks: next }));
    }
    case 'disabled': {
      const next = Math.min(instance.chargeTicks + 1, fullCharge(config));
      return step(freeze(instance, { chargeTicks: next }));
    }
    case 'casting_precommit': {
      if (instance.commitTick !== null && tick >= instance.commitTick) {
        const usesRemaining = Math.max(0, instance.usesRemaining - 1);
        return step(freeze(instance, { state: 'cast_committed', chargeTicks: 0, usesRemaining }), ['committed', 'consumed']);
      }
      return step(instance);
    }
    case 'cast_committed': {
      const recoveryEndTick = (instance.commitTick ?? tick) + config.recoveryTicks;
      return step(freeze(instance, { state: 'recovering', recoveryEndTick }), ['recovery_started']);
    }
    case 'recovering': {
      if (instance.recoveryEndTick !== null && tick >= instance.recoveryEndTick) {
        return step(freeze(instance, { state: 'cooldown', cooldownRemaining: config.cooldownTicks ?? 0 }), ['cooldown_started']);
      }
      return step(instance);
    }
    case 'cooldown': {
      const remaining = instance.cooldownRemaining > 0 ? instance.cooldownRemaining - 1 : 0;
      if (remaining > 0) return step(freeze(instance, { cooldownRemaining: remaining }));
      return fullCharge(config) === 0
        ? step(freeze(instance, { state: 'ready', cooldownRemaining: 0, chargeTicks: 0 }), ['ready'])
        : step(freeze(instance, { state: 'charging', cooldownRemaining: 0, chargeTicks: 0 }));
    }
    case 'ready':
    case 'waiting_target':
    case 'exhausted':
      return step(instance);
  }
}

/** Starts a cast from `ready`/`waiting_target`; silence/uses block it (§8.1). */
export function tryCast(instance: AbilityInstance, config: AbilityConfig, tick: number, target: TargetSnapshot, source: SourceSnapshot): AbilityStep {
  validateAbilityInstance(instance);
  if (instance.state === 'disabled' || instance.state === 'exhausted') return step(instance, ['rejected']);
  if (instance.state !== 'ready' && instance.state !== 'waiting_target') return step(instance, ['rejected']);
  if (instance.usesRemaining <= 0) return step(freeze(instance, { state: 'exhausted' }), ['exhausted', 'rejected']);
  return step(
    freeze(instance, {
      state: 'casting_precommit',
      castStartTick: tick,
      commitTick: tick + config.castTicks,
      targetSnapshot: target,
      sourceSnapshot: source,
    }),
    ['cast_started'],
  );
}

/** §8.2: interruptible only before commit, per policy; 35% charge loss default. */
export function interruptAbility(instance: AbilityInstance, config: AbilityConfig): AbilityStep {
  validateAbilityInstance(instance);
  if (instance.state !== 'casting_precommit') return step(instance);
  if (config.interruptPolicy !== 'interruptible') return step(instance);
  const remaining = Math.max(0, instance.chargeTicks - interruptChargeLoss(instance));
  return step(freeze(instance, { state: 'charging', chargeTicks: remaining, castStartTick: null, commitTick: null, targetSnapshot: null, sourceSnapshot: null }), ['interrupted']);
}

/** §8.1: silence blocks new casts but never stops charge. */
export function applySilence(instance: AbilityInstance, config: AbilityConfig, silent: boolean): AbilityStep {
  validateAbilityInstance(instance);
  if (silent) {
    if (instance.state === 'charging' || instance.state === 'ready' || instance.state === 'waiting_target') {
      return step(freeze(instance, { state: 'disabled' }));
    }
    return step(instance);
  }
  if (instance.state !== 'disabled') return step(instance);
  return instance.chargeTicks >= fullCharge(config)
    ? step(freeze(instance, { state: 'ready' }), ['ready'])
    : step(freeze(instance, { state: 'charging' }));
}

/** §8.2: a boss phase change only cancels the cast if the definition authorizes it. */
export function applyBossPhaseChange(instance: AbilityInstance, config: AbilityConfig): AbilityStep {
  validateAbilityInstance(instance);
  if (!config.bossPhaseCancelAllowed) return step(instance);
  return interruptAbility(instance, config);
}

function freeze(instance: AbilityInstance, patch: Partial<AbilityInstance>): AbilityInstance {
  return Object.freeze({ ...instance, ...patch });
}
