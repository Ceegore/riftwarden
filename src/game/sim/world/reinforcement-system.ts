import { KernelInvariantError } from '../core/invariant-error.js';
import { asciiCompare, type Tick } from '../core/primitives.js';
import type { KernelEntity } from '../core/entity.js';
import type { Lane } from '../geometry/x100.js';

/**
 * Phase 21 §8 reinforcement waves (T05). Each wave has a stable wave id, a
 * scheduled tick, a fixed spawn order, a side, a spawn profile and a
 * cap/failure policy. Invalid waves are content errors that block content —
 * the runtime never improvises a replacement wave (§8).
 */

export const WAVE_CAP_POLICIES = ['BLOCK', 'FAIL'] as const;
export type WaveCapPolicy = (typeof WAVE_CAP_POLICIES)[number];

export interface Wave {
  readonly id: string;
  readonly scheduledTick: number;
  readonly side: 'player' | 'enemy';
  /** Fixed spawn order: entity ids are committed in this exact order (§8). */
  readonly entityIds: readonly string[];
  /** Content spawn-profile id (stats/placement are a content port, not invented here). */
  readonly spawnProfile: string;
  /** BLOCK = skip/spill the overflow deterministically; FAIL = content error. */
  readonly capPolicy: WaveCapPolicy;
}

const ID = /^[a-z][a-z0-9_]*$/;

function assertId(value: string, field: string): void {
  if (!ID.test(value)) throw new KernelInvariantError('P21_WAVE_INVALID', { field, value });
}

function assertInt(value: number, field: string): void {
  if (!Number.isSafeInteger(value) || value < 0 || Object.is(value, -0)) {
    throw new KernelInvariantError('P21_WAVE_INVALID', { field, value });
  }
}

/** Validates a reinforcement wave (§8). Invalid waves block content. */
export function validateWave(wave: Wave): void {
  assertId(wave.id, 'id');
  assertInt(wave.scheduledTick, 'scheduledTick');
  if (!(['player', 'enemy'] as readonly string[]).includes(wave.side)) throw new KernelInvariantError('P21_WAVE_INVALID', { field: 'side', value: wave.side });
  if (wave.entityIds.length === 0) throw new KernelInvariantError('P21_WAVE_INVALID', { reason: 'empty-spawn-order', id: wave.id });
  for (const entityId of wave.entityIds) assertId(entityId, 'entityIds');
  if (new Set(wave.entityIds).size !== wave.entityIds.length) throw new KernelInvariantError('P21_WAVE_INVALID', { reason: 'duplicate-spawn-order', id: wave.id });
  assertId(wave.spawnProfile, 'spawnProfile');
  if (!(WAVE_CAP_POLICIES as readonly string[]).includes(wave.capPolicy)) throw new KernelInvariantError('P21_WAVE_INVALID', { field: 'capPolicy', value: wave.capPolicy });
}

/**
 * §8 due waves: scheduled, not yet spawned, ordered by (scheduledTick, id).
 * `spawned` holds the set of wave ids already committed this battle.
 */
export function dueWaves(waves: readonly Wave[], tick: number, spawned: ReadonlySet<string>): readonly Wave[] {
  return Object.freeze(
    waves
      .filter((w) => w.scheduledTick <= tick && !spawned.has(w.id))
      .sort((a, b) => a.scheduledTick - b.scheduledTick || asciiCompare(a.id, b.id)),
  );
}

/** Canonical wave ordering helper (scheduledTick, id), exported for reuse. */
export function compareWaves(a: Wave, b: Wave): number {
  return a.scheduledTick - b.scheduledTick || asciiCompare(a.id, b.id);
}

/**
 * Content-owned stats + placement for one reinforcement entity. The kernel
 * validates the body (id, lane, field bounds, stats) but never invents stats:
 * invalid bodies are content errors that block the wave (§8).
 */
export interface ReinforcementBody {
  readonly entityId: string;
  readonly lane: Lane;
  readonly x100: number;
  readonly radiusX100: number;
  readonly maxLp: number;
}

const LANES: readonly Lane[] = ['top', 'middle', 'bottom'] as const;
const BODY_ID = /^[a-z][a-z0-9_]*$/;

function assertBodyInt(value: number, field: string, waveId: string): void {
  if (!Number.isSafeInteger(value) || value < 0 || Object.is(value, -0)) {
    throw new KernelInvariantError('P21_WAVE_INVALID', { waveId, field, value: String(value) });
  }
}

/** Validates a content-supplied reinforcement body (§8). Invalid bodies block content. */
export function validateReinforcementBody(body: ReinforcementBody, waveId: string): void {
  if (!BODY_ID.test(body.entityId)) throw new KernelInvariantError('P21_WAVE_INVALID', { waveId, field: 'entityId', value: body.entityId });
  if (!(LANES as readonly string[]).includes(body.lane)) throw new KernelInvariantError('P21_WAVE_INVALID', { waveId, field: 'lane', value: body.lane });
  assertBodyInt(body.x100, 'x100', waveId);
  if (body.x100 > 10000) throw new KernelInvariantError('P21_WAVE_INVALID', { waveId, field: 'x100', value: body.x100 });
  assertBodyInt(body.radiusX100, 'radiusX100', waveId);
  assertBodyInt(body.maxLp, 'maxLp', waveId);
  if (body.maxLp === 0) throw new KernelInvariantError('P21_WAVE_INVALID', { waveId, field: 'maxLp', value: 0 });
}

/** Builds the combat body for a reinforcement entity (full Phase-15 surface). */
export function buildReinforcementEntity(body: ReinforcementBody, side: 'player' | 'enemy', tick: Tick): KernelEntity {
  return Object.freeze({
    id: body.entityId,
    side,
    phase: Object.freeze({ phase: 'ACTIVE', enteredTick: tick, controlledReturn: null }),
    maxLp: body.maxLp,
    lp: body.maxLp,
    shield: 0,
    lane: body.lane,
    x100: body.x100,
    targetId: null,
    timers: Object.freeze({}),
    radiusX100: body.radiusX100,
    movementRemainder: 0,
    laneChange: null,
    normalLaneChangeCooldownUntilTick: 0,
    noProgressTicks: 0,
    repathTicks: Object.freeze([]),
    laneFallbackUsed: false,
    stuckStopGapBonusUntilTick: 0,
    frontDeadlockBlockedTicks: 0,
    deadlockBuffConsumed: false,
    deadlockBuffedEntityId: null,
    origin: 'regular',
    inRangeSinceTick: null,
  });
}

/** §8 canonical spawned-wave cursor: validates ids, rejects duplicates and sorts. */
export function createSpawnedWaveCursor(ids: readonly string[]): readonly string[] {
  const seen = new Set<string>();
  return Object.freeze([...ids].sort(asciiCompare).map((id) => {
    if (!ID.test(id)) throw new KernelInvariantError('P21_WAVE_INVALID', { field: 'id', value: id });
    if (seen.has(id)) throw new KernelInvariantError('P21_WAVE_INVALID', { reason: 'duplicate-id', id });
    seen.add(id);
    return id;
  }));
}
