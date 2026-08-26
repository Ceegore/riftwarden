import { KernelInvariantError } from '../core/invariant-error.js';
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
