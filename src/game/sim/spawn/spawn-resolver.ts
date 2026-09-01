import { asFieldX100, asX100, type X100 } from '../geometry/x100.js';

export interface SpawnCandidateInput {
  readonly reservedId: string;
  readonly baseX100: X100;
  readonly backwardDirection: 1 | -1;
  readonly valid: (x: X100) => boolean;
}

export interface SpawnResult {
  readonly reservedId: string;
  readonly positionX100: X100 | null;
  readonly rejected: boolean;
}

/**
 * Deterministic candidate list: the base position, then offsets 50..400 X100
 * backwards in `stepX100` increments. Candidates outside the field are dropped.
 * No random side, no insertion-order dependency.
 */
export function spawnCandidates(baseX100: X100, backwardDirection: 1 | -1, stepX100: X100 = asX100(50), maxOffsetX100: X100 = asX100(400)): readonly X100[] {
  const out: X100[] = [baseX100];
  for (let offset = stepX100; offset <= maxOffsetX100; offset = asX100(offset + stepX100)) {
    const candidate = baseX100 + backwardDirection * offset;
    if (candidate >= 0 && candidate <= 10000) out.push(asFieldX100(candidate));
  }
  return out;
}

/** Selects the first valid candidate; rejects atomically when none is valid (§7.1). */
export function resolveSpawn(input: SpawnCandidateInput): SpawnResult {
  for (const x of spawnCandidates(input.baseX100, input.backwardDirection)) {
    if (input.valid(x)) return { reservedId: input.reservedId, positionX100: x, rejected: false };
  }
  return { reservedId: input.reservedId, positionX100: null, rejected: true };
}

/** Base position: 100 X100 behind the foremost regular ally on the lane. */
export function baseBehindFront(frontX100: X100, teamForward: 1 | -1): X100 {
  return asX100(frontX100 - teamForward * 100);
}
