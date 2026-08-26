import { describe, expect, it } from 'vitest';
import { stepBattle } from '../../src/game/sim/core/battle-kernel.js';
import type { TickInput } from '../../src/game/sim/core/tick-input.js';
import type { KernelSystem } from '../../src/game/sim/core/tick-context.js';
import { battle, entity, randomSession, tick } from './test-helpers.js';

const input: TickInput = Object.freeze({ paused: false, decisions: Object.freeze([]), contentVersion: 'content_fixture' });

describe('state reducer', () => {
  it('duplicate spawn ID blocks in K', () => {
    const system: KernelSystem = { id: 'spawn', stage: 'K', run(c) { c.commands.push({ kind: 'spawn_entity', entity: entity('entity_alpha') }); } };
    expect(() => stepBattle({ state: battle(), input, random: randomSession(), rules: {}, content: {}, systems: [system] })).toThrow(/P14_DUPLICATE_ENTITY/);
  });

  it('unknown entity transition target blocks', () => {
    const system: KernelSystem = { id: 'transition', stage: 'J', run(c) { c.commands.push({ kind: 'entity_transition', entityId: 'missing', request: { to: 'DEFEATED', priority: 1, reason: 'x' } }); } };
    expect(() => stepBattle({ state: battle(), input, random: randomSession(), rules: {}, content: {}, systems: [system] })).toThrow(/P14_SNAPSHOT_INVALID/);
  });

  it('same-priority battle transition conflict blocks', () => {
    const system: KernelSystem = {
      id: 'end', stage: 'L',
      run(c) {
        c.commands.push({ kind: 'battle_transition', to: 'VICTORY', priority: 10, reason: 'a' });
        c.commands.push({ kind: 'battle_transition', to: 'DEFEAT', priority: 10, reason: 'b' });
      },
    };
    const state = battle({ phase: { phase: 'RESOLVING_END', enteredTick: tick(0), resolvingEndTicks: 0 } });
    expect(() => stepBattle({ state, input, random: randomSession(), rules: {}, content: {}, systems: [system] })).toThrow(/P14_TRANSITION_CONFLICT/);
  });

  it('battle transition conflict is detected beyond the second request', () => {
    // [VICTORY, VICTORY, DEFEAT] at the same priority: the DEFEAT must be a
    // hard conflict, not silently dropped because the first two agree.
    const system: KernelSystem = {
      id: 'end.multi', stage: 'L',
      run(c) {
        c.commands.push({ kind: 'battle_transition', to: 'VICTORY', priority: 10, reason: 'a' });
        c.commands.push({ kind: 'battle_transition', to: 'VICTORY', priority: 10, reason: 'b' });
        c.commands.push({ kind: 'battle_transition', to: 'DEFEAT', priority: 10, reason: 'c' });
      },
    };
    const state = battle({ phase: { phase: 'RESOLVING_END', enteredTick: tick(0), resolvingEndTicks: 0 } });
    expect(() => stepBattle({ state, input, random: randomSession(), rules: {}, content: {}, systems: [system] })).toThrow(/P14_TRANSITION_CONFLICT/);
  });

  it('same-target same-priority battle transitions are idempotent', () => {
    const system: KernelSystem = {
      id: 'end.dup', stage: 'L',
      run(c) {
        c.commands.push({ kind: 'battle_transition', to: 'VICTORY', priority: 10, reason: 'a' });
        c.commands.push({ kind: 'battle_transition', to: 'VICTORY', priority: 10, reason: 'b' });
      },
    };
    const state = battle({ phase: { phase: 'RESOLVING_END', enteredTick: tick(0), resolvingEndTicks: 0 } });
    const r = stepBattle({ state, input, random: randomSession(), rules: {}, content: {}, systems: [system] });
    expect(r.state.phase.phase).toBe('VICTORY');
  });

  it('higher-priority entity transition wins once per tick', () => {
    const system: KernelSystem = {
      id: 'entity', stage: 'J',
      run(c) {
        c.commands.push({ kind: 'entity_transition', entityId: 'entity_alpha', request: { to: 'CONTROLLED', priority: 10, reason: 'stun' } });
        c.commands.push({ kind: 'entity_transition', entityId: 'entity_alpha', request: { to: 'DEFEATED', priority: 90, reason: 'death' } });
      },
    };
    const r = stepBattle({ state: battle(), input, random: randomSession(), rules: {}, content: {}, systems: [system] });
    expect(r.state.entities[0]?.phase.phase).toBe('DEFEATED');
  });
});
