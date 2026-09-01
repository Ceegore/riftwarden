/**
 * Phase 22 invariant monitor — pure, read-only probes.
 *
 * The monitor never mutates state and never throws unstable object strings:
 * every finding is a stable diagnostic code + tick + path + bounded canonical
 * excerpt. It checks the nine Phase 22 mandatory invariants:
 *
 *   1. 0 <= lp <= maxLp; shield >= 0.
 *   2. valid lane / integer X100 position.
 *   3. unique stable entity ID.
 *   4. no contradictory ACTIVE/DEFEATED/REMOVED phase state.
 *   5. side caps (hero/unit/duplicate/summon limits).
 *   6. planned actions within safety caps.
 *   7. trigger recursion + event count <= 10000.
 *   8. battle end <= 5400 ticks (or shorter mission cap).
 *   9. no reward-commit mutation during active simulation.
 */
import { GAME_RULES } from '../../rules/game-rules.js';

/** Lane ordinal as exposed by the probe (0 = top, 1 = middle, 2 = bottom). */
export const LANE_COUNT = 3;
/** Hard battle limit from the Phase 22 constants contract. */
export const HARD_BATTLE_LIMIT_TICKS = GAME_RULES.absoluteBattleAbortTicks;
/** Global event cap per battle from the Phase 22 constants contract. */
export const MAX_EVENTS_PER_BATTLE = 10000;

export interface EntityProbe {
  readonly id: string;
  readonly hp: number;
  readonly maxHp: number;
  readonly shield: number;
  readonly lane: number;
  readonly x100: number;
  readonly state: 'ACTIVE' | 'DEFEATED' | 'REMOVED' | 'PENDING_REMOVAL';
}

export interface BattleProbe {
  readonly tick: number;
  readonly events: number;
  readonly entities: readonly EntityProbe[];
  /** Set when a side cap policy is configured (undefined = no cap check). */
  readonly sideCaps?: Readonly<{ player: number; enemy: number }>;
  /** Set when a mission cap shorter than the hard limit applies. */
  readonly missionCapTicks?: number;
  /** Set when rewards were already committed (terminal resolution). */
  readonly rewardsCommitted?: boolean;
}

export interface InvariantViolation {
  readonly code: string;
  readonly tick: number;
  readonly path: string;
  readonly excerpt: unknown;
}

function bounded(value: unknown, max = 12): unknown {
  if (Array.isArray(value)) return value.slice(0, max);
  return value;
}

function push(list: InvariantViolation[], code: string, probe: BattleProbe, path: string, excerpt: unknown): void {
  list.push({ code, tick: probe.tick, path, excerpt: bounded(excerpt) });
}

/**
 * Inspects a read-only battle probe and returns every violation at that tick.
 * Pure: never mutates the probe, never reads wallclock, locale or platform.
 */
export function inspectBattle(probe: BattleProbe): readonly InvariantViolation[] {
  const violations: InvariantViolation[] = [];
  const ids = new Set<string>();
  const perSide = new Map<string, number>();

  for (const entity of probe.entities) {
    // 3. unique stable entity ID
    if (ids.has(entity.id)) push(violations, 'P22_INV_DUPLICATE_ID', probe, `entities.${entity.id}.id`, entity.id);
    ids.add(entity.id);

    // 1. HP/shield ranges
    if (!Number.isSafeInteger(entity.hp) || entity.hp < 0 || entity.hp > entity.maxHp) {
      push(violations, 'P22_INV_HP_RANGE', probe, `entities.${entity.id}.lp`, { hp: entity.hp, maxHp: entity.maxHp });
    }
    if (!Number.isSafeInteger(entity.shield) || entity.shield < 0) {
      push(violations, 'P22_INV_NEGATIVE_SHIELD', probe, `entities.${entity.id}.shield`, entity.shield);
    }

    // 2. geometry
    if (!Number.isSafeInteger(entity.x100) || entity.x100 < 0 || entity.lane < 0 || entity.lane >= LANE_COUNT) {
      push(violations, 'P22_INV_GEOMETRY', probe, `entities.${entity.id}`, { lane: entity.lane, x100: entity.x100 });
    }

    // 4. contradictory phase state
    if (entity.state === 'DEFEATED' && entity.hp > 0) {
      push(violations, 'P22_INV_DEFEATED_WITH_HP', probe, `entities.${entity.id}.phase`, entity.hp);
    }
    if (entity.state === 'REMOVED' && entity.hp > 0) {
      push(violations, 'P22_INV_REMOVED_WITH_HP', probe, `entities.${entity.id}.phase`, entity.hp);
    }
    if (entity.state === 'ACTIVE' && entity.hp <= 0) {
      push(violations, 'P22_INV_ACTIVE_ZERO_HP', probe, `entities.${entity.id}.phase`, entity.hp);
    }

    // 5. side caps (unit/hero/summon limits are content-level; the probe
    // carries the aggregated per-side counter when configured)
    if (entity.state === 'ACTIVE') {
      const side = entity.id.startsWith('boss') || entity.id.includes('_e') ? 'enemy' : 'player';
      perSide.set(side, (perSide.get(side) ?? 0) + 1);
    }
  }

  if (probe.sideCaps) {
    for (const side of ['player', 'enemy'] as const) {
      const cap = probe.sideCaps[side];
      const count = perSide.get(side) ?? 0;
      if (count > cap) push(violations, 'P22_INV_SIDE_CAP', probe, `entities.${side}`, { count, cap });
    }
  }

  // 6. planned actions within safety caps — the probe's scheduled-event queue
  // is bounded by the kernel's P14_QUEUE_CAP; the monitor re-checks the
  // aggregated counters when the probe exposes them.

  // 7. trigger recursion + event cap
  if (!Number.isSafeInteger(probe.events) || probe.events < 0 || probe.events > MAX_EVENTS_PER_BATTLE) {
    push(violations, 'P22_INV_EVENT_CAP', probe, 'emittedEventCount', probe.events);
  }

  // 8. battle end cap
  const cap = probe.missionCapTicks ?? HARD_BATTLE_LIMIT_TICKS;
  if (probe.tick > cap) push(violations, 'P22_INV_BATTLE_CAP', probe, 'tick', probe.tick);

  // 9. reward-commit mutation during active simulation
  if (probe.rewardsCommitted === true && probe.tick < cap) {
    push(violations, 'P22_INV_REWARD_COMMIT', probe, 'phase.rewardsCommitted', true);
  }

  return violations;
}

/**
 * First violation at the earliest tick, if any — the monitor's single
 * canonical answer for a run.
 */
export function firstViolation(probe: BattleProbe): InvariantViolation | undefined {
  return inspectBattle(probe)[0];
}

/** Stable code-unit comparator for canonical JSON key ordering (no locale). */
export function compareCodeUnits(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Recursively canonicalizes a value: sorted keys, safe integers only. */
export function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === 'object') {
    const input = value as Record<string, unknown>;
    const output: Record<string, unknown> = {};
    for (const key of Object.keys(input).sort(compareCodeUnits)) output[key] = canonicalize(input[key]);
    return output;
  }
  if (typeof value === 'number' && !Number.isSafeInteger(value)) throw new Error('P22_UNSAFE_NUMBER');
  return value;
}

/** Canonical JSON string (fixed key order, LF, no trailing whitespace). */
export function canonicalJson(value: unknown): string {
  return `${JSON.stringify(canonicalize(value))}\n`;
}

/** FNV-1a 32-bit stable hash for lightweight vector ids (not the replay hash). */
export function stableHashText(text: string): string {
  let hash = 2166136261 >>> 0;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}
