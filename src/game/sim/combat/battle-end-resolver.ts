import { KernelInvariantError } from '../core/invariant-error.js';
import type { KernelEntity } from '../core/entity.js';
import type { BattlePhase } from '../core/battle-state.js';
import type { KernelSystem, TickContext } from '../core/tick-context.js';
import { mulDivRound } from '../math/fixed-math.js';
import { GAME_RULES } from '../../rules/game-rules.js';
import { TECHNICAL_RULES } from '../../rules/technical-rules.js';
import { aggregateShields } from './shield-ledger.js';

/**
 * Phase 17 T06 battle-end resolution (§10). Runs in stage L and owns the
 * terminal decision exclusively:
 *
 * - Time limits: normal/elite soft limit 2700 ticks, boss 3600; after the soft
 *   limit a 450-tick rift-collapse window runs. The hard simulation limit is
 *   5400 ticks (kernel-enforced; the resolver must have ended by then).
 * - Rift collapse: during the window, every 90 ticks every regular unit takes
 *   8% max-LP pure damage; healing is halved (§8.3 factor 5000).
 * - Elimination: the battle ends as soon as one side has no combat-capable
 *   regular unit (summons/constructs never count).
 * - Timeout: the newer Chapter-76 order — LP+shield ratio over regular units,
 *   then regular unit count, then boss/target damage, else double defeat.
 *
 * The endcap (stage L, anti-stuck path) may also transition ACTIVE →
 * RESOLVING_END; this system finalizes that window into a terminal outcome via
 * the same Chapter-76 order, so no battle ever stalls in RESOLVING_END (the
 * kernel's 3-tick resolving window is the deadline).
 */

export const SOFT_LIMIT_NORMAL_TICKS = GAME_RULES.normalRiftCollapseStartTicks;
export const SOFT_LIMIT_BOSS_TICKS = GAME_RULES.bossRiftCollapseStartTicks;
export const COLLAPSE_WINDOW_TICKS = GAME_RULES.riftCollapseDurationTicks;
export const HARD_LIMIT_TICKS = GAME_RULES.absoluteBattleAbortTicks;
export const COLLAPSE_DAMAGE_INTERVAL_TICKS = 90;
/** 8% max-LP pure damage per collapse interval (§10). */
export const COLLAPSE_DAMAGE_BPS = 800;
/** §8.3: collapse halves healing (factor 5000/10000). */
export const COLLAPSE_HEAL_FACTOR_BPS = 5000;

export interface BattleEndConfig {
  /** Boss battle → 3600-tick soft limit. Default normal/elite (2700). */
  readonly bossBattle?: boolean;
  /** Roles used by the Chapter-76 boss-damage tie-break (bosses only). */
  readonly bossIds?: ReadonlySet<string>;
}

export function softLimitTicks(config: BattleEndConfig): number {
  return config.bossBattle === true ? SOFT_LIMIT_BOSS_TICKS : SOFT_LIMIT_NORMAL_TICKS;
}

/** §10: a combat-capable regular unit is ACTIVE, origin regular, LP > 0. */
export function isCombatCapableRegular(entity: KernelEntity): boolean {
  if (entity.phase.phase !== 'ACTIVE' || entity.lp <= 0) return false;
  return (entity.origin ?? 'regular') === 'regular';
}

function sideHasCombatCapable(entities: readonly KernelEntity[], side: 'player' | 'enemy'): boolean {
  return entities.some((e) => e.side === side && isCombatCapableRegular(e));
}

export interface SideScore {
  readonly side: 'player' | 'enemy';
  /** (sum current LP + shields) / sum max-LP over regular units (§76). */
  readonly lpShieldRatio: number;
  readonly regularCount: number;
  /** Total damage this side dealt to the opposing boss(es) (§76). */
  readonly bossDamageDealt: number;
}

/** Chapter-76 primary score: LP+shield ratio over regular units; 0 if none. */
export function chapter76Score(entities: readonly KernelEntity[], side: 'player' | 'enemy', bossDamageDealt = 0): SideScore {
  let lpShield = 0;
  let maxLp = 0;
  let regularCount = 0;
  for (const e of entities) {
    if (e.side !== side) continue;
    const origin = e.origin ?? 'regular';
    // Boss objects are never regular units (§P21-T03): they hold no
    // Chapter-76 ratio/count weight, like summons and constructs.
    if (origin === 'summoned' || origin === 'construct' || origin === 'boss_object') continue;
    regularCount += 1;
    lpShield += e.lp + aggregateShields(e.shields ?? Object.freeze([]));
    maxLp += e.maxLp;
  }
  const ratio = maxLp > 0 ? lpShield / maxLp : 0;
  return { side, lpShieldRatio: ratio, regularCount, bossDamageDealt };
}

export type TerminalOutcome = 'VICTORY' | 'DEFEAT' | 'DRAW_ABORT';

/**
 * Chapter-76 tie-break: ratio, then regular count, then boss/target damage,
 * else double defeat. Higher wins for each step (§10).
 */
