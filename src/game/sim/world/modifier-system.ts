import { KernelInvariantError } from '../core/invariant-error.js';
import { asciiCompare } from '../core/primitives.js';
import { mulDivRound } from '../math/fixed-math.js';

/**
 * Phase 21 §7 modifier authority (T04). All 18 release modifiers are visible
 * before battle start. Each carries a stable id, preview key, hooks,
 * incompatibility tags and deterministic parameters. The encounter validator
 * rejects combinations that would neutralize a boss core mechanic or make the
 * announced counter strategy impossible — no hidden rolls, no surprise rules.
 */

export const EXPECTED_MODIFIER_COUNT = 18;

export const MODIFIER_HOOKS = [
  'on_phase_entry',
  'on_phase_exit',
  'on_damage_applied',
  'on_spawn',
  'on_battle_start',
  'on_entity_defeated',
] as const;
export type ModifierHook = (typeof MODIFIER_HOOKS)[number];

export interface ModifierDefinition {
  readonly id: string;
  readonly previewKey: string;
  readonly hooks: readonly ModifierHook[];
  /** Tags that conflict with other modifiers or with boss core mechanics (§7). */
  readonly incompatibilityTags: readonly string[];
  /** Deterministic integer parameters consumed by content hooks. */
  readonly params: Readonly<Record<string, number>>;
}

export interface EncounterMechanicSpec {
  /** Boss core-mechanic tags that must never be neutralized (§7). */
  readonly coreMechanicTags: readonly string[];
  /** Tags of the announced counter strategy that must stay possible (§7). */
  readonly announcedCounterTags: readonly string[];
}

export interface ValidationIssue {
  readonly code: string;
  readonly detail: string;
}

const ID = /^[a-z][a-z0-9_]*$/;
const TAG = /^[a-z][a-z0-9_]*(?:[._][a-z0-9_]+)*$/;

function assertId(value: string, field: string): void {
  if (!ID.test(value)) throw new KernelInvariantError('P21_MODIFIER_INVALID', { field, value });
}

function assertTick(value: number, field: string): void {
  if (!Number.isSafeInteger(value) || value < 0 || Object.is(value, -0)) {
    throw new KernelInvariantError('P21_MODIFIER_INVALID', { field, value });
  }
}

/** Validates one modifier definition (§7). */
export function validateModifier(def: ModifierDefinition): void {
  assertId(def.id, 'id');
  assertId(def.previewKey, 'previewKey');
  for (const hook of def.hooks) {
    if (!(MODIFIER_HOOKS as readonly string[]).includes(hook)) throw new KernelInvariantError('P21_MODIFIER_INVALID', { field: 'hooks', hook });
  }
  for (const tag of def.incompatibilityTags) {
    if (!TAG.test(tag)) throw new KernelInvariantError('P21_MODIFIER_INVALID', { field: 'incompatibilityTags', tag });
  }
  for (const [key, value] of Object.entries(def.params)) {
    if (!TAG.test(key) || !Number.isSafeInteger(value) || Object.is(value, -0)) {
      throw new KernelInvariantError('P21_MODIFIER_INVALID', { field: 'params', key, value });
    }
  }
}

/** §7: every release modifier must be visible before battle start. */
export function allModifiersPreviewed(defs: readonly ModifierDefinition[]): boolean {
  return defs.length === EXPECTED_MODIFIER_COUNT && defs.every((d) => d.previewKey.length > 0);
}

function issue(code: string, detail: string): ValidationIssue {
  return Object.freeze({ code, detail });
}

/**
 * Canonical modifier collection (§7 snapshot projection): validates every
 * modifier, rejects duplicate ids and returns a deep-frozen, id-sorted set.
 */
export function createModifierCollection(defs: readonly ModifierDefinition[]): readonly ModifierDefinition[] {
  const ids = new Set<string>();
  const sorted = [...defs].sort((a, b) => asciiCompare(a.id, b.id));
  return Object.freeze(sorted.map((d) => {
    validateModifier(d);
    if (ids.has(d.id)) throw new KernelInvariantError('P21_MODIFIER_INVALID', { reason: 'duplicate-id', id: d.id });
    ids.add(d.id);
    return Object.freeze({ ...d, hooks: Object.freeze([...d.hooks]), incompatibilityTags: Object.freeze([...d.incompatibilityTags]), params: Object.freeze({ ...d.params }) });
  }));
}

/**
 * §7 one recorded hook firing (canonical, deterministic). `params` are the
 * §7-announced parameters of the committed definition — the hook's observable
 * effect surface — copied frozen at firing time.
 */
