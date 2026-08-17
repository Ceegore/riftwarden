import { describe, expect, it } from 'vitest';
import { stepBattle } from '../../src/game/sim/core/battle-kernel.js';
import { createNoopSystems } from '../../src/game/sim/core/noop-systems.js';
import type { TickInput } from '../../src/game/sim/core/tick-input.js';
import type { TickContext } from '../../src/game/sim/core/tick-context.js';
import type { PipelineStage } from '../../src/game/sim/core/pipeline-stage.js';
import type { KernelCommand } from '../../src/game/sim/core/command-types.js';
import { battle, entity, randomSession, eventInput, tick } from './test-helpers.js';

const input: TickInput = Object.freeze({ paused: false, decisions: Object.freeze([]), contentVersion: 'content_fixture' });

const stage = (id: string, s: PipelineStage, run: (c: TickContext) => void) => ({ id, stage: s, run });

describe('A-M pipeline', () => {
  it('all thirteen stages run exactly once in A-M order', () => {
    const r = stepBattle({ state: battle(), input, random: randomSession(), rules: {}, content: {}, systems: createNoopSystems() });
    expect(r.callOrder).toEqual([
      'A:noop.finalize_previous', 'B:noop.timers', 'C:noop.periodic', 'D:noop.triggers', 'E:noop.targeting', 'F:noop.movement', 'G:noop.cast_progress',
      'H:noop.resolve_committed', 'I:noop.apply_effects', 'J:noop.death_resolution', 'K:noop.spawn', 'L:noop.end_resolution', 'M:noop.snapshot',
    ]);
    expect(r.state.tick).toBe(1);
  });

  it('system order is stable by ASCII id, not registration order', () => {
    const systems = [
      stage('zeta', 'E', () => { /* no-op system */ }),
      stage('alpha', 'E', () => { /* no-op system */ }),
    ];
    const r = stepBattle({ state: battle(), input, random: randomSession(), rules: {}, content: {}, systems });
    expect(r.callOrder).toEqual(['E:alpha', 'E:zeta']);
  });

  it('later phase sees state reduced by earlier phase', () => {
    const systems = [
      stage('damage', 'I', (c) => { c.commands.push({ kind: 'apply_lp_delta', entityId: 'entity_alpha', delta: -100 }); }),
      stage('observe', 'J', (c) => { expect(c.state.entities[0]?.lp).toBe(900); }),
    ];
    const r = stepBattle({ state: battle(), input, random: randomSession(), rules: {}, content: {}, systems });
    expect(r.state.entities[0]?.lp).toBe(900);
  });

  it('cross-phase death/spawn/end commands block', () => {
    const cases: [PipelineStage, KernelCommand][] = [
      ['I', { kind: 'remove_entity', entityId: 'entity_alpha' }],
      ['J', { kind: 'spawn_entity', entity: entity('entity_beta') }],
      ['K', { kind: 'battle_transition', to: 'RESOLVING_END', priority: 1, reason: 'early' }],
    ];
    for (const [s, command] of cases) {
      expect(() => stepBattle({ state: battle(), input, random: randomSession(), rules: {}, content: {}, systems: [stage('bad', s, (c) => { c.commands.push(command); })] })).toThrow(/P14_COMMAND_STAGE/);
    }
  });

  it('INTRO rejects combat and ability events', () => {
    const state = battle({ phase: Object.freeze({ phase: 'INTRO', enteredTick: tick(0), resolvingEndTicks: 0 }) });
    const system = stage('bad.attack', 'H', (c) => { c.commands.push({ kind: 'append_event', event: eventInput('DamageApplied') }); });
    expect(() => stepBattle({ state, input, random: randomSession(), rules: {}, content: {}, systems: [system] })).toThrow(/P14_STATE_TRANSITION_INVALID/);
  });

  it('paused and terminal calls are true no-ops', () => {
    let called = 0;
    const system = stage('should.not.run', 'A', () => {
      called++;
    });
    const state = battle();
    const rnd = randomSession();
    const before = JSON.stringify(rnd.streams.snapshotAll());
    const paused = stepBattle({ state, input: { ...input, paused: true }, random: rnd, rules: {}, content: {}, systems: [system] });
    expect(paused.state).toBe(state);
    expect(called).toBe(0);
    expect(JSON.stringify(rnd.streams.snapshotAll())).toBe(before);
    const terminal = stepBattle({ state: battle({ phase: Object.freeze({ phase: 'VICTORY', enteredTick: tick(0), resolvingEndTicks: 0 }) }), input, random: rnd, rules: {}, content: {}, systems: [system] });
    expect(terminal.callOrder.length).toBe(0);
  });
});
