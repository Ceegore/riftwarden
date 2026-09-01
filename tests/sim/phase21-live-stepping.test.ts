import { describe, expect, it } from 'vitest';
import { createLiveSimBattle, createSimBattleHost, resolveExpeditionEncounter } from '../../src/features/battle/sim/sim-battle-host.js';
import { encounterOutboundFromBattle } from '../../src/features/battle/outbound/phase21-outbound-presenter.js';

/**
 * Phase 21 §9 live stepping battle.
 *
 * The expedition battle screen now OWNS a real kernel battle
 * (`createLiveSimBattle`) and steps it tick by tick instead of replaying a
 * single final snapshot on mount. Contract:
 *   1. STEP MONOTONICITY — every `step()` advances the outbound tick by
 *      exactly 1 (the kernel advances one tick per step).
 *   2. COUNTDOWN LIVES — a mid-flight telegraph's remaining ticks decrease
 *      between snapshots as the battle advances toward its resolve tick.
 *   3. TERMINAL — the stepped battle reaches a terminal phase.
 *   4. DETERMINISM — the final stepped snapshot is byte-identical to the
 *      monolithic `run()` (stepping is just a slower replay of the same
 *      deterministic fixture seed), and two stepped runs match.
 */
const TERMINALS: readonly string[] = Object.freeze(['VICTORY', 'DEFEAT', 'DRAW_ABORT']);

describe('P21 §9 live stepping battle', () => {
  it('steps a boss battle tick by tick, ticking the telegraph countdown down to the same terminal as run()', { timeout: 120_000 }, () => {
    const encounter = resolveExpeditionEncounter('boss', 'enemy_fixture_echo');
    expect(encounter).not.toBeNull();
    if (encounter === null) throw new Error('boss node unresolved');

    const handle = createLiveSimBattle({ encounter });
    const monolithic = createSimBattleHost({ encounter }).run();
    expect(TERMINALS).toContain(monolithic.phase.phase);

    const ticks: number[] = [];
    const countdowns: number[] = [];
    let last = handle.snapshot();
    for (let i = 0; i < 2000; i++) {
      if (TERMINALS.includes(last.phase.phase)) break;
      const next = handle.step();
      ticks.push(next.tick);
      // The first unresolved telegraph's remaining ticks (its commit tick minus
      // the current snapshot tick) — must shrink as the battle advances.
      const telegraphs = encounterOutboundFromBattle(next).telegraphs ?? [];
      const pending = telegraphs.find((t) => t[2] > next.tick);
      if (pending !== undefined) countdowns.push(pending[2] - next.tick);
      last = next;
    }

    // 1. STEP MONOTONICITY: strictly one tick per step.
    expect(ticks.length).toBeGreaterThan(0);
    for (let i = 1; i < ticks.length; i++) {
      expect(ticks[i]! - ticks[i - 1]!, `tick jump at step ${String(i)}`).toBe(1);
    }
    // 2. COUNTDOWN LIVES: at least two snapshots saw the same telegraph pending,
    // with the later one strictly closer to resolve.
    expect(countdowns.length).toBeGreaterThan(1);
    expect(countdowns[countdowns.length - 1]!).toBeLessThan(countdowns[0]!);
    // 3. TERMINAL: the stepped battle reached a terminal phase.
    expect(TERMINALS).toContain(last.phase.phase);
    // 4. DETERMINISM: the stepped terminal snapshot equals the monolithic run.
    expect(last).toEqual(monolithic);
  });

  it('a second live battle replays the identical stepped trace (deterministic seed)', { timeout: 120_000 }, () => {
    const encounter = resolveExpeditionEncounter('battle', 'enemy_fixture_echo');
    expect(encounter).not.toBeNull();
    if (encounter === null) throw new Error('battle node unresolved');

    const runOne = (): readonly (readonly [number, string])[] => {
      const handle = createLiveSimBattle({ encounter });
      const trace: [number, string][] = [];
      let last = handle.snapshot();
      for (let i = 0; i < 2000; i++) {
        if (TERMINALS.includes(last.phase.phase)) break;
        const next = handle.step();
        trace.push([next.tick, next.bossPhase?.phaseId ?? ''] as const);
        last = next;
      }
      return Object.freeze(trace);
    };
    expect(runOne()).toEqual(runOne());
  });
});
