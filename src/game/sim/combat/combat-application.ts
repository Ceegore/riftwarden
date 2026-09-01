import type { KernelEntity } from '../core/entity.js';
import type { KernelSystem, TickContext } from '../core/tick-context.js';
import { effectiveDefense, cappedTrueDamage } from '../math/combat-formulas.js';
import { mulDivRound } from '../math/fixed-math.js';
import { basisPoints, milliValue } from '../../rules/units.js';
import type { KernelEventInput } from '../events/event-types.js';
import { aggregateShields, consumeShields, expireShields, validateShieldSource, type ShieldConsumption, type ShieldSource } from './shield-ledger.js';
import { COLLAPSE_HEAL_FACTOR_BPS, COLLAPSE_WINDOW_TICKS } from './battle-end-resolver.js';
import { bossObjectDamageAmount, bossObjectHpDelta, type DamagePolicy } from '../boss/boss-object-manager.js';

/** Damage type ordinals (§8.1): physical, magical, pure. */
export const DAMAGE_TYPE_PHYSICAL = 0;
export const DAMAGE_TYPE_MAGICAL = 1;
export const DAMAGE_TYPE_PURE = 2;

/** Cover reduction for projectile hits: 12% (§7). */
export const PROJECTILE_COVER_REDUCTION_BPS = 1200;

/** Boss single-hit cap: 18% of max LP (§8.1). */
export const BOSS_HIT_CAP_BPS = 1800;

/**
 * A queued combat application (P17 §5.3/§6). Stage H queues these; stage I
 * applies them strictly. `applicationSequence` is assigned by the reducer for
 * shield ledger ordering.
 */
export type PendingCombatApplication =
  | Readonly<{
      kind: 'damage';
      sourceId: string;
      targetId: string;
      effectId: string;
      attackInstanceId: number;
      effectIndex: number;
      rawAmount: number;
      damageTypeOrdinal: number;
      defense: number;
      /** Basis-point cover reduction (0 = none; 1200 = projectile default). */
      coverReductionBps: number;
      /** Boss cap as basis points of max LP, or null when the target is not a boss. */
      bossCapBps: number | null;
    }>
  | Readonly<{
      kind: 'heal';
      sourceId: string;
      targetId: string;
      effectId: string;
      attackInstanceId: number;
      effectIndex: number;
      rawAmount: number;
      /** Basis-point heal multiplier (10000 = full; 5000 = collapse halving). */
      healFactorBps: number;
    }>
  | Readonly<{
      kind: 'shield';
      sourceId: string;
      targetId: string;
      effectId: string;
      attackInstanceId: number;
      effectIndex: number;
      rawAmount: number;
      expiryTick: number;
      priority: number;
      applicationSequence: number;
    }>;

export interface DamageOutcome {
  readonly effectiveDefense: number;
  readonly preShieldAmount: number;
  readonly absorbedShield: number;
  readonly finalHpDelta: number;
  readonly hpBefore: number;
  readonly hpAfter: number;
  readonly shieldBefore: number;
  readonly shieldAfter: number;
}

/** §8.1 integer pipeline: raw -> defense -> boss cap -> cover -> min/null
 * rule -> boss-object policy gate -> shield ledger -> HP,
 * round-half-away-from-zero at every step. Pure damage skips defense; a
 * successful non-negated hit deals at least 1. The optional §6 boss-object
 * damage policy gates the hit after the min/null rule (`immune` negates the
 * whole hit before shields) and gates the HP delta after shields
 * (`shield_only` lets shields absorb but never reduces object HP). */
