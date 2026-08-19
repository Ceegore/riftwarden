import { KernelInvariantError } from '../core/invariant-error.js';
import { asciiCompare } from '../core/primitives.js';

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