export function resolveChapter76(playerScore: SideScore, enemyScore: SideScore): TerminalOutcome {
  const byRatio = playerScore.lpShieldRatio - enemyScore.lpShieldRatio;
  if (byRatio !== 0) return byRatio > 0 ? 'VICTORY' : 'DEFEAT';
  const byCount = playerScore.regularCount - enemyScore.regularCount;
  if (byCount !== 0) return byCount > 0 ? 'VICTORY' : 'DEFEAT';
  const byBossDamage = playerScore.bossDamageDealt - enemyScore.bossDamageDealt;
  if (byBossDamage !== 0) return byBossDamage > 0 ? 'VICTORY' : 'DEFEAT';
  return 'DRAW_ABORT';
}

/** Pure stage-L decision for the current tick; testable without the kernel. */
export type BattleEndDecision =
  | { readonly action: 'none' }
  | { readonly action: 'collapse_damage' }
  | { readonly action: 'request_end'; readonly reason: string }
  | { readonly action: 'finalize'; readonly outcome: TerminalOutcome; readonly reason: string };

export function resolveBattleEnd(state: {
  readonly tick: number;
  readonly entities: readonly KernelEntity[];
  readonly phase: { readonly phase: BattlePhase };
  /** Chapter-76 boss-damage ledger: damage each side dealt to opposing bosses. */
  readonly bossDamageDealt?: Readonly<{ player: number; enemy: number }>;
  /** Mission-forced terminal outcome (protect_object failure, §P21-T03). */
  readonly forcedOutcome?: Readonly<{ outcome: 'VICTORY' | 'DEFEAT' | 'DRAW_ABORT'; reason: string }>;
}, config: BattleEndConfig, resolvingEndTicks: number): BattleEndDecision {
  const tick = state.tick;
  if (state.phase.phase === 'RESOLVING_END') {
    // The 3-tick resolving window (kernel deadline) is honored before the
    // terminal decision. A mission-forced outcome (e.g. protect_object
    // failure, §P21-T03) wins over elimination and the Chapter-76 order.
    if (resolvingEndTicks < TECHNICAL_RULES.resolvingEndMaxTicks) return { action: 'none' };
    const forced = state.forcedOutcome;
    if (forced !== undefined) return { action: 'finalize', outcome: forced.outcome, reason: forced.reason };
    const playerAlive = sideHasCombatCapable(state.entities, 'player');
    const enemyAlive = sideHasCombatCapable(state.entities, 'enemy');
    if (!playerAlive && !enemyAlive) return { action: 'finalize', outcome: 'DRAW_ABORT', reason: 'mutual_extermination' };
    if (!playerAlive) return { action: 'finalize', outcome: 'DEFEAT', reason: 'side_eliminated' };
    if (!enemyAlive) return { action: 'finalize', outcome: 'VICTORY', reason: 'side_eliminated' };
    const playerScore = chapter76Score(state.entities, 'player', state.bossDamageDealt?.player ?? 0);
    const enemyScore = chapter76Score(state.entities, 'enemy', state.bossDamageDealt?.enemy ?? 0);
    const outcome = resolveChapter76(playerScore, enemyScore);
    return { action: 'finalize', outcome, reason: 'chapter76_timeout' };
  }
  if (state.phase.phase !== 'ACTIVE') return { action: 'none' };
  const softLimit = softLimitTicks(config);
  const playerAlive = sideHasCombatCapable(state.entities, 'player');
  const enemyAlive = sideHasCombatCapable(state.entities, 'enemy');
  if (!playerAlive && !enemyAlive) return { action: 'request_end', reason: 'mutual_extermination' };
  if (!playerAlive) return { action: 'request_end', reason: 'side_eliminated' };
  if (!enemyAlive) return { action: 'request_end', reason: 'side_eliminated' };
  // Rift collapse damage: within the 450-tick window (strictly inside — the
  // window-end tick requests RESOLVING_END instead), every 90 ticks.
  const collapseTick = tick - softLimit;
  if (collapseTick > 0 && collapseTick < COLLAPSE_WINDOW_TICKS && collapseTick % COLLAPSE_DAMAGE_INTERVAL_TICKS === 0) {
    return { action: 'collapse_damage' };
  }
  if (tick >= softLimit + COLLAPSE_WINDOW_TICKS) {
    return { action: 'request_end', reason: 'time_limit' };
  }
  return { action: 'none' };
}

/** §10: collapse is active between the soft limit and the window end. */
export function isCollapseActiveFor(state: { readonly tick: number; readonly timeCollapseSinceTick?: number }): boolean {
  if (state.timeCollapseSinceTick === undefined) return false;
  return state.tick >= state.timeCollapseSinceTick && state.tick < state.timeCollapseSinceTick + COLLAPSE_WINDOW_TICKS;
}

