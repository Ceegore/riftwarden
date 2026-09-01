import { describe, expect, it } from 'vitest';
import { formatTenths, remainingSeconds } from '../../src/game/hud/time-format.js';
import { fallbackSelection } from '../../src/game/hud/selection.js';
import { catchHudCode, readJson } from './phase26-helpers.js';

const warningBoundaries = readJson('fixtures/warning-timeline-boundaries.json') as {
  tickRate: number;
  cases: readonly { current: number; due: number; expectedSeconds: number }[];
};

const selectionFallback = readJson('fixtures/selection-fallback-matrix.json') as {
  cases: readonly { ordered: readonly string[]; selected: string; removed: string; expected: string | null }[];
};

describe('remainingSeconds (warning-timeline-boundaries.json)', () => {
  it('derives seconds from ticks and the authoritative tick rate', () => {
    for (const c of warningBoundaries.cases) {
      expect(remainingSeconds(c.current, c.due, warningBoundaries.tickRate)).toBeCloseTo(c.expectedSeconds, 12);
    }
  });

  it('clamps past-due warnings to "now" (zero)', () => {
    expect(remainingSeconds(200, 100, 30)).toBe(0);
    expect(remainingSeconds(100, 99, 30)).toBe(0);
  });

  it('rejects invalid tick inputs with a closed code', () => {
    expect(catchHudCode(() => remainingSeconds(1.5, 10, 30))).toBe('INVALID_TICK_INPUT');
    expect(catchHudCode(() => remainingSeconds(1, 10.5, 30))).toBe('INVALID_TICK_INPUT');
    expect(catchHudCode(() => remainingSeconds(1, 10, 0))).toBe('INVALID_TICK_INPUT');
    expect(catchHudCode(() => remainingSeconds(1, 10, -30))).toBe('INVALID_TICK_INPUT');
    expect(catchHudCode(() => remainingSeconds(1, 10, 1.5))).toBe('INVALID_TICK_INPUT');
  });

  it('keeps the displayed duration within the 0.1s contract bound', () => {
    for (const tickRate of [15, 30, 60]) {
      for (let current = 0; current < 3000; current += 1) {
        const due = current + ((current * 37) % 900);
        const exact = remainingSeconds(current, due, tickRate);
        const displayed = formatTenths(exact);
        expect(Math.abs(displayed - exact)).toBeLessThanOrEqual(0.1);
      }
    }
  });

  it('formats tenths deterministically', () => {
    expect(formatTenths(0)).toBe(0);
    expect(formatTenths(0.03333333333333333)).toBe(0);
    expect(formatTenths(0.5)).toBe(0.5);
    expect(formatTenths(1)).toBe(1);
    expect(formatTenths(1.24)).toBe(1.2);
    expect(formatTenths(1.26)).toBe(1.3);
  });
});

describe('fallbackSelection (selection-fallback-matrix.json)', () => {
  it('honours every pinned fallback case', () => {
    for (const c of selectionFallback.cases) {
      expect(fallbackSelection(c.ordered, c.selected, c.removed)).toBe(c.expected ?? undefined);
    }
  });

  it('keeps the selection when the selected entity was not removed', () => {
    expect(fallbackSelection(['a', 'b', 'c'], 'b', 'a')).toBe('b');
    expect(fallbackSelection(['a', 'b', 'c'], undefined, 'a')).toBeUndefined();
  });

  it('falls back to the first entity when the removed one was last', () => {
    expect(fallbackSelection(['a', 'b', 'c'], 'c', 'c')).toBe('a');
  });

  it('falls back to the first entity when the removed id is unknown', () => {
    expect(fallbackSelection(['a', 'b'], 'x', 'x')).toBe('a');
  });

  it('returns an id from the list or undefined on every vector', () => {
    const ordered = ['a', 'b', 'c', 'd'];
    for (let selected = -1; selected < ordered.length; selected += 1) {
      for (const removed of ordered) {
        const selectedId = selected < 0 ? undefined : ordered[selected];
        const result = fallbackSelection(ordered, selectedId, removed);
        if (result !== undefined) expect(ordered).toContain(result);
      }
    }
  });

  it('is deterministic across identical inputs', () => {
    for (let i = 0; i < 100; i += 1) {
      expect(fallbackSelection(['a', 'b', 'c', 'd'], 'b', 'b')).toBe('c');
    }
  });
});
