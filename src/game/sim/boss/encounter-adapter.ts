import { KernelInvariantError } from '../core/invariant-error.js';
import { numberSecondsToTicks } from '../math/time-and-speed.js';
import type { Objective } from '../objectives/combat-objective.js';
import { createObjectiveCollection } from '../objectives/combat-objective.js';
import type { ModifierDefinition, ModifierHook } from '../world/modifier-system.js';
import { validateModifier } from '../world/modifier-system.js';
import type { Wave } from '../world/reinforcement-system.js';
import { validateWave } from '../world/reinforcement-system.js';
import type { Lane } from '../geometry/x100.js';
import type { BossObjectContent, BossObjectSpec, DamagePolicy } from './boss-object-manager.js';
import { validateBossObjectContent } from './boss-object-manager.js';
import type { PhaseDefinition } from './boss-phase-system.js';
import { bossPhasesFromEncounterContent, type ContentBossPhaseSource } from './boss-phase-content-adapter.js';
/**
 * Phase 21 §6 content adapter (T03). Maps the flattened content entries the
 * schema expresses (content/source/world/encounters.json, validated by
 * EncounterSourceSchema) into sim runtime surfaces (boss objects, objectives,
 * modifiers, waves, boss phases). Pure and total: every field maps 1:1,
 * invalid entries are content errors, and every returned value is frozen.
 */

/** The flattened content shape (mirrors BossObjectSourceSchema). */
export interface ContentBossObjectEntry {
  readonly entityId: string;
  readonly side: 'player' | 'enemy';
  readonly ownerId: string;
  readonly sourceId: string;
  readonly slotId: 'boss_slot_0' | 'boss_slot_1' | 'boss_slot_2' | 'boss_slot_3';
  readonly lane: 'top' | 'middle' | 'bottom';
  readonly x100: number;
  readonly targetable: boolean;
  readonly objectiveLink: string | null;
  readonly damagePolicy: DamagePolicy;
  readonly statusPolicy: 'allow' | 'block';
  readonly cleanupPolicy: 'on_objective' | 'on_battle_end' | 'manual';
  readonly fallback: 'FAIL' | 'DEFER';
  readonly maxLp: number;
  readonly radiusX100: number;
}

/** Maps one content entry to the sim's nested-spec BossObjectContent. */
export function bossObjectFromContent(entry: ContentBossObjectEntry): BossObjectContent {
  const spec: BossObjectSpec = Object.freeze({
    slotId: entry.slotId,
    lane: entry.lane,
    x100: entry.x100,
    targetable: entry.targetable,
    objectiveLink: entry.objectiveLink,
    damagePolicy: entry.damagePolicy,
    statusPolicy: entry.statusPolicy,
    cleanupPolicy: entry.cleanupPolicy,
    fallback: entry.fallback,
  });
  const content: BossObjectContent = Object.freeze({
    entityId: entry.entityId,
    side: entry.side,
    ownerId: entry.ownerId,
    sourceId: entry.sourceId,
    spec,
    maxLp: entry.maxLp,
    radiusX100: entry.radiusX100,
  });
  validateBossObjectContent(content);
  return content;
}

/** Maps the full content list to `Phase21RuntimeConfig.bossObjects`. */
export function bossObjectsFromContent(entries: readonly ContentBossObjectEntry[]): readonly BossObjectContent[] {
  const seen = new Set<string>();
  return Object.freeze(entries.map((entry) => {
    if (seen.has(entry.entityId)) throw new KernelInvariantError('P21_OBJECT_INVALID', { reason: 'duplicate-entry-id', entityId: entry.entityId });
    seen.add(entry.entityId);
    return bossObjectFromContent(entry);
  }));
}

/** Derives the stage-I damage-policy map for `Phase17SystemsConfig`. */
export function bossObjectPoliciesFromContent(entries: readonly ContentBossObjectEntry[]): ReadonlyMap<string, DamagePolicy> {
  return new Map(entries.map((entry) => [entry.entityId, entry.damagePolicy] as const));
}

/** Derives the stage-I status gate (ids whose statusPolicy is `block`). */
export function blockedStatusTargetsFromContent(entries: readonly ContentBossObjectEntry[]): ReadonlySet<string> {
  return new Set(entries.filter((entry) => entry.statusPolicy === 'block').map((entry) => entry.entityId));
}

/** The encounter mission kinds the content schema can express (EncounterSourceSchema.objective). */
export type EncounterObjectiveKind = 'defeat_all' | 'survive' | 'defeat_boss' | 'protect_object' | 'complete_waves' | 'heal_sustain';

