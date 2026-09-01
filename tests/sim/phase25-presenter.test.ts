import { describe, expect, it } from 'vitest';
import { createSnapshotPresenter } from '../../src/game/render/snapshot-presenter.js';
import { deepFreeze } from '../../src/game/render/mutation-guard.js';
import { catchRenderCode, entity, frame, hexHash, rawFrame } from './phase25-helpers.js';

describe('Snapshot presenter', () => {
  it('holds a single confirmed frame until a second one arrives', () => {
    const presenter = createSnapshotPresenter(frame(0, [entity('a', { logicalX100: 100 })], hexHash(0)));
    expect(presenter.next?.tick).toBe(0);
    expect(presenter.previous).toBeNull();
    const view = presenter.present(1000);
    expect(view.tick).toBe(0);
    expect(view.entities).toHaveLength(1);
    expect(view.entities[0]?.logicalX100).toBe(100);
  });

  it('interpolates only visual values between confirmed snapshots', () => {
    const presenter = createSnapshotPresenter();
    presenter.submitConfirmed(frame(0, [entity('a', { lane: 0, logicalX100: 100, visualState: 'idle', clipProgress1000: 0 })], hexHash(0)));
    presenter.submitConfirmed(frame(1, [entity('a', { lane: 0, logicalX100: 200, visualState: 'move', clipProgress1000: 500 })], hexHash(1)));
    const mid = presenter.present(500);
    expect(mid.entities[0]?.logicalX100).toBe(150);
    expect(mid.entities[0]?.clipProgress1000).toBe(250);
    // Gameplay values are never interpolated: lane and visual state come from
    // the newest confirmed snapshot.
    expect(mid.entities[0]?.lane).toBe(0);
    expect(mid.entities[0]?.visualState).toBe('move');
    const start = presenter.present(0);
    expect(start.entities[0]?.logicalX100).toBe(100);
    const end = presenter.present(1000);
    expect(end.entities[0]?.logicalX100).toBe(200);
  });

  it('never extrapolates: out-of-range alpha clamps to the confirmed buffers', () => {
    const presenter = createSnapshotPresenter();
    presenter.submitConfirmed(frame(0, [entity('a', { logicalX100: 100 })], hexHash(0)));
    presenter.submitConfirmed(frame(1, [entity('a', { logicalX100: 200 })], hexHash(1)));
    expect(presenter.present(-5).entities[0]?.logicalX100).toBe(100);
    expect(presenter.present(1500).entities[0]?.logicalX100).toBe(200);
  });

  it('takes existence from the newest confirmed snapshot only', () => {
    const presenter = createSnapshotPresenter();
    presenter.submitConfirmed(frame(0, [entity('a'), entity('b')], hexHash(0)));
    presenter.submitConfirmed(frame(1, [entity('b', { logicalX100: 300 }), entity('c', { lane: 2, logicalX100: 400 })], hexHash(1)));
    const view = presenter.present(1000);
    const ids = view.entities.map((v) => v.id);
    // 'a' vanished (defeated) and is not held over; 'c' appears immediately.
    expect(ids).toEqual(['b', 'c']);
    expect(view.entities[0]?.logicalX100).toBe(300);
    expect(view.entities[1]?.logicalX100).toBe(400);
  });

  it('accepts a same-tick re-confirmation without moving the previous buffer', () => {
    const presenter = createSnapshotPresenter();
    presenter.submitConfirmed(frame(0, [entity('a')], hexHash(0)));
    presenter.submitConfirmed(frame(1, [entity('a', { logicalX100: 150 })], hexHash(1)));
    presenter.submitConfirmed(frame(1, [entity('a', { logicalX100: 160 })], hexHash(1)));
    expect(presenter.previous?.tick).toBe(0);
    expect(presenter.next?.tick).toBe(1);
    expect(presenter.next?.entities[0]?.logicalX100).toBe(160);
  });

  it('rejects stale frames older than the newest confirmation', () => {
    const presenter = createSnapshotPresenter();
    presenter.submitConfirmed(frame(0, [entity('a')], hexHash(0)));
    presenter.submitConfirmed(frame(1, [entity('a')], hexHash(1)));
    expect(catchRenderCode(() => {
      presenter.submitConfirmed(frame(0, [entity('a')], hexHash(0)));
    })).toBe('PRESENTER_STALE_FRAME');
  });

  it('freezes the presentation while paused and resumes on demand', () => {
    const presenter = createSnapshotPresenter();
    presenter.submitConfirmed(frame(0, [entity('a', { logicalX100: 100 })], hexHash(0)));
    presenter.submitConfirmed(frame(1, [entity('a', { logicalX100: 200 })], hexHash(1)));
    const frozen = presenter.present(500);
    presenter.pause();
    presenter.submitConfirmed(frame(2, [entity('a', { logicalX100: 999 })], hexHash(2)));
    expect(presenter.present(1000)).toEqual(frozen);
    presenter.resume();
    expect(presenter.present(1000).entities[0]?.logicalX100).toBe(999);
  });

  it('deep-freezes accepted frames (mutation guard)', () => {
    const presenter = createSnapshotPresenter();
    const input = frame(0, [entity('a', { logicalX100: 100 })], hexHash(0));
    presenter.submitConfirmed(input);
    expect(Object.isFrozen(input)).toBe(true);
    expect(Object.isFrozen(input.entities)).toBe(true);
    expect(() => {
      'use strict';
      (input.entities[0] as { logicalX100: number }).logicalX100 = 999;
    }).toThrow();
  });

  it('validates malformed frames with closed error codes', () => {
    const presenter = createSnapshotPresenter();
    expect(catchRenderCode(() => {
      presenter.submitConfirmed(rawFrame({ tick: 0, entities: [], gameplayHash: 'zz' }));
    })).toBe('PRESENTER_INVALID_FRAME');
    expect(
      catchRenderCode(() => {
        presenter.submitConfirmed(rawFrame({ tick: 0, entities: [{ id: 'a', lane: 9, logicalX100: 1, visualState: 'idle', clipProgress1000: 0 }], gameplayHash: hexHash(0) }));
      }),
    ).toBe('PRESENTER_INVALID_FRAME');
    expect(
      catchRenderCode(() => {
        presenter.submitConfirmed(rawFrame({ tick: 0, entities: [{ id: 'a', lane: 0, logicalX100: 1, visualState: 'explode', clipProgress1000: 0 }], gameplayHash: hexHash(0) }));
      }),
    ).toBe('PRESENTER_INVALID_FRAME');
    expect(catchRenderCode(() => {
      presenter.submitConfirmed(frame(0, [entity('a'), entity('a')]));
    })).toBe('PRESENTER_INVALID_FRAME');
    expect(
      catchRenderCode(() => {
        presenter.submitConfirmed(rawFrame({ tick: 0, entities: [{ id: 'a', lane: 0, logicalX100: 1, visualState: 'idle', clipProgress1000: 2000 }], gameplayHash: hexHash(0) }));
      }),
    ).toBe('PRESENTER_INVALID_FRAME');
    expect(catchRenderCode(() => {
      presenter.submitConfirmed(frame(-1, [entity('a')]));
    })).toBe('PRESENTER_INVALID_FRAME');
    expect(catchRenderCode(() => {
      presenter.submitConfirmed(rawFrame({ tick: 0, entities: null, gameplayHash: hexHash(0) }));
    })).toBe('PRESENTER_INVALID_FRAME');
  });

  it('presents nothing without any confirmed frame', () => {
    const presenter = createSnapshotPresenter();
    expect(catchRenderCode(() => presenter.present(1000))).toBe('PRESENTER_INVALID_FRAME');
  });

  it('sorts views canonically and assigns presentation layers', () => {
    const presenter = createSnapshotPresenter();
    const shuffled = [
      entity('c', { lane: 2, logicalX100: 50 }),
      entity('b', { lane: 1, logicalX100: 50 }),
      entity('a', { lane: 0, logicalX100: 50 }),
      entity('a2', { lane: 0, logicalX100: 30 }),
    ];
    presenter.submitConfirmed(frame(0, shuffled, hexHash(0)));
    const view = presenter.present(1000);
    const ids = view.entities.map((v) => v.id);
    expect(ids).toEqual(['a2', 'a', 'b', 'c']);
    expect(view.entities.map((v) => v.layerId)).toEqual([2, 2, 3, 3]);
  });

  it('produces identical views for permuted input order (stable sort)', () => {
    const a = entity('a', { lane: 1, logicalX100: 100 });
    const b = entity('b', { lane: 0, logicalX100: 100 });
    const c = entity('c', { lane: 1, logicalX100: 50 });
    const p1 = createSnapshotPresenter(frame(0, [a, b, c], hexHash(0)));
    const p2 = createSnapshotPresenter(frame(0, [c, a, b], hexHash(0)));
    expect(p1.present(1000)).toEqual(p2.present(1000));
  });

  it('exposes the latest confirmed gameplay hash unchanged', () => {
    const presenter = createSnapshotPresenter();
    expect(presenter.latestGameplayHash).toBeNull();
    presenter.submitConfirmed(frame(3, [entity('a')], hexHash(42)));
    expect(presenter.latestGameplayHash).toBe(hexHash(42));
  });

  it('keeps deepFreeze idempotent and cycle-safe', () => {
    const value = deepFreeze({ nested: { list: [1, 2] } });
    expect(() => deepFreeze(value)).not.toThrow();
    const cyclic: Record<string, unknown> = { name: 'x' };
    cyclic['self'] = cyclic;
    expect(() => deepFreeze(cyclic)).not.toThrow();
  });
});