/** §10 collapse tick: 8% max-LP pure damage, integer, non-negative. Uses
 * mulDivRound (round-half-away-from-zero) for consistency with the §8.1
 * integer pipeline — never Math.floor, which would systematically under-apply
 * collapse damage at non-exact divisions. */
export function collapseDamageFor(entity: KernelEntity): number {
  return Math.max(1, mulDivRound(entity.maxLp, COLLAPSE_DAMAGE_BPS, TECHNICAL_RULES.basisPointsScale));
}

/**
 * Stage-L battle-end resolver system. Applies collapse damage, requests the
 * RESOLVING_END window on time limit / endcap, and finalizes the terminal
 * outcome. Emits BattleEnded with the outcome ordinal (0 victory, 1 defeat,
 * 2 draw).
 */
export function createBattleEndResolverSystem(config: BattleEndConfig = {}): KernelSystem {
  const OUTCOME_ORDINAL: Readonly<Record<TerminalOutcome, number>> = Object.freeze({ VICTORY: 0, DEFEAT: 1, DRAW_ABORT: 2 });
  validateBattleEndConfig(config);
  return {
    id: 'phase17.l1.battle_end',
    stage: 'L',
    run(context: TickContext): void {
      // Open the collapse window at the soft limit so healing is halved from
      // the very first collapse tick (stage I reads the field next tick).
      if (context.state.phase.phase === 'ACTIVE') {
        const softLimit = softLimitTicks(config);
        if (context.state.tick >= softLimit && context.state.tick <= softLimit + COLLAPSE_WINDOW_TICKS && context.state.timeCollapseSinceTick === undefined) {
          context.commands.push({ kind: 'set_time_collapse', sinceTick: softLimit });
        }
      }
      const decision = resolveBattleEnd(context.state, config, context.state.phase.resolvingEndTicks);
      if (decision.action === 'collapse_damage') {
        // Apply 8% max-LP pure damage to every combat-capable regular unit.
        for (const entity of context.state.entities) {
          if (!isCombatCapableRegular(entity)) continue;
          const amount = collapseDamageFor(entity);
          const shields = entity.shields ?? Object.freeze([]);
          const shieldTotal = aggregateShields(shields);
          const absorbed = Math.min(amount, shieldTotal);
          const hpDelta = Math.min(amount - absorbed, entity.lp);
          context.commands.push({ kind: 'apply_lp_delta', entityId: entity.id, delta: -hpDelta, sourceId: 'rift_collapse' });
          if (absorbed > 0) {
            context.commands.push({ kind: 'append_event', event: Object.freeze({
              type: 'ShieldAbsorbed', sourceId: 'rift_collapse', targetIds: Object.freeze([entity.id]),
              contentIds: Object.freeze([]), payload: Object.freeze({ amount: absorbed, remaining: shieldTotal - absorbed }),
              logTags: Object.freeze(['sim.phase17']),
            }) });
          }
          context.commands.push({
            kind: 'append_event',
            event: Object.freeze({
              type: 'DamageApplied',
              sourceId: 'rift_collapse',
              targetIds: Object.freeze([entity.id]),
              contentIds: Object.freeze([]),
              payload: Object.freeze({
                rawAmount: amount, damageTypeOrdinal: 2, effectiveDefense: 0, preShieldAmount: amount,
                absorbedShield: absorbed, finalHpDelta: hpDelta, hpBefore: entity.lp,
                hpAfter: Math.max(0, entity.lp - hpDelta), shieldBefore: shieldTotal,
                shieldAfter: shieldTotal - absorbed, attackInstanceId: 0, effectIndex: 0,
              }),
              logTags: Object.freeze(['sim.phase17']),
            }),
          });
        }
        return;
      }
      if (decision.action === 'request_end') {
        context.commands.push({ kind: 'battle_transition', to: 'RESOLVING_END', priority: 120, reason: decision.reason });
        return;
      }
      if (decision.action === 'finalize') {
        context.commands.push({ kind: 'battle_transition', to: decision.outcome, priority: 140, reason: decision.reason });
        context.commands.push({
          kind: 'append_event',
          event: Object.freeze({
            type: 'BattleEnded',
            sourceId: null,
            targetIds: Object.freeze([]),
            contentIds: Object.freeze([]),
            payload: Object.freeze({ outcomeOrdinal: OUTCOME_ORDINAL[decision.outcome] }),
            logTags: Object.freeze(['sim.phase17']),
          }),
        });
      }
    },
  };
}

export function validateBattleEndConfig(config: BattleEndConfig): void {
  if (config.bossIds !== undefined) {
    for (const id of config.bossIds) {
      if (!/^[a-z][a-z0-9_]*$/.test(id)) throw new KernelInvariantError('P14_SNAPSHOT_INVALID', { reason: 'boss-id-invalid', id });
    }
  }
  if (config.bossBattle !== undefined && typeof config.bossBattle !== 'boolean') {
    throw new KernelInvariantError('P14_SNAPSHOT_INVALID', { reason: 'boss-battle-flag' });
  }
}