export function applyDamagePipeline(target: KernelEntity, shields: readonly ShieldSource[], application: Extract<PendingCombatApplication, { kind: 'damage' }>, policy?: DamagePolicy): { readonly outcome: DamageOutcome; readonly shields: readonly ShieldSource[]; readonly consumption: ShieldConsumption } {
  const hpBefore = target.lp;
  const shieldBefore = aggregateShields(shields);
  let value = application.rawAmount;
  const defense = effectiveDefense(application.defense);
  if (value > 0 && application.damageTypeOrdinal !== DAMAGE_TYPE_PURE) {
    value = mulDivRound(value, 100, 100 + defense);
  }
  if (value > 0 && application.bossCapBps !== null && application.bossCapBps > 0) {
    value = cappedTrueDamage(milliValue(value), milliValue(target.maxLp), basisPoints(application.bossCapBps));
  }
  if (value > 0 && application.coverReductionBps > 0) {
    value = mulDivRound(value, 10000 - application.coverReductionBps, 10000);
  }
  // §8.1 min/null rule: negative end values are 0; a successful non-negated
  // attack always deals at least 1 damage (before the shield ledger).
  if (value < 0) value = 0;
  else if (value === 0 && application.rawAmount > 0) value = 1;
  // §6 boss-object gate: `immune` negates the entire hit before shields —
  // nothing is absorbed, nothing reaches HP.
  if (policy !== undefined) value = bossObjectDamageAmount(policy, value);
  const { sources, consumption } = consumeShields(shields, value);
  const absorbedShield = consumption.absorbed;
  const postShield = Math.max(0, value - absorbedShield);
  // HP never goes below 0; the applied delta is clamped to remaining LP.
  // §6 boss-object gate: `shield_only` never reduces object HP — shields
  // absorb, the overflow is discarded.
  const finalHpDelta = bossObjectHpDelta(policy, Math.min(postShield, target.lp));
  const hpAfter = target.lp - finalHpDelta;
  const shieldAfter = aggregateShields(sources);
  return {
    outcome: Object.freeze({
      effectiveDefense: defense,
      preShieldAmount: value,
      absorbedShield,
      finalHpDelta,
      hpBefore,
      hpAfter,
      shieldBefore,
      shieldAfter,
    }),
    shields: sources,
    consumption,
  };
}

function damagePayload(application: Extract<PendingCombatApplication, { kind: 'damage' }>, o: DamageOutcome): Record<string, number> {
  return {
    rawAmount: application.rawAmount, damageTypeOrdinal: application.damageTypeOrdinal, effectiveDefense: o.effectiveDefense,
    preShieldAmount: o.preShieldAmount, absorbedShield: o.absorbedShield, finalHpDelta: o.finalHpDelta,
    hpBefore: o.hpBefore, hpAfter: o.hpAfter, shieldBefore: o.shieldBefore, shieldAfter: o.shieldAfter,
    attackInstanceId: application.attackInstanceId, effectIndex: application.effectIndex,
  };
}

function healPayload(application: Extract<PendingCombatApplication, { kind: 'heal' }>, o: HealOutcome): Record<string, number> {
  return {
    rawAmount: o.rawAmount, finalHpDelta: o.finalHpDelta, hpBefore: o.hpBefore, hpAfter: o.hpAfter,
    attackInstanceId: application.attackInstanceId, effectIndex: application.effectIndex,
  };
}

export interface HealOutcome {
  readonly rawAmount: number;
  readonly finalHpDelta: number;
  readonly hpBefore: number;
  readonly hpAfter: number;
}

/** §8.3 heal: ends at max LP, overheal decays, collapse halves via factor. */
export function applyHealPipeline(target: KernelEntity, application: Extract<PendingCombatApplication, { kind: 'heal' }>): HealOutcome {
  const hpBefore = target.lp;
  let amount = application.rawAmount;
  if (amount > 0 && application.healFactorBps < 10000) {
    amount = mulDivRound(amount, application.healFactorBps, 10000);
  }
  const finalHpDelta = Math.max(0, Math.min(amount, target.maxLp - hpBefore));
  return Object.freeze({ rawAmount: application.rawAmount, finalHpDelta, hpBefore, hpAfter: hpBefore + finalHpDelta });
}

