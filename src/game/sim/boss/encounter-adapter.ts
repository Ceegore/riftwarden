import { KernelInvariantError } from '../core/invariant-error.js';
import { numberSecondsToTicks } from '../math/time-and-speed.js';
import type { Objective } from '../objectives/combat-objective.js';
import { createObjectiveCollection } from '../objectives/combat-objective.js';
import type { BossObjectContent, BossObjectSpec, DamagePolicy } from './boss-object-manager.js';
import { validateBossObjectContent } from './boss-object-manager.js';

/**
 * Phase 21 §6 content adapter (T03). Maps the flattened boss-object entries the
 * content schema expresses (content/source/world/encounters.json, validated by
 * BossObjectSourceSchema) into the sim's runtime config surfaces:
 * - `Phase21RuntimeConfig.bossObjects` (placement + cleanup);
 * - `Phase17SystemsConfig.bossObjectPolicies` (stage-I damage gate);
 * - `StatusSystemConfig.blockedStatusTargets` (stage-I status gate).
 * The mapping is pure and total: every field maps 1:1, invalid entries are
 * content errors (never silently dropped), and every returned value is frozen
 * so the configs remain immutable.
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
    if (seen.has(entry.entityId)) {
      throw new KernelInvariantError('P21_OBJECT_INVALID', { reason: 'duplicate-entry-id', entityId: entry.entityId });
    }
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
export type EncounterObjectiveKind = 'defeat_all' | 'survive' | 'defeat_boss' | 'protect_object';

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
}

const EMPTY_OBJECTIVES: readonly Objective[] = Object.freeze([]);

function contentError(reason: string, source: EncounterObjectiveSource): never {
  throw new KernelInvariantError('P21_OBJECTIVE_INVALID', { reason, encounterId: source.encounterId });
}

/**
 * §P21-T03: derives the sim objectives the encounter content itself mandates,
 * one per mission kind, all frozen and validated via `createObjectiveCollection`:
 * - `defeat_all` → `kill_regulars` with required = enemy slot count (the regular
 *   units placed at battle start; boss/object defeats never count toward it);
 * - `survive` → `survive_until` with required = seconds converted to ticks at
 *   the kernel tick rate;
 * - `defeat_boss` → `kill_boss` targeting the declared `bossUnitId` battle entity;
 * - `protect_object` → one protect objective per boss object whose
 *   `objectiveLink` names it (a shared link is a duplicate-id content error).
 * Missions that are not expressible in the encounter's fields are content
 * errors — never silently dropped.
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
      if (source.survivalDurationSeconds === null) contentError('survive-without-duration', source);
      return createObjectiveCollection([
        Object.freeze({
          id: `obj_${source.encounterId}_survive`,
          kind: 'survive_until' as const,
          targetId: null,
          required: secondsToTicks(source.survivalDurationSeconds),
          progress: 0,
          complete: false,
        }),
      ]);
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
}

/** Assembles the full content→launch config for an encounter (§P21-T03). */
export function buildEncounterLaunchConfig(source: EncounterObjectiveSource): EncounterLaunchConfig {
  return Object.freeze({
    objectives: objectivesFromEncounterContent(source),
    bossObjects: bossObjectsFromContent(source.bossObjects),
    bossObjectPolicies: bossObjectPoliciesFromContent(source.bossObjects),
    blockedStatusTargets: blockedStatusTargetsFromContent(source.bossObjects),
  });
}

/** Duration to kernel ticks via the canonical seconds→ticks conversion. */
function secondsToTicks(seconds: number): number {
  if (!Number.isSafeInteger(seconds) || seconds <= 0) {
    throw new KernelInvariantError('P21_OBJECTIVE_INVALID', { reason: 'survive-duration-invalid', survivalDurationSeconds: seconds });
  }
  return numberSecondsToTicks(seconds).ticks;
}
