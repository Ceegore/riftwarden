import { describe, expect, it } from 'vitest';
import { applyNodeCommand, NODE_STAGES, transition } from '../../src/game/expedition/node-flow.js';
import { assertNodeType, definitionOf, isNodeType } from '../../src/game/expedition/node-registry.js';
import { NODE_TYPES } from '../../src/game/expedition/types.js';
import { catchExpeditionCode } from './phase28-helpers.js';

describe('phase28 node flow', () => {
  it('walks the full happy path end to end', () => {
    let stage = applyNodeCommand('previewed', 'enter');
    expect(stage).toBe('entering');
    stage = applyNodeCommand(stage, 'commitEnter');
    expect(stage).toBe('entered');
    stage = applyNodeCommand(stage, 'resolve');
    expect(stage).toBe('resolving');
    stage = applyNodeCommand(stage, 'commitDecision');
    expect(stage).toBe('reward_pending');
    stage = applyNodeCommand(stage, 'commitReward');
    expect(stage).toBe('exiting');
    stage = applyNodeCommand(stage, 'commitExit');
    expect(stage).toBe('completed');
  });

  it('rejects completed nodes and invalid jumps', () => {
    expect(catchExpeditionCode(() => applyNodeCommand('completed', 'enter'))).toBe('NODE_ALREADY_COMPLETED');
    expect(catchExpeditionCode(() => applyNodeCommand('previewed', 'commitReward'))).toBe('INVALID_NODE_TRANSITION');
    expect(catchExpeditionCode(() => applyNodeCommand('entered', 'enter'))).toBe('INVALID_NODE_TRANSITION');
  });

  it('the resolving stage branches to decision or reward pending', () => {
    expect(transition('resolving', 'decision_pending')).toBe('decision_pending');
    expect(transition('resolving', 'reward_pending')).toBe('reward_pending');
  });

  it('exposes the closed eight-stage machine', () => {
    expect(NODE_STAGES).toEqual([
      'previewed',
      'entering',
      'entered',
      'resolving',
      'decision_pending',
      'reward_pending',
      'exiting',
      'completed',
    ]);
  });
});

describe('phase28 closed registry', () => {
  it('accepts exactly the twelve Phase 32 types', () => {
    expect(NODE_TYPES).toEqual([
      'battle',
      'elite',
      'boss',
      'event',
      'merchant',
      'recruitment',
      'treasure',
      'workshop',
      'altar',
      'scout',
      'anchor',
      'story',
    ]);
    expect(isNodeType('battle')).toBe(true);
    expect(isNodeType('anchor')).toBe(true);
    expect(isNodeType('merchant')).toBe(true);
  });

  it('assertNodeType rejects unsupported types', () => {
    expect(catchExpeditionCode(() => {
      assertNodeType('unknown');
    })).toBe('UNKNOWN_NODE_TYPE');
    expect(catchExpeditionCode(() => {
      assertNodeType(42);
    })).toBe('UNKNOWN_NODE_TYPE');
  });

  it('each type declares its presentation key and default delta', () => {
    const battle = definitionOf('battle');
    expect(battle.labelKey).toBe('node.type.battle');
    expect(battle.defaultInstabilityDelta).toBe(5);
    const anchor = definitionOf('anchor');
    expect(anchor.labelKey).toBe('node.type.anchor');
    expect(anchor.defaultInstabilityDelta).toBe(-10);
  });
});