/** The encounter content the objective derivation reads (EncounterSourceSchema fields). */
export interface EncounterObjectiveSource {
  readonly encounterId: string;
  readonly objective: EncounterObjectiveKind;
  readonly bossObjects: readonly ContentBossObjectEntry[];
  /** Number of regular enemy slots the encounter places at battle start (`enemySlots.length`). */
  readonly enemySlotCount: number;
  /** §P21-T03: battle entity id of the boss for `defeat_boss` missions (`kill_boss` target). */
  readonly bossUnitId: string | null;
  /** §P21-T03: survival duration in seconds for `survive` missions (`survive_until` required, converted to ticks). */
  readonly survivalDurationSeconds: number | null;
  /** §P21-T03: total HP to heal for `heal_sustain` missions (`heal_sustain` objective required, accumulated HealApplied amounts). */
  readonly healSustainCount: number | null;
  /** §7: content modifier ids (`EncounterSourceSchema.modifierIds`), resolved against the modifier registry. */
  readonly modifierIds: readonly string[];
  /** §8: reinforcement waves and §4 boss phases across the boss's HP. */
  readonly reinforcementWaves: readonly EncounterWaveSource[];
  /** §4: content boss phases (`EncounterSourceSchema.bossPhases`). */
  readonly bossPhases: readonly ContentBossPhaseSource[];
  /** §10: second boss's phases for multi-boss encounters (`bossPhasesSecondary`). */
  readonly bossPhasesSecondary?: readonly ContentBossPhaseSource[];
  /** §P21-T03: second boss's battle entity id (`bossUnitIdSecondary`). */
  readonly bossUnitIdSecondary?: string | null;
}

/** §8: one reinforcement-wave declaration (`EncounterSourceSchema.reinforcementWaves` element). */
export interface EncounterWaveSource {
  readonly atSeconds: number;
  readonly encounterId: string;
}
/** The minimal referenced-encounter shape the wave derivation reads (`enemySlots` composition). */
export interface EncounterSlotProfile {
  readonly enemySlots: readonly { readonly unitId: string; readonly lane: Lane }[];
}

/** The content modifier surface (mirrors ModifierSourceSchema). */
export interface ContentModifierSource {
  readonly id: string;
  readonly previewDisclosureKey: string;
  readonly hooks: readonly ModifierHook[];
  readonly incompatibilityTags: readonly string[];
  readonly params: Readonly<Record<string, number>>;
}

// §7: resolve content modifier ids to validated definitions (preview key derived as `preview_${id}`; unknown ids are content errors).
export function modifiersFromEncounterContent(
  ids: readonly string[],
  registry: ReadonlyMap<string, ContentModifierSource>,
): readonly ModifierDefinition[] {
  return Object.freeze(ids.map((id) => {
    const entry = registry.get(id);
    if (entry === undefined) throw new KernelInvariantError('P21_MODIFIER_INVALID', { reason: 'unknown-modifier-id', modifierId: id });
    const def: ModifierDefinition = Object.freeze({
      id: entry.id,
      previewKey: `preview_${entry.id}`,
      hooks: Object.freeze([...entry.hooks]),
      incompatibilityTags: Object.freeze([...entry.incompatibilityTags]),
      params: Object.freeze({ ...entry.params }),
    });
    validateModifier(def);
    return def;
  }));
}

// §8: derive the sim `Wave`s an encounter's reinforcement declarations mandate (missing/empty referenced encounters are content errors).
export function wavesFromEncounterContent(
  waves: readonly EncounterWaveSource[],
  encounters: ReadonlyMap<string, EncounterSlotProfile>,
  sourceEncounterId: string,
): readonly Wave[] {
  return Object.freeze(waves.map((w, index) => {
    const profile = encounters.get(w.encounterId);
    if (profile === undefined) throw new KernelInvariantError('P21_WAVE_INVALID', { reason: 'unknown-wave-encounter', encounterId: w.encounterId, sourceEncounterId });
    if (profile.enemySlots.length === 0) throw new KernelInvariantError('P21_WAVE_INVALID', { reason: 'empty-wave-encounter', encounterId: w.encounterId });
    // Distinct spawn ids: a defeated base-body lingers (LP 0) — reusing the slot unit id would collide (P14_DUPLICATE_ENTITY).
    const wave: Wave = Object.freeze({
      id: `${sourceEncounterId}_wave_${String(index)}`,
      scheduledTick: numberSecondsToTicks(w.atSeconds).ticks,
      side: 'enemy',
      entityIds: Object.freeze(profile.enemySlots.map((slot, slotIndex) => `${sourceEncounterId}_wave_${String(index)}_${slot.unitId}_${String(slotIndex)}`)),
      spawnProfile: w.encounterId,
      capPolicy: 'BLOCK',
    });
    validateWave(wave);
    return wave;
  }));
}

const EMPTY_OBJECTIVES: readonly Objective[] = Object.freeze([]);

function contentError(reason: string, source: EncounterObjectiveSource): never {
  throw new KernelInvariantError('P21_OBJECTIVE_INVALID', { reason, encounterId: source.encounterId });
}

/**
 * §P21-T03: derives the sim objectives the encounter content mandates, one per
 * mission kind (kill_regulars/survive_until/kill_boss/protect_object per linked
 * object/complete_waves/heal_sustain), all frozen and validated via
 * `createObjectiveCollection`. Inexpressible missions are content errors.
 */
