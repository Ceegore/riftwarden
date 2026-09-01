import { describe, expect, it } from 'vitest';
import { stepBattle } from '../../src/game/sim/core/battle-kernel.js';
import { migrateEntity } from '../../src/game/sim/core/migrate.js';
import { createPhase17Systems } from '../../src/game/sim/core/phase17-systems.js';
import { createPhase21Systems } from '../../src/game/sim/core/phase21-systems.js';
import { createSnapshot } from '../../src/game/sim/snapshot/snapshot.js';
import { GLOBAL_NO_PROGRESS_RESOLVE_TICKS, GLOBAL_NO_PROGRESS_WARNING_TICKS } from '../../src/game/sim/anti-stuck/anti-stuck.js';
import type { BossPhaseSnapshot, PhaseDefinition } from '../../src/game/sim/boss/boss-phase-system.js';
import type { KernelSystem } from '../../src/game/sim/core/tick-context.js';
import type { TickInput } from '../../src/game/sim/core/tick-input.js';
import type { BattleModel } from '../../src/game/sim/core/battle-model.js';
import { battle, entity, randomSession } from './test-helpers.js';

/**
 * Phase 21 §4/§5/§9.4 endcap × boss-phase-commit boundary race.
 *
 * The global no-progress endcap (`rift_collapse_timeout`, stage L) and the
 * boss-phase transition COMMIT (`boss.l1.transition_commit`, stage L) can both
 * land on the SAME systems-tick. In a no-objective stall the endcap requests
 * RESOLVING_END the tick `collapseTicks === GLOBAL_NO_PROGRESS_RESOLVE_TICKS`
 * (600); a boss whose transition window commits then races it. Contract:
 *   1. EXACT-TICK RACE — when the `commitTick` equals the endcap boundary, BOTH
 *      effects land: the endcap requests resolution and the boss is observed
 *      committed (persisted `phaseId` === last `BossPhaseStarted`) before the
 *      terminal — no state-vs-terminal desync on the shared tick.
 *   2. NO FORWARD-DATE / NO BACK-DATE — the persisted phase is the committed
 *      target iff its `BossPhaseStarted` fired no later than the terminal tick
 *      (a commit inside the resolving window is truly applied, never forward-
 *      dated), and a transition whose commit is scheduled after the terminal is
 *      never back-dated (the source phase persists, no start event).
 *   3. ONE DETERMINISTIC TERMINAL — a single RiftCollapseEndRequest, one
 *      terminal through the resolving window, byte-identical across re-runs.
 */
const input: TickInput = Object.freeze({ paused: false, decisions: Object.freeze([]), contentVersion: 'content_fixture' });

const HARD_LIMIT = 2700;
const ENDCAP_BOUNDARY = GLOBAL_NO_PROGRESS_WARNING_TICKS + GLOBAL_NO_PROGRESS_RESOLVE_TICKS; // 600

const BOSS_ID = 'boss_ash_unit';
const BOSS_MAX_LP = 1000;

function phaseDefs(p2Window: number): readonly PhaseDefinition[] {
  return Object.freeze([
    Object.freeze({ id: 'p1', bossId: BOSS_ID, priority: 1, minHpPermille: 501, maxHpPermille: 1001, previewKey: 'preview_p1' }),
    Object.freeze({ id: 'p2', bossId: BOSS_ID, priority: 2, minHpPermille: 0, maxHpPermille: 501, previewKey: 'preview_p2', transitionTicks: p2Window }),
  ]);
}

function bossPhaseSeed(): BossPhaseSnapshot {
  return Object.freeze({ entityId: BOSS_ID, bossId: BOSS_ID, phaseId: 'p1', transition: null, visited: Object.freeze(['p1']), invulnerableUntilTick: null });
}

function buildSystems(p2Window: number): readonly KernelSystem[] {
  return Object.freeze([
    ...createPhase17Systems({ speedsX100PerSecond: {} }),
    ...createPhase21Systems({ bossPhaseDefinitions: phaseDefs(p2Window) }),
  ]);
}

