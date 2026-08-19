import { KernelInvariantError } from '../core/invariant-error.js';
import { asciiCompare } from '../core/primitives.js';
import { isSynergyId, type SynergyId, type SynergyTier } from './synergy-counter.js';

/**
 * Phase 20 §3.2 synergy runtime. Each of the eight synergies is modelled as a
 * content composition of the existing Phase-19 triggers, predicates, target
 * queries and effect commands. The runtime only derives canonical activation
 * records from a resolved tier map: every activation carries
 * `sourceKind=synergy`, `sourceId=<synergyId>`, the tier, the owner side and a
 * stable command id. Caps and once-rules remain content data (§3.2) — they are
 * not hidden stat sources here.
 */

export interface SynergyActivation {
  readonly synergyId: SynergyId;
  readonly tier: SynergyTier;
  readonly side: 'player' | 'enemy';
  readonly sourceKind: 'synergy';
  readonly sourceId: SynergyId;
  /** Stable content command id, unique per (synergy, side). */
  readonly commandId: string;
}

/** §3.2 stable command id: `synergy_<synergyId>_<side>`. */
export function synergyCommandId(synergyId: SynergyId, side: 'player' | 'enemy'): string {
  return `synergy_${synergyId}_${side}`;
}

/**
 * Derives the active (tier > 0) synergies for one owner side, canonically
 * ordered by synergy id (§3.2). Tier-0 synergies produce no activation.
 */
export function buildSynergyActivations(
  tiers: Readonly<Record<string, SynergyTier>>,
  side: 'player' | 'enemy',
): readonly SynergyActivation[] {
  const activations: SynergyActivation[] = [];
  for (const [id, tier] of Object.entries(tiers).sort(([a], [b]) => asciiCompare(a, b))) {
    if (tier === 0) continue;
    if (!isSynergyId(id)) throw new KernelInvariantError('UnknownSynergyId', { synergyId: id });
    activations.push(
      Object.freeze({
        synergyId: id,
        tier,
        side,
        sourceKind: 'synergy',
        sourceId: id,
        commandId: synergyCommandId(id, side),
      }),
    );
  }
  return Object.freeze(activations);
}

export function validateSynergyActivation(activation: SynergyActivation): void {
  if (!isSynergyId(activation.synergyId)) throw new KernelInvariantError('UnknownSynergyId', { synergyId: activation.synergyId });
  if (activation.sourceId !== activation.synergyId) {
    throw new KernelInvariantError('P20_SYNERGY_INVALID', { reason: 'attribution-invalid', activation });
  }
  if (activation.commandId !== synergyCommandId(activation.synergyId, activation.side)) {
    throw new KernelInvariantError('P20_SYNERGY_INVALID', { reason: 'command-id-invalid', commandId: activation.commandId });
  }
}
