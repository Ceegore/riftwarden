import { describe, expect, it } from 'vitest';
import { ANNOUNCE_KINDS, SUPPRESSED_KINDS } from '../../src/game/hud/live-region.js';
import { sortEntities, sortWarnings } from '../../src/game/hud/stable-order.js';
import { fallbackSelection } from '../../src/game/hud/selection.js';
import { remainingSeconds } from '../../src/game/hud/time-format.js';
import { presentedEntity, readJson, warningItem } from './phase26-helpers.js';

const constants = readJson('phase26-constants.json') as {
  allowedSpeedPercent: readonly number[];
  liveAnnouncementKinds: readonly string[];
  sideOrder: readonly string[];
  laneOrder: readonly string[];
  maxDurationDisplayErrorMs: number;
  layouts: readonly string[];
  textScalePercent: readonly number[];
};

const layoutMatrix = readJson('fixtures/layout-visual-matrix.json') as {
  layouts: readonly string[];
  locales: readonly string[];
  textScales: readonly number[];
  profiles: readonly string[];
};

const liveRegionMatrix = readJson('fixtures/live-region-matrix.json') as {
  announce: readonly string[];
  suppress: readonly string[];
};

const semanticOrderGolden = readJson('fixtures/semantic-order-golden.json') as {
  input: readonly { id: string; side: string; lane: string; x: number }[];
  expectedIds: readonly string[];
};

const selectionFallback = readJson('fixtures/selection-fallback-matrix.json') as {
  cases: readonly { ordered: readonly string[]; selected: string; removed: string; expected: string | null }[];
};

const warningBoundaries = readJson('fixtures/warning-timeline-boundaries.json') as {
  tickRate: number;
  cases: readonly { current: number; due: number; expectedSeconds: number }[];
};

const speedPauseMatrix = readJson('fixtures/speed-pause-matrix.json') as {
  cases: readonly { speed: number; pauseAtTick: number; expected: string }[];
};

describe('P26 pinned constants (phase26-constants.json)', () => {
  it('pins the closed speed set at exactly 50/100/200/300 percent', () => {
    expect(constants.allowedSpeedPercent).toEqual([50, 100, 200, 300]);
  });

  it('pins the four live-announcement kinds', () => {
    expect(constants.liveAnnouncementKinds).toEqual(['BATTLE_PHASE', 'PLAYER_UNIT_LOST', 'CRITICAL_BOSS_WARNING', 'BATTLE_ENDED']);
    expect(ANNOUNCE_KINDS).toEqual(constants.liveAnnouncementKinds);
  });

  it('pins side and lane canonical order', () => {
    expect(constants.sideOrder).toEqual(['PLAYER', 'ENEMY']);
    expect(constants.laneOrder).toEqual(['TOP', 'MIDDLE', 'BOTTOM']);
  });

  it('pins the display-duration error bound and layout/text-scale domains', () => {
    expect(constants.maxDurationDisplayErrorMs).toBe(100);
    expect(constants.layouts).toEqual(['COMPACT', 'STANDARD', 'TABLET_LARGE', 'PORTRAIT_NARROW']);
    expect(constants.textScalePercent).toEqual([100, 150, 200]);
  });
});

describe('P26 layout visual matrix (layout-visual-matrix.json)', () => {
  it('pins the layout/locale/text-scale/profile matrix', () => {
    expect(layoutMatrix.layouts).toEqual(constants.layouts);
    expect(layoutMatrix.locales).toEqual(['de', 'en', 'pseudo']);
    expect(layoutMatrix.textScales).toEqual([100, 150, 200]);
    expect(layoutMatrix.profiles).toEqual(['NORMAL', 'LOW', 'REDUCED_MOTION', 'COLOR_PROFILE_A', 'COLOR_PROFILE_B']);
  });
});

describe('P26 live region matrix (live-region-matrix.json)', () => {
  it('announces exactly the four pinned kinds', () => {
    expect(liveRegionMatrix.announce).toEqual(ANNOUNCE_KINDS);
    expect(liveRegionMatrix.suppress).toEqual(SUPPRESSED_KINDS);
    expect(liveRegionMatrix.announce).not.toEqual(liveRegionMatrix.suppress);
  });
});

describe('P26 semantic order golden (semantic-order-golden.json)', () => {
  it('sorts the pinned golden input to the pinned expected order', () => {
    const entities = semanticOrderGolden.input.map((item) =>
      presentedEntity(item.id, { side: item.side as 'PLAYER' | 'ENEMY', lane: item.lane as 'TOP' | 'MIDDLE' | 'BOTTOM', x: item.x }),
    );
    expect(sortEntities(entities).map((entity) => entity.id)).toEqual(semanticOrderGolden.expectedIds);
  });

  it('keeps the golden stable under permutation of the input order', () => {
    const entities = semanticOrderGolden.input.map((item) =>
      presentedEntity(item.id, { side: item.side as 'PLAYER' | 'ENEMY', lane: item.lane as 'TOP' | 'MIDDLE' | 'BOTTOM', x: item.x }),
    );
    const reversed = [...entities].reverse();
    expect(sortEntities(reversed).map((entity) => entity.id)).toEqual(semanticOrderGolden.expectedIds);
  });
});

describe('P26 selection fallback matrix (selection-fallback-matrix.json)', () => {
  it('honours every pinned fallback case', () => {
    for (const c of selectionFallback.cases) {
      expect(fallbackSelection(c.ordered, c.selected, c.removed)).toBe(c.expected ?? undefined);
    }
  });
});

describe('P26 warning timeline boundaries (warning-timeline-boundaries.json)', () => {
  it('derives seconds exclusively from ticks and the pinned tick rate', () => {
    expect(warningBoundaries.tickRate).toBe(30);
    for (const c of warningBoundaries.cases) {
      expect(remainingSeconds(c.current, c.due, warningBoundaries.tickRate)).toBeCloseTo(c.expectedSeconds, 12);
    }
  });

  it('sorts warnings by due tick then descending severity', () => {
    const warnings = [
      warningItem('b', { dueTick: 10, severity: 1, lane: 'BOTTOM', x: 9 }),
      warningItem('a', { dueTick: 10, severity: 2, lane: 'TOP', x: 2 }),
    ];
    expect(sortWarnings(warnings).map((w) => w.id)).toEqual(['a', 'b']);
  });
});

describe('P26 speed/pause matrix (speed-pause-matrix.json)', () => {
  it('pins all 16 cases to identical checkpoint and end hashes', () => {
    expect(speedPauseMatrix.cases).toHaveLength(16);
    for (const c of speedPauseMatrix.cases) {
      expect(constants.allowedSpeedPercent).toContain(c.speed);
      expect([0, 1, 17, 300]).toContain(c.pauseAtTick);
      expect(c.expected).toBe('SAME_CHECKPOINT_AND_END_HASH');
    }
  });
});