function eventFor(application: PendingCombatApplication, event: string, targetId: string, payload: Record<string, number>): KernelEventInput {
  return Object.freeze({
    type: event as never,
    sourceId: application.sourceId,
    targetIds: Object.freeze([targetId]),
    contentIds: Object.freeze([application.effectId]),
    payload: Object.freeze(payload),
    logTags: Object.freeze(['sim.phase17']),
  });
}

/** Stage I system (§8). Applies every queued combat application strictly:
 * damage/heal/shield mutate LP and the ledger, each emits its §8.4 apply
 * event. Real damage and real heals reset the §9.4 global no-progress endcap
 * (qualifying progress), mirroring the stage-J kill reset and the stage-K
 * spawn reset. No death effects or removes here — that is stage J (T05, not
 * pre-taken). Expired shields drop first with a separate event. */
export interface CombatApplicationConfig {
  /** Boss entity ids for the Chapter-76 boss-damage tie-break (§10). */
  readonly bossIds?: ReadonlySet<string>;
  /** §6 boss-object damage policy per entity id (normal/immune/shield_only). */
  readonly bossObjectPolicies?: ReadonlyMap<string, DamagePolicy>;
}

export function createCombatApplicationSystem(config: CombatApplicationConfig = {}): KernelSystem {
  return {
    id: 'phase17.i1.combat_application',
    stage: 'I',
    run(context: TickContext): void {
      const pending = context.state.pendingCombatApplications ?? [];
      // Local projection: same-tick multi-applications compose in queue order (§9).
      let projected = context.state.entities;
      const shieldUpdates = new Map<string, readonly ShieldSource[]>();
      for (const application of pending) {
        const target = projected.find((e) => e.id === application.targetId);
        if (target === undefined || target.phase.phase === 'REMOVED') continue;
        // Drop expired shields first (separate explainable event, §8.2).
        const currentShields = shieldUpdates.get(target.id) ?? target.shields ?? Object.freeze([]);
        const expired = expireShields(currentShields, context.state.tick);
        let shields = expired.sources;
        for (const source of expired.expired) {
          context.commands.push({ kind: 'append_event', event: eventFor(application, 'ShieldExpired', target.id, { amount: source.remaining }) });
        }
        let nextLp = target.lp;
        if (application.kind === 'damage') {
          // §4/§5/§10 hard invulnerability: while EITHER boss authority's
          // committed invulnerable window is active for this target, hits
          // land but deal nothing — mirrors the §6 `immune` boss-object gate.
          const phaseSlot = context.state.bossPhase?.entityId === target.id ? context.state.bossPhase : null;
          const secondSlot = context.state.bossPhaseSecondary?.entityId === target.id ? context.state.bossPhaseSecondary : null;
          const activeSlot = phaseSlot ?? secondSlot;
          const bossInvulnerable = activeSlot !== null && activeSlot.invulnerableUntilTick !== null && context.state.tick < activeSlot.invulnerableUntilTick;
          const policy = bossInvulnerable ? 'immune' : config.bossObjectPolicies?.get(target.id);
          const result = applyDamagePipeline(target, shields, application, policy);
          shields = result.shields;
          for (const detail of result.consumption.perSource) {
            context.commands.push({ kind: 'append_event', event: eventFor(application, 'ShieldAbsorbed', target.id, { amount: detail.absorbed, remaining: detail.remainingAfter }) });
          }
          context.commands.push({ kind: 'apply_lp_delta', entityId: target.id, delta: -result.outcome.finalHpDelta, sourceId: application.sourceId });
          // §9.4: damage that actually reaches HP is qualifying progress — a
          // battle dealing damage must never time out while it is still
          // advancing. Shield-only absorption and 0-damage hits do not count.
          if (result.outcome.finalHpDelta > 0) {
            context.commands.push({ kind: 'set_global_progress', noProgressTicks: 0, collapseTicks: 0, warned: false });
          }
          // §10 Chapter-76: damage dealt to a boss is attributed to the opposing
          // side (no friendly fire), feeding the boss-damage tie-break. The
          // effective damage is the post-shield amount that reached HP.
          if (config.bossIds?.has(target.id) === true) {
            const effective = Math.max(0, result.outcome.preShieldAmount - result.outcome.absorbedShield);
            if (effective > 0) context.commands.push({ kind: 'record_boss_damage', side: target.side === 'enemy' ? 'player' : 'enemy', amount: effective });
          }
          // §9: stage I records the killing blow's overkill (excess beyond the
          // remaining LP); stage J consumes it for the Defeated event.
          if (result.outcome.hpAfter === 0) context.commands.push({ kind: 'set_pending_overkill', entityId: target.id, overkill: Math.max(0, result.outcome.preShieldAmount - result.outcome.absorbedShield - result.outcome.finalHpDelta) });
          context.commands.push({ kind: 'append_event', event: eventFor(application, 'DamageApplied', target.id, damagePayload(application, result.outcome)) });
          nextLp = Math.max(0, target.lp - result.outcome.finalHpDelta);
        } else if (application.kind === 'heal') {
          // §10: during the rift-collapse window healing is halved (factor 5000)
          // regardless of the content-supplied factor.
          const collapseActive = context.state.timeCollapseSinceTick !== undefined
            && context.state.tick >= context.state.timeCollapseSinceTick
            && context.state.tick < context.state.timeCollapseSinceTick + COLLAPSE_WINDOW_TICKS;
          const factor = collapseActive ? Math.min(application.healFactorBps, COLLAPSE_HEAL_FACTOR_BPS) : application.healFactorBps;
          const outcome = applyHealPipeline(target, { ...application, healFactorBps: factor });
          if (outcome.finalHpDelta > 0) {
            context.commands.push({ kind: 'apply_lp_delta', entityId: target.id, delta: outcome.finalHpDelta, sourceId: application.sourceId });
            // §9.4: a heal that actually restores HP is qualifying progress.
            context.commands.push({ kind: 'set_global_progress', noProgressTicks: 0, collapseTicks: 0, warned: false });
          }
          context.commands.push({ kind: 'append_event', event: eventFor(application, 'HealApplied', target.id, healPayload(application, outcome)) });
          nextLp = Math.min(target.maxLp, target.lp + outcome.finalHpDelta);
        } else {
          const source: ShieldSource = Object.freeze({
            shieldId: `shield_${application.targetId}_${String(application.applicationSequence)}`,
            sourceId: application.sourceId,
            effectId: application.effectId,
            remaining: application.rawAmount,
            expiryTick: application.expiryTick,
            priority: application.priority,
            applicationSequence: application.applicationSequence,
          });
          validateShieldSource(source);
          shields = Object.freeze([...shields, source]);
          const shieldBefore = aggregateShields(shields.filter((s) => s.shieldId !== source.shieldId));
          context.commands.push({
            kind: 'append_event',
            event: eventFor(application, 'ShieldApplied', target.id, {
              rawAmount: source.remaining,
              remaining: source.remaining,
              expiryTick: source.expiryTick,
              priority: source.priority,
              shieldBefore,
              shieldAfter: shieldBefore + source.remaining,
              attackInstanceId: application.attackInstanceId,
              effectIndex: application.effectIndex,
            }),
          });
        }
        // §9: same-tick applications compose in queue order — the projection
        // must fold LP changes too, so a second hit in the same tick sees the
        // post-first-hit HP (correct hpBefore/hpAfter, killing blow, overkill).
        shieldUpdates.set(target.id, shields);
        projected = projected.map((e) => (e.id === target.id ? Object.freeze({ ...e, shields, lp: nextLp }) : e));
      }
      for (const [entityId, shields] of shieldUpdates) {
        context.commands.push({ kind: 'set_shields', entityId, shields });
      }
      if (pending.length > 0) {
        context.commands.push({ kind: 'clear_combat_applications' });
      }
    },
  };
}
