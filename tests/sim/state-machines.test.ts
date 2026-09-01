import { describe, expect, it } from 'vitest';
import { transitionBattlePhase, advanceResolvingEnd, type BattlePhaseState } from '../../src/game/sim/core/battle-state.js';
import { transitionEntityPhase, selectEntityTransition, type EntityPhaseState } from '../../src/game/sim/core/entity-state.js';
import { tick } from './test-helpers.js';

describe('battle state machine', () => {
  it('follows the legal chain and closes terminally', () => {
    let s: BattlePhaseState = { phase: 'PREPARED', enteredTick: tick(0), resolvingEndTicks: 0 };
    for (const [i, to] of (['INTRO', 'ACTIVE', 'PHASE_TRANSITION', 'ACTIVE', 'RESOLVING_END', 'VICTORY'] as const).entries()) {
      s = transitionBattlePhase(s, to, tick(i + 1));
    }
    expect(s.phase).toBe('VICTORY');
    expect(() => transitionBattlePhase(s, 'ACTIVE', tick(9))).toThrow(/P14_STATE_TRANSITION_INVALID/);
  });

  it('blocks the illegal PREPARED -> ACTIVE skip', () => {
    expect(() => transitionBattlePhase({ phase: 'PREPARED', enteredTick: tick(0), resolvingEndTicks: 0 }, 'ACTIVE', tick(1))).toThrow(/P14_STATE_TRANSITION_INVALID/);
  });

  it('caps resolving end at exactly three ticks', () => {
    let s: BattlePhaseState = { phase: 'RESOLVING_END', enteredTick: tick(0), resolvingEndTicks: 0 };
    s = advanceResolvingEnd(s);
    s = advanceResolvingEnd(s);
    s = advanceResolvingEnd(s);
    expect(s.resolvingEndTicks).toBe(3);
    expect(() => advanceResolvingEnd(s)).toThrow(/P14_RESOLVING_END_LIMIT/);
  });
});

describe('entity state machine', () => {
  it('controlled returns only to the previous legal state', () => {
    let s: EntityPhaseState = { phase: 'ACTIVE', enteredTick: tick(0), controlledReturn: null };
    s = transitionEntityPhase(s, 'CONTROLLED', tick(1));
    expect(s.controlledReturn).toBe('ACTIVE');
    expect(() => transitionEntityPhase(s, 'PREPARING', tick(2))).toThrow(/P14_STATE_TRANSITION_INVALID/);
    s = transitionEntityPhase(s, 'ACTIVE', tick(2));
    expect(s.phase).toBe('ACTIVE');
  });

  it('defeated may revive or remove, removed is terminal', () => {
    let s: EntityPhaseState = { phase: 'ACTIVE', enteredTick: tick(0), controlledReturn: null };
    s = transitionEntityPhase(s, 'DEFEATED', tick(1));
    expect(transitionEntityPhase(s, 'ACTIVE', tick(2)).phase).toBe('ACTIVE');
    s = transitionEntityPhase(s, 'REMOVED', tick(2));
    expect(() => transitionEntityPhase(s, 'ACTIVE', tick(3))).toThrow(/P14_STATE_TRANSITION_INVALID/);
  });
});

describe('transition arbitration', () => {
  it('higher transition priority wins and equal conflict blocks', () => {
    expect(selectEntityTransition([{ to: 'DEFEATED', priority: 90, reason: 'death' }, { to: 'CONTROLLED', priority: 50, reason: 'stun' }])?.to).toBe('DEFEATED');
    expect(() => selectEntityTransition([{ to: 'DEFEATED', priority: 90, reason: 'a' }, { to: 'REMOVED', priority: 90, reason: 'b' }])).toThrow(/P14_TRANSITION_CONFLICT/);
  });
});