export function objectivesFromEncounterContent(source: EncounterObjectiveSource): readonly Objective[] {
  switch (source.objective) {
    case 'defeat_all': {
      if (source.enemySlotCount < 1) contentError('defeat-all-without-enemy-slots', source);
      return createObjectiveCollection([
        Object.freeze({
          id: `obj_${source.encounterId}_regulars`,
          kind: 'kill_regulars' as const,
          targetId: null,
          required: source.enemySlotCount,
          progress: 0,
          complete: false,
        }),
      ]);
    }
    case 'survive': {
      const s = source.survivalDurationSeconds;
      if (s === null) contentError('survive-without-duration', source);
      if (!Number.isSafeInteger(s) || s <= 0) contentError('survive-duration-invalid', source);
      return createObjectiveCollection([Object.freeze({
        id: `obj_${source.encounterId}_survive`, kind: 'survive_until' as const, targetId: null,
        required: numberSecondsToTicks(s).ticks, progress: 0, complete: false,
      })]);
    }
    case 'defeat_boss': {
      if (source.bossUnitId === null) contentError('defeat-boss-without-boss-unit', source);
      return createObjectiveCollection([
        Object.freeze({
          id: `obj_${source.encounterId}_boss`,
          kind: 'kill_boss' as const,
          targetId: source.bossUnitId,
          required: 1,
          progress: 0,
          complete: false,
        }),
      ]);
    }
    case 'protect_object': {
      const linked = source.bossObjects.filter(
        (entry): entry is ContentBossObjectEntry & { readonly objectiveLink: string } => entry.objectiveLink !== null,
      );
      if (linked.length === 0) contentError('protect-object-without-linked-target', source);
      return createObjectiveCollection(linked.map((entry) =>
        Object.freeze({
          id: entry.objectiveLink,
          kind: 'protect_object' as const,
          targetId: entry.entityId,
          required: 1,
          progress: 0,
          complete: false,
        }),
      ));
    }
    case 'complete_waves': {
      if (source.reinforcementWaves.length === 0) contentError('complete-waves-without-waves', source);
      return createObjectiveCollection([Object.freeze({
        id: `obj_${source.encounterId}_waves`, kind: 'complete_waves' as const, targetId: null,
        required: source.reinforcementWaves.length, progress: 0, complete: false,
      })]);
    }
    case 'heal_sustain': {
      if (source.healSustainCount === null) contentError('heal-sustain-without-count', source);
      return createObjectiveCollection([Object.freeze({
        id: `obj_${source.encounterId}_heal`, kind: 'heal_sustain' as const, targetId: null,
        required: source.healSustainCount, progress: 0, complete: false,
      })]);
    }
    default:
      return EMPTY_OBJECTIVES;
  }
}

/**
 * The complete battle-launch config the content encounter seeds: mission
 * objectives plus every boss-object surface (placement, policies, blocked
 * statuses). A launcher consumes this one call to turn encounter content into
 * the Phase21RuntimeConfig fields.
 */
export interface EncounterLaunchConfig {
  readonly objectives: readonly Objective[];
  readonly bossObjects: readonly BossObjectContent[];
  readonly bossObjectPolicies: ReadonlyMap<string, DamagePolicy>;
  readonly blockedStatusTargets: ReadonlySet<string>;
  readonly modifiers: readonly ModifierDefinition[]; // §7: committed at battle start
  readonly waves: readonly Wave[]; // §8: committed by the stage-K system
  readonly bossPhaseDefinitions: readonly PhaseDefinition[];
}

/** Content registries the launch derivation resolves ids against (pure, no fs). */
export interface EncounterLaunchDeps {
  readonly modifiers: ReadonlyMap<string, ContentModifierSource>;
  readonly encounters: ReadonlyMap<string, EncounterSlotProfile>;
}

/** Assembles the full content→launch config for an encounter (§P21-T03). */
export function buildEncounterLaunchConfig(source: EncounterObjectiveSource, deps: EncounterLaunchDeps): EncounterLaunchConfig {
  return Object.freeze({
    objectives: objectivesFromEncounterContent(source),
    bossObjects: bossObjectsFromContent(source.bossObjects),
    bossObjectPolicies: bossObjectPoliciesFromContent(source.bossObjects),
    blockedStatusTargets: blockedStatusTargetsFromContent(source.bossObjects),
    modifiers: modifiersFromEncounterContent(source.modifierIds, deps.modifiers),
    waves: wavesFromEncounterContent(source.reinforcementWaves, deps.encounters, source.encounterId),
    // §10 multi-boss: primary + secondary phase sets (each validated per boss).
    bossPhaseDefinitions: Object.freeze([
      ...bossPhasesFromEncounterContent(source.bossPhases, source.bossUnitId),
      ...bossPhasesFromEncounterContent(source.bossPhasesSecondary ?? [], source.bossUnitIdSecondary ?? null),
    ]),
  });
}
