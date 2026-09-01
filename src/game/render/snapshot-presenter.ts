import type { BattlePresentationFrame, EntityFrame, Lane, LayerId, StableId, VisualState } from './types.js';
import { RenderError } from './render-error.js';
import { deepFreeze } from './mutation-guard.js';
import { clampAlpha1000, interpolateInt } from './interpolation.js';
import { entityLayerId } from './layer-graph.js';
import { sortedEntityFrames } from './stable-sort.js';
import { VISUAL_STATES } from './event-mapping.js';

export interface InterpolatedEntityView {
  readonly id: StableId;
  readonly lane: Lane;
  readonly layerId: LayerId;
  readonly logicalX100: number;
  readonly visualState: VisualState;
  readonly clipProgress1000: number;
}

export interface InterpolatedFrameView {
  readonly tick: number;
  readonly gameplayHash: string;
  readonly entities: readonly InterpolatedEntityView[];
}

/**
 * Validates a confirmed presentation frame before acceptance. Entities must
 * have unique stable ids; gameplay values (lane, state, existence) must be in
 * their closed domains; the gameplay hash must be a 64-hex string.
 */
export function validatePresentationFrame(frame: BattlePresentationFrame): void {
  if (!Number.isSafeInteger(frame.tick) || frame.tick < 0) throw new RenderError('PRESENTER_INVALID_FRAME', { field: 'tick' });
  if (typeof frame.gameplayHash !== 'string' || !/^[0-9a-f]{64}$/.test(frame.gameplayHash)) {
    throw new RenderError('PRESENTER_INVALID_FRAME', { field: 'gameplayHash' });
  }
  // Runtime narrowing on untrusted data (repo decoder pattern): never trust
  // the nominal type when validating values that cross module boundaries.
  const rawEntities: unknown = frame.entities;
  if (!Array.isArray(rawEntities)) throw new RenderError('PRESENTER_INVALID_FRAME', { field: 'entities' });
  const seen = new Set<string>();
  for (const raw of rawEntities) {
    if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) throw new RenderError('PRESENTER_INVALID_FRAME', { field: 'entity' });
    const entity = raw as Record<string, unknown>;
    const id = entity['id'];
    if (typeof id !== 'string' || id.length === 0) throw new RenderError('PRESENTER_INVALID_FRAME', { field: 'id' });
    if (seen.has(id)) throw new RenderError('PRESENTER_INVALID_FRAME', { field: 'id', reason: 'duplicate' });
    seen.add(id);
    const lane = entity['lane'];
    if (lane !== 0 && lane !== 1 && lane !== 2) throw new RenderError('PRESENTER_INVALID_FRAME', { field: 'lane' });
    const logicalX100 = entity['logicalX100'];
    if (typeof logicalX100 !== 'number' || !Number.isSafeInteger(logicalX100)) {
      throw new RenderError('PRESENTER_INVALID_FRAME', { field: 'logicalX100' });
    }
    const visualState = entity['visualState'];
    if (typeof visualState !== 'string' || !VISUAL_STATES.includes(visualState as VisualState)) {
      throw new RenderError('PRESENTER_INVALID_FRAME', { field: 'visualState' });
    }
    const clip = entity['clipProgress1000'];
    if (typeof clip !== 'number' || !Number.isSafeInteger(clip) || clip < 0 || clip > 1000) {
      throw new RenderError('PRESENTER_INVALID_FRAME', { field: 'clipProgress1000' });
    }
  }
}

/**
 * Snapshot presenter: holds at most the previous and next CONFIRMED snapshot
 * and produces integer-interpolated visual views. Only visual values (X,
 * clip progress) interpolate; existence, lane, HP, defeat and all gameplay
 * decisions always come from the newest confirmed snapshot — never
 * extrapolated. Pause freezes the presentation.
 */
export interface SnapshotPresenter {
  readonly previous: BattlePresentationFrame | null;
  readonly next: BattlePresentationFrame | null;
  readonly paused: boolean;
  readonly latestGameplayHash: string | null;
  submitConfirmed(frame: BattlePresentationFrame): void;
  present(alpha1000: number): InterpolatedFrameView;
  pause(): void;
  resume(): void;
}

export function createSnapshotPresenter(initial?: BattlePresentationFrame): SnapshotPresenter {
  let previous: BattlePresentationFrame | null = null;
  let next: BattlePresentationFrame | null = null;
  let paused = false;
  let lastView: InterpolatedFrameView | null = null;

  if (initial !== undefined) {
    validatePresentationFrame(initial);
    next = deepFreeze(initial);
  }

  function computeView(alpha: number): InterpolatedFrameView {
    if (next === null) throw new RenderError('PRESENTER_INVALID_FRAME', { reason: 'no-confirmed-frame' });
    const base = next;
    const byId = new Map<string, EntityFrame>();
    if (previous !== null) {
      for (const entity of previous.entities) byId.set(entity.id, entity);
    }
    const views: InterpolatedEntityView[] = [];
    for (const entity of base.entities) {
      const prior = byId.get(entity.id);
      const logicalX100 = prior === undefined ? entity.logicalX100 : interpolateInt(prior.logicalX100, entity.logicalX100, alpha);
      const clipProgress1000 =
        prior === undefined ? entity.clipProgress1000 : interpolateInt(prior.clipProgress1000, entity.clipProgress1000, alpha);
      views.push({
        id: entity.id,
        lane: entity.lane,
        layerId: entityLayerId(entity.lane),
        logicalX100,
        visualState: entity.visualState,
        clipProgress1000,
      });
    }
    return { tick: base.tick, gameplayHash: base.gameplayHash, entities: sortedEntityFrames(views) };
  }

  return {
    get previous() {
      return previous;
    },
    get next() {
      return next;
    },
    get paused() {
      return paused;
    },
    get latestGameplayHash() {
      return next === null ? null : next.gameplayHash;
    },
    submitConfirmed(frame) {
      validatePresentationFrame(frame);
      if (next === null) {
        next = deepFreeze(frame);
        return;
      }
      if (frame.tick < next.tick) throw new RenderError('PRESENTER_STALE_FRAME', { tick: frame.tick, nextTick: next.tick });
      if (frame.tick > next.tick) previous = next;
      next = deepFreeze(frame);
    },
    present(alpha1000) {
      const alpha = clampAlpha1000(alpha1000);
      if (paused) {
        lastView ??= computeView(alpha);
        return lastView;
      }
      const view = computeView(alpha);
      lastView = view;
      return view;
    },
    pause() {
      paused = true;
    },
    resume() {
      paused = false;
    },
  };
}