export interface ModifierHookFiring {
  readonly modifierId: string;
  readonly hook: ModifierHook;
  readonly atTick: number;
  readonly params: Readonly<Record<string, number>>;
}

/**
 * Canonical modifier-hook log (§7 snapshot projection): validates every
 * firing, rejects duplicate (modifierId, hook, atTick) keys and returns a
 * deep-frozen set ordered by (atTick, modifierId, hook).
 */
export function createModifierHookCollection(firings: readonly ModifierHookFiring[]): readonly ModifierHookFiring[] {
  const keys = new Set<string>();
  return Object.freeze([...firings]
    .sort((a, b) => a.atTick - b.atTick || asciiCompare(a.modifierId, b.modifierId) || asciiCompare(a.hook, b.hook))
    .map((f) => {
      assertId(f.modifierId, 'modifierId');
      if (!(MODIFIER_HOOKS as readonly string[]).includes(f.hook)) throw new KernelInvariantError('P21_MODIFIER_INVALID', { field: 'hook', hook: f.hook });
      assertTick(f.atTick, 'atTick');
      for (const [key, value] of Object.entries(f.params)) {
        if (!TAG.test(key) || !Number.isSafeInteger(value) || Object.is(value, -0)) {
          throw new KernelInvariantError('P21_MODIFIER_INVALID', { field: 'params', key, value });
        }
      }
      const key = `${f.modifierId}:${f.hook}:${String(f.atTick)}`;
      if (keys.has(key)) throw new KernelInvariantError('P21_MODIFIER_INVALID', { reason: 'duplicate-firing', key });
      keys.add(key);
      return Object.freeze({ ...f, params: Object.freeze({ ...f.params }) });
    }));
}

/** §7 canonical event types that drive the response hooks. */
const HOOK_EVENT_TYPES: Readonly<Record<string, ModifierHook>> = Object.freeze({
  Defeated: 'on_entity_defeated',
  DamageApplied: 'on_damage_applied',
  ReinforcementSpawned: 'on_spawn',
  BossPhaseStarted: 'on_phase_entry',
  BossPhaseCompleted: 'on_phase_exit',
});

/** §7 battle-start hooks: every committed modifier declaring `on_battle_start` fires once at battle start. */
export function battleStartHooks(defs: readonly ModifierDefinition[], atTick: number): readonly ModifierHookFiring[] {
  return Object.freeze(defs
    .filter((d) => d.hooks.includes('on_battle_start'))
    .map((d) => Object.freeze({ modifierId: d.id, hook: 'on_battle_start' as const, atTick, params: Object.freeze({ ...d.params }) })));
}

/**
 * §7 event-driven hooks: responds to the canonical previous-tick event records
 * (the same records the objective resolver folds) — one firing per
 * (modifier, hook) per tick, mirroring how the objective system derives
 * progress. The firing carries the committed definition's params so the launch
 * report can prove which §7-announced effect each hook applied.
 */
