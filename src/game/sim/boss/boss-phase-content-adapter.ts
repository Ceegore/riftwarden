import { KernelInvariantError } from "../core/invariant-error.js";
import type { PhaseDefinition } from "./boss-phase-system.js";
import {
  validateBossPhases,
  validatePhaseDefinition,
} from "./boss-phase-system.js";

/**
 * Phase 21 §4 content adapter (T03 boss phases). Maps the flattened boss-phase
 * entries the encounter schema expresses (EncounterSourceSchema.bossPhases) into
 * the sim's PhaseDefinition surface. The encounter's boss battle unit id doubles
 * as the phase `bossId` (matching for transition detection), and each phase's
 * `previewKey` derives as `preview_${id}` in the §4 id-form preview convention
 * (mirrors modifiers). The mapping is pure and total: non-empty phases are
 * coverage-validated so a boss always descends phases across its HP, and a
 * boss-phase declaration without a `bossUnitId` is a content error.
 */

/** The flattened content boss-phase shape (mirrors BossPhaseSourceSchema). */
export interface ContentBossPhaseSource {
  readonly id: string;
  readonly priority: number;
  /** Inclusive lower HP bound in permille (0..1000). */
  readonly minHpPermille: number;
  /** Exclusive upper HP bound in permille (1..1001). */
  readonly maxHpPermille: number;
  readonly transitionTicks?: number;
  readonly invulnerableTicks?: number;
  readonly transitionLocked?: boolean;
}

/** Maps one content boss-phase entry to a validated sim PhaseDefinition. */
export function bossPhasesFromEncounterContent(
  phases: readonly ContentBossPhaseSource[],
  bossId: string | null,
): readonly PhaseDefinition[] {
  if (phases.length === 0) return Object.freeze([]);
  if (bossId === null)
    throw new KernelInvariantError("P21_PHASE_INVALID", {
      reason: "boss-phases-without-boss-unit",
    });
  const defs = Object.freeze(
    phases.map((p) => {
      const def: PhaseDefinition = Object.freeze({
        id: p.id,
        bossId,
        priority: p.priority,
        minHpPermille: p.minHpPermille,
        maxHpPermille: p.maxHpPermille,
        previewKey: `preview_${p.id}`,
        ...(p.transitionTicks !== undefined
          ? { transitionTicks: p.transitionTicks }
          : {}),
        ...(p.invulnerableTicks !== undefined
          ? { invulnerableTicks: p.invulnerableTicks }
          : {}),
        ...(p.transitionLocked !== undefined
          ? { transitionLocked: p.transitionLocked }
          : {}),
      });
      validatePhaseDefinition(def);
      return def;
    }),
  );
  const issues = validateBossPhases(defs);
  if (issues.length > 0)
    throw new KernelInvariantError("P21_PHASE_GAP", {
      detail: issues[0]?.detail,
    });
  return defs;
}
