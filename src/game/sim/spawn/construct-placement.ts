import { KernelInvariantError } from '../core/invariant-error.js';
import { asX100, type X100 } from '../geometry/x100.js';

export interface ConstructSlot {
  readonly slotId: string;
  readonly x100: X100;
  readonly occupiedBy: string | null;
}

export type ReplacementPolicy = 'replace' | 'reject';

export interface ConstructPlacementResult {
  readonly placed: boolean;
  readonly slotId: string | null;
  readonly x100: X100 | null;
  readonly reasonCode: 'P15_CONSTRUCT_SLOT_OCCUPIED' | null;
}

/**
 * Places a stationary construct on its defined slot. When the slot is occupied,
 * only the content `replacementPolicy` may resolve it; without a policy the
 * request is blocked. No automatic stacking, sidestep or next-free-slot search.
 */
export function placeConstruct(
  slot: ConstructSlot,
  replacementPolicy: ReplacementPolicy | null,
): ConstructPlacementResult {
  if (slot.occupiedBy === null) {
    return { placed: true, slotId: slot.slotId, x100: asX100(slot.x100), reasonCode: null };
  }
  if (replacementPolicy === 'replace') {
    return { placed: true, slotId: slot.slotId, x100: asX100(slot.x100), reasonCode: null };
  }
  return { placed: false, slotId: null, x100: null, reasonCode: 'P15_CONSTRUCT_SLOT_OCCUPIED' };
}

/** Ensures the replacement policy value is one of the published set. */
export function assertReplacementPolicy(policy: unknown): asserts policy is ReplacementPolicy {
  if (policy !== 'replace' && policy !== 'reject') {
    throw new KernelInvariantError('P15_SPAWN_POLICY_MISSING', { policy });
  }
}