function buildBattle(): BattleModel {
  const player = migrateEntity({ entity: entity('unit_p', { side: 'player', lane: 'middle', x100: 1800, maxLp: 1000, lp: 1000 }), radiusX100: 100 });
  // A pure no-progress stall (no attack params, no movement): the collapse
  // counter reaches its threshold at tick 600. The boss sits at 40% HP
  // (permille 400, inside p2); in a stall its phase can only advance when its
  // transition window ends at or before the boundary.
  const boss = migrateEntity({ entity: entity(BOSS_ID, { side: 'enemy', lane: 'middle', x100: 7000, maxLp: BOSS_MAX_LP, lp: 400 }), radiusX100: 120 });
  return battle({
    simulationVersion: 'phase21-endcap-phase-fuzz-v1',
    entities: Object.freeze([player, boss]),
    abilities: Object.freeze([]),
    bossPhase: bossPhaseSeed(),
  });
}

interface RunResult {
  readonly terminal: { phase: string; reason: string | null } | null;
  readonly terminalTick: number;
  readonly collapseRequests: number;
  readonly endRequestTick: number | null;
  readonly commitTick: number | null;
  readonly persistedPhaseId: string;
  readonly lastStartedPhaseId: string | null;
  readonly checksum: string;
}

function runOnce(p2Window: number): RunResult {
  const systems = buildSystems(p2Window);
  let state = buildBattle();
  const random = randomSession();
  let collapseRequests = 0;
  let endRequestTick: number | null = null;
  let commitTick: number | null = null;
  let lastStartedPhaseId: string | null = null;
  let terminal: RunResult['terminal'] = null;
  let terminalTick = -1;
  for (let t = 0; t < HARD_LIMIT; t++) {
    const r = stepBattle({ state, input, random, rules: {}, content: {}, systems });
    state = r.state;
    for (const event of r.events) {
      if (event.type === 'RiftCollapseEndRequest') {
        collapseRequests += 1;
        if (endRequestTick === null) endRequestTick = state.tick;
      }
      if (event.type === 'PhaseTransitionPlanned' && event.contentIds.includes('p2')) commitTick = event.payload['commitTick'] ?? null;
      if (event.type === 'BossPhaseStarted' && event.contentIds.includes('p2')) lastStartedPhaseId = 'p2';
    }
    if (['VICTORY', 'DEFEAT', 'DRAW_ABORT'].includes(state.phase.phase)) {
      terminal = { phase: state.phase.phase, reason: state.endReason };
      terminalTick = state.tick;
      break;
    }
  }
  return {
    terminal,
    terminalTick,
    collapseRequests,
    endRequestTick,
    commitTick,
    persistedPhaseId: state.bossPhase?.phaseId ?? 'none',
    lastStartedPhaseId,
    checksum: createSnapshot(state).checksum,
  };
}