export function evaluateModifierHooks(
  defs: readonly ModifierDefinition[],
  records: readonly { readonly type: string }[],
  atTick: number,
): readonly ModifierHookFiring[] {
  const seen = new Set<string>();
  const out: ModifierHookFiring[] = [];
  for (const record of records) {
    const hook = HOOK_EVENT_TYPES[record.type];
    if (hook === undefined) continue;
    for (const def of defs) {
      if (!def.hooks.includes(hook)) continue;
      const key = `${def.id}:${hook}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(Object.freeze({ modifierId: def.id, hook, atTick, params: Object.freeze({ ...def.params }) }));
    }
  }
  return Object.freeze(out.sort((a, b) => asciiCompare(a.modifierId, b.modifierId) || asciiCompare(a.hook, b.hook)));
}

/**
 * §7 canonical hook effect: the composite basis-point scale a modifier set
 * applies for one hook parameter (10000 = no effect; multiple modifiers
 * compose multiplicatively, round-half-away-from-zero at every step).
 */
export function hookBpsScale(defs: readonly ModifierDefinition[], hook: ModifierHook, paramKey: string): number {
  let scale = 10000;
  for (const def of defs) {
    if (!def.hooks.includes(hook)) continue;
    const value = def.params[paramKey];
    if (value === undefined) continue;
    scale = mulDivRound(scale, value, 10000);
  }
  return scale;
}

/** §7 applies a basis-point scale to a deterministic integer (identity when unscaled). */
export function applyHookBps(value: number, scaleBps: number): number {
  return scaleBps === 10000 ? value : mulDivRound(value, scaleBps, 10000);
}

/**
 * §7 encounter validator. Rejects modifiers whose incompatibility tags overlap
 * the boss core mechanics (neutralization) or the announced counter strategy
 * (impossible counter), and any pair of modifiers that share an
 * incompatibility tag.
 */
export function validateEncounter(
  modifiers: readonly ModifierDefinition[],
  mechanics: EncounterMechanicSpec,
): readonly ValidationIssue[] {
  const out: ValidationIssue[] = [];
  for (const modifier of modifiers) validateModifier(modifier);
  for (const modifier of modifiers) {
    for (const tag of modifier.incompatibilityTags) {
      if (mechanics.coreMechanicTags.includes(tag)) out.push(issue('P21_MODIFIER_INCOMPATIBLE', `${modifier.id}:neutralizes:${tag}`));
      if (mechanics.announcedCounterTags.includes(tag)) out.push(issue('P21_MODIFIER_INCOMPATIBLE', `${modifier.id}:blocks-counter:${tag}`));
    }
  }
  const sorted = [...modifiers].sort((a, b) => asciiCompare(a.id, b.id));
  for (let i = 0; i < sorted.length; i++) {
    const a = sorted[i];
    if (a === undefined) continue;
    for (let j = i + 1; j < sorted.length; j++) {
      const b = sorted[j];
      if (b === undefined) continue;
      const clash = a.incompatibilityTags.find((tag) => b.incompatibilityTags.includes(tag));
      if (clash !== undefined) out.push(issue('P21_MODIFIER_INCOMPATIBLE', `${a.id}/${b.id}:${clash}`));
    }
  }
  return Object.freeze(out);
}

/**
 * §8.3 sustain POLICY validator — the heal-stream audit matrix mirrored into a
 * build-time contract check for `heal_sustain` encounters. Structural checks
 * only (no sim run): the requirement must be positive, a `heal_bps` source
 * must exist and fold to a positive composite scale, and the §6 target set
 * must contain at least one DAMAGEABLE enemy body (a regular enemy slot, or a
 * non-`immune` targetable boss object) — otherwise the lifesteal loop can
 * never fire and the mission is unwinnable. The §10 window halves the heal
 * factor but never changes these structural facts; bankability (requirement vs
 * the pre-window grind) is proven empirically by the launcher teeth.
 */
/**
 * §8.3 bankability ceiling: the sustain counter is capped at `required` — the
 * runtime fold (`applyProgress`) clamps progress, so no encounter can bank
 * MORE than the mission needs. The policy pins the ceiling on the other side
 * too: a requirement above this guardrail demands more banked HP than the
 * sustain pipeline can plausibly produce inside a battle window and is a
 * content error (regression guard against unwinnable numbers).
 */
export const SUSTAIN_BANKABILITY_CEILING = 200_000;

export function validateSustainPolicy(source: {
  readonly healSustainCount: number | null;
  readonly modifiers: readonly ModifierDefinition[];
  readonly enemySlots: readonly unknown[];
  readonly bossObjects: readonly {
    readonly entityId: string;
    readonly spec: { readonly damagePolicy: string; readonly targetable: boolean };
  }[];
}): readonly ValidationIssue[] {
  const out: ValidationIssue[] = [];
  if (source.healSustainCount === null) return Object.freeze(out);
  if (source.healSustainCount <= 0) out.push(issue('P21_SUSTAIN_REQUIREMENT_EMPTY', `healSustainCount ${String(source.healSustainCount)}`));
  if (source.healSustainCount > SUSTAIN_BANKABILITY_CEILING) {
    out.push(issue('P21_SUSTAIN_REQUIREMENT_OVER_CEILING', `healSustainCount ${String(source.healSustainCount)} > ceiling ${String(SUSTAIN_BANKABILITY_CEILING)}`));
  }
  const scale = hookBpsScale(source.modifiers, 'on_damage_applied', 'heal_bps');
  const hasHealSource = source.modifiers.some((m) => m.hooks.includes('on_damage_applied') && m.params['heal_bps'] !== undefined);
  if (!hasHealSource) out.push(issue('P21_SUSTAIN_NO_HEAL_SOURCE', 'no on_damage_applied heal_bps modifier'));
  if (hasHealSource && scale <= 0) out.push(issue('P21_SUSTAIN_ZERO_HEAL_SCALE', `composite heal_bps folds to ${String(scale)}`));
  const damageableBodies = source.enemySlots.length
    + source.bossObjects.filter((b) => b.spec.targetable && b.spec.damagePolicy !== 'immune').length;
  if (damageableBodies === 0) out.push(issue('P21_SUSTAIN_NO_DAMAGE_SOURCE', 'every enemy body is immune or absent'));
  return Object.freeze(out);
}
