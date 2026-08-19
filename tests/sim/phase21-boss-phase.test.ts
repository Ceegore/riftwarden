import { describe, expect, it } from 'vitest';
import {
  commitTransition,
  detectTransition,
  phaseInvulnerableTicks,
  validateBossPhases,
  validatePhaseDefinition,
  MAX_INVULNERABLE_TICKS,
  type BossPhaseState,
  type PhaseDefinition,
} from '../../src/game/sim/boss/boss-phase-system.js';

function phase(id: string, min: number, max: number, priority: number, extra: Partial<PhaseDefinition> = {}): PhaseDefinition {
  return Object.freeze({ id, bossId: 'boss_ash', priority, minHpPermille: min, maxHpPermille: max, previewKey: `preview_${id}`, ...extra });
}

// Authoritative gapless, non-overlapping 0..1001 coverage (top phase covers full HP).
const defs = Object.freeze([
  phase('p1', 501, 1001, 1),
  phase('p2', 251, 501, 2),
  phase('p3', 0, 251, 3),
]);

const state = (overrides: Partial<BossPhaseState> = {}): BossPhaseState => Object.freeze({
  entityId: 'boss_ash_unit',
  bossId: 'boss_ash',
  hpPermille: 400,
  phaseId: 'p1',
  transition: null,
  visited: Object.freeze(['p1']),
  ...overrides,
});

function required<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) throw new Error('expected value');
  return value;
}

describe('Phase 21 T01: coverage validator', () => {
  it('accepts full gapless non-overlapping coverage', () => {
    expect(validateBossPhases(defs)).toEqual([]);
  });

  it('blocks an empty definition set', () => {
    const issues = validateBossPhases([]);
    expect(issues.some((i) => i.code === 'P21_PHASE_GAP')).toBe(true);
  });

  it('blocks a lower gap', () => {
    // Remove p3 (0..251): leaves a gap from 0..251.
    const issues = validateBossPhases(defs.slice(0, 2));
    expect(issues.some((i) => i.code === 'P21_PHASE_GAP')).toBe(true);
  });

  it('blocks an upper gap (no entry phase at full HP)', () => {
    const broken = Object.freeze([
      phase('p1', 501, 900, 1),
      phase('p2', 251, 501, 2),
      phase('p3', 0, 251, 3),
    ]);
    const issues = validateBossPhases(broken);
    expect(issues.some((i) => i.code === 'P21_PHASE_GAP' && i.detail === 'upper range')).toBe(true);
    expect(issues.some((i) => i.code === 'P21_PHASE_GAP' && i.detail === 'no entry phase at full HP')).toBe(true);
  });

  it('blocks overlap', () => {
    const broken = Object.freeze([
      phase('p1', 501, 1001, 1),
      phase('p2', 300, 600, 2),
      phase('p3', 0, 251, 3),
    ]);
    expect(validateBossPhases(broken).some((i) => i.code === 'P21_PHASE_OVERLAP')).toBe(true);
  });

  it('blocks missing preview', () => {
    const broken = Object.freeze([
      phase('p1', 501, 1001, 1, { previewKey: '' }),
      phase('p2', 251, 501, 2),
      phase('p3', 0, 251, 3),
    ]);
    expect(validateBossPhases(broken).some((i) => i.code === 'P21_PREVIEW_MISSING')).toBe(true);
  });

  it('blocks invulnerability over 45 ticks', () => {
    const broken = Object.freeze([
      phase('p1', 501, 1001, 1, { invulnerableTicks: MAX_INVULNERABLE_TICKS + 1 }),
      phase('p2', 251, 501, 2),
      phase('p3', 0, 251, 3),
    ]);
    expect(validateBossPhases(broken).some((i) => i.code === 'P21_INVULNERABLE_TOO_LONG')).toBe(true);
  });

  it('blocks unreachable phase (no entry phase at full HP)', () => {
    // All phases below full HP: the top phase is unreachable as an entry.
    const broken = Object.freeze([
      phase('p1', 501, 900, 1),
      phase('p2', 251, 501, 2),
      phase('p3', 0, 251, 3),
    ]);
    expect(validateBossPhases(broken).some((i) => i.code === 'P21_PHASE_GAP' && i.detail.startsWith('unreachable'))).toBe(true);
  });

  it('blocks ambiguous same-priority overlapping candidates', () => {
    const broken = Object.freeze([
      phase('p1', 501, 1001, 1),
      phase('p2', 300, 600, 1), // same priority as p1 and overlapping
      phase('p3', 0, 251, 3),
    ]);
    expect(validateBossPhases(broken).some((i) => i.code === 'P21_TRANSITION_AMBIGUOUS')).toBe(true);
  });

  it('rejects a degenerate empty-range definition', () => {
    expect(() => { validatePhaseDefinition(phase('bad', 500, 500, 1)); }).toThrow(/P21_PHASE_INVALID/);
  });

  it('rejects a definition with an unknown cancel category', () => {
    expect(() => { validatePhaseDefinition(phase('bad', 0, 100, 1, { cancelCategories: Object.freeze(['teleport' as never]) })); }).toThrow(/P21_PHASE_INVALID/);
  });
});