describe('P21 §4/§5/§9.4 endcap × boss-phase-commit boundary race', () => {
  it('the persisted phase never disagrees with the endcap terminal across the boundary sweep', { timeout: 120_000 }, () => {
    // Sweep the transition window across the 600 boundary so the commit lands
    // at / before / after the endcap, and after the terminal (never back-dated).
    let sawExact = 0;
    for (const window of [596, 599, 600, 601, 604, 620]) {
      const a = runOnce(window);
      const b = runOnce(window);
      // 3. Single deterministic terminal, byte-identical across re-runs.
      expect(b.terminal).toEqual(a.terminal);
      expect(b.checksum).toBe(a.checksum);
      expect(b.persistedPhaseId).toBe(a.persistedPhaseId);
      expect(a.terminal, String(window)).not.toBeNull();
      if (a.terminal === null) throw new Error(`window ${String(window)} stalled`);
      expect(a.terminalTick).toBeLessThan(HARD_LIMIT);
      expect(a.collapseRequests, `window ${String(window)} one collapse`).toBe(1);
      expect(a.endRequestTick, `window ${String(window)} boundary`).toBe(ENDCAP_BOUNDARY);
      // The terminal always comes through the endcap/resolver (Chapter-76),
      // never the objective path or an elimination.
      expect(a.terminal.reason, `window ${String(window)} chapter76`).toBe('chapter76_timeout');
      // The transition is always planned (the boss sits in p2's bracket and is
      // seeded into p1).
      expect(a.commitTick, `window ${String(window)} planned`).not.toBeNull();
      if (a.commitTick === null) throw new Error(`window ${String(window)} never planned`);
      // 2. STATUS GATE: the persisted phase matches the last start event, and a
      // commit only ever lands no later than the terminal (never forward-dated);
      // a commit scheduled after the terminal is never back-dated.
      if (a.commitTick <= a.terminalTick) {
        expect(a.persistedPhaseId, `window ${String(window)} committed`).toBe('p2');
        expect(a.lastStartedPhaseId, `window ${String(window)} started`).toBe('p2');
      } else {
        expect(a.persistedPhaseId, `window ${String(window)} not committed`).toBe('p1');
        expect(a.lastStartedPhaseId, `window ${String(window)} no start`).toBeNull();
      }
      if (a.commitTick === ENDCAP_BOUNDARY) sawExact += 1;
    }
    // The exact-tick sharing (commit == endcap boundary == 600) occurred.
    expect(sawExact).toBe(1);
  });

  it('the exact-tick race lands both effects: commit visible while the endcap requests resolution', { timeout: 60_000 }, () => {
    const a = runOnce(600);
    const b = runOnce(600);
    expect(b.checksum).toBe(a.checksum);
    expect(b.terminal).toEqual(a.terminal);
    // Both effects on the shared boundary tick: the collapse request AND the
    // transition commit both land at tick 600.
    expect(a.endRequestTick).toBe(ENDCAP_BOUNDARY);
    expect(a.commitTick).toBe(ENDCAP_BOUNDARY);
    // Status gate at the terminal: persisted p2 with its start event already
    // fired (no desync on the shared tick).
    expect(a.persistedPhaseId).toBe('p2');
    expect(a.lastStartedPhaseId).toBe('p2');
    // One deterministic endcap request, terminal through the resolving window.
    expect(a.collapseRequests).toBe(1);
    expect(a.terminal).not.toBeNull();
    if (a.terminal === null) throw new Error('stalled');
    expect(a.terminal.reason).toBe('chapter76_timeout');
    expect(a.terminalTick).toBeGreaterThanOrEqual(ENDCAP_BOUNDARY);
    expect(a.terminalTick).toBeLessThanOrEqual(ENDCAP_BOUNDARY + 3);
  });

  it('a transition whose commit is after the terminal is never back-dated', { timeout: 60_000 }, () => {
    const a = runOnce(620);
    expect(a.endRequestTick).toBe(ENDCAP_BOUNDARY);
    expect(a.commitTick).not.toBeNull();
    if (a.commitTick === null) throw new Error('no plan');
    // The commit lands well after the resolving window finalizes.
    expect(a.commitTick).toBeGreaterThan(a.terminalTick);
    // p1 persists with NO start event — the pending transition must not be
    // back-dated at the terminal.
    expect(a.persistedPhaseId).toBe('p1');
    expect(a.lastStartedPhaseId).toBeNull();
    expect(a.terminal?.reason).toBe('chapter76_timeout');
  });

  it('a commit inside the resolving window lands truly (no forward-dating)', { timeout: 60_000 }, () => {
    const a = runOnce(601);
    // commitTick 601 sits strictly inside the resolving window (600..602), so
    // it is applied before the finalize at ~603.
    expect(a.commitTick).not.toBeNull();
    expect(a.terminalTick).not.toBeNull();
    if (a.commitTick === null) throw new Error('no plan');
    expect(a.commitTick).toBeGreaterThan(ENDCAP_BOUNDARY);
    expect(a.commitTick).toBeLessThanOrEqual(a.terminalTick);
    // The phase genuinely committed before the terminal — never forward-dated.
    expect(a.persistedPhaseId).toBe('p2');
    expect(a.lastStartedPhaseId).toBe('p2');
    expect(a.terminal?.reason).toBe('chapter76_timeout');
  });
});