describe('Phase 21 T02: transition runtime', () => {
  it('detects the highest-priority eligible phase and plans a 45-tick default', () => {
    const s = state({ hpPermille: 400 });
    const tr = required(detectTransition(s, defs, 10));
    expect(tr.to).toBe('p2');
    expect(tr.commitTick).toBe(10 + 45);
  });

  it('breaks priority ties by phase id code-unit order', () => {
    const tied = Object.freeze([
      phase('p_z', 251, 501, 2),
      phase('p_a', 251, 501, 2), // overlap, but detect uses hp range only
      phase('p1', 501, 1001, 1),
    ]);
    const s = state({ hpPermille: 300 });
    const tr = required(detectTransition(s, tied, 0));
    expect(tr.to).toBe('p_a');
  });

  it('respects a custom transition duration', () => {
    const custom = Object.freeze([
      phase('p2', 251, 501, 2, { transitionTicks: 10 }),
      phase('p1', 501, 1001, 1),
    ]);
    const tr = required(detectTransition(state({ hpPermille: 300 }), custom, 5));
    expect(tr.commitTick).toBe(15);
  });

  it('is idempotent: a planned transition is not re-detected', () => {
    const s = state({ hpPermille: 400 });
    const first = required(detectTransition(s, defs, 10));
    const second = detectTransition({ ...s, transition: first }, defs, 10);
    expect(second).toBe(first);
  });

  it('commits atomically at the inclusive commit tick, exactly once', () => {
    const s = state({ hpPermille: 400 });
    const tr = required(detectTransition(s, defs, 10));
    expect(commitTransition({ ...s, transition: tr }, tr.commitTick - 1).phaseId).toBe('p1');
    const committed = commitTransition({ ...s, transition: tr }, tr.commitTick);
    expect(committed.phaseId).toBe('p2');
    expect(committed.visited).toEqual(['p1', 'p2']);
    expect(committed.transition).toBeNull();
  });

  it('does not transition back into a visited phase', () => {
    const s = state({ hpPermille: 400, phaseId: 'p2', visited: Object.freeze(['p1', 'p2']) });
    expect(detectTransition(s, defs, 10)).toBeNull();
  });

  it('honours a transition lock on the current phase', () => {
    const locked = Object.freeze([
      phase('p1', 501, 1001, 1, { transitionLocked: true }),
      phase('p2', 251, 501, 2),
      phase('p3', 0, 251, 3),
    ]);
    expect(detectTransition(state({ hpPermille: 400 }), locked, 10)).toBeNull();
  });

  it('exposes per-phase invulnerability ticks', () => {
    const custom = Object.freeze([phase('p1', 0, 1001, 1, { invulnerableTicks: 20 })]);
    expect(phaseInvulnerableTicks(custom, 'p1')).toBe(20);
    expect(phaseInvulnerableTicks(custom, 'missing')).toBe(0);
  });
});
