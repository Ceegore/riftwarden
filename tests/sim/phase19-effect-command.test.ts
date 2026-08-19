import { describe, expect, it } from 'vitest';
import { KernelInvariantError } from '../../src/game/sim/core/invariant-error.js';
import { startLaneChange } from '../../src/game/sim/movement/lane-change.js';
import type { ShieldSource } from '../../src/game/sim/combat/shield-ledger.js';
import type { StatusInstance } from '../../src/game/sim/status/status-instance.js';
import {
  canonicalizeEffectBatch,
  deferredReasonOf,
  enqueueEffect,
  mapToKernelCommand,
  validateEffectBatch,
} from '../../src/game/sim/ability/effect-executor.js';
import type { EffectCommand, SourceSnapshot } from '../../src/game/sim/ability/effect-command.js';
import { tick } from './test-helpers.js';

const sourceSnapshot: SourceSnapshot = Object.freeze({
  sourceId: 'source',
  sourceLane: 'middle',
  sourceX100: 1000,
  sourceLp: 800,
  sourceMaxLp: 1000,
});

const base = {
  commandId: 'cmd_1',
  abilityInstanceId: 'ability_instance_1',
  abilityId: 'ability_fireball',
  effectIndex: 0,
  sourceId: 'source',
  targetRef: Object.freeze({ kind: 'entity' as const, entityId: 'enemy_1', groundKey: null, slotId: null }),
  scheduledTick: 10,
  stage: 'I' as const,
  sourceSnapshot,
  sequence: 0,
};

function cmd(kind: EffectCommand['kind'], overrides: Record<string, unknown> = {}): EffectCommand {
  const payload = (() => {
    switch (kind) {
      case 'damage':
      case 'heal':
        return { amount: 100 };
      case 'shield':
        return { shields: [shield()] };
      case 'apply_status':
      case 'mark':
        return { statuses: [statusInstance()] };
      case 'remove_status':
        return { statusIds: ['status_1'] };
      case 'move':
        return { lane: 'bottom', x100: 4000 };
      case 'lane_change':
        return { laneChange: startLaneChange('middle', 'bottom', tick(5), 'source', 'ability') };
      case 'spawn_request':
        return { summonId: 'summon_imp' };
      case 'modify_charge':
        return { deltaTicks: 5 };
      case 'taunt':
        return { durationTicks: 30 };
      case 'modify_objective':
      case 'modify_world':
        return { port: 'objective_port' };
      case 'cleanse':
      case 'dispel':
        return {};
      default:
        return {};
    }
  })();
  return Object.freeze({ ...base, kind, ...payload, ...overrides }) as EffectCommand;
}

function shield(): ShieldSource {
  return Object.freeze({ shieldId: 'shield_1', sourceId: 'source', effectId: 'effect_1', remaining: 100, expiryTick: 50, priority: 1, applicationSequence: 0 });
}

function statusInstance(): StatusInstance {
  return Object.freeze({
    statusId: 'status_1',
    kind: 'burn',
    polarity: 'negative',
    targetId: 'enemy_1',
    sourceId: 'source',
    effectId: 'effect_1',
    startTick: 0,
    endTick: 10,
    strength: 5,
    stackGroup: 'burn_stack',
    sequence: 0,
    stackPolicy: 'refresh_duration',
    maxStacks: 1,
    flags: Object.freeze([]),
  });
}

describe('P19-T03 effect executor — validation', () => {
  it.each(['damage', 'heal', 'shield', 'apply_status', 'remove_status', 'cleanse', 'dispel', 'move', 'lane_change', 'spawn_request', 'modify_charge', 'taunt', 'mark', 'modify_objective', 'modify_world'] as const)(
    'accepts a valid %s command',
    (kind) => {
      expect(() => {
        validateEffectBatch([cmd(kind)]);
      }).not.toThrow();
    },
  );

  it('rejects duplicate commandId', () => {
    expect(() => {
      validateEffectBatch([cmd('damage'), cmd('heal', { commandId: 'cmd_1' })]);
    }).toThrow(KernelInvariantError);
  });

  it('rejects duplicate effectIndex within an instance', () => {
    expect(() => {
      validateEffectBatch([cmd('damage'), cmd('heal', { effectIndex: 0 })]);
    }).toThrow(KernelInvariantError);
  });

  it('rejects negative/float/NaN amounts', () => {
    expect(() => {
      validateEffectBatch([cmd('damage', { amount: -1 })]);
    }).toThrow(KernelInvariantError);
    expect(() => {
      validateEffectBatch([cmd('damage', { amount: 1.5 })]);
    }).toThrow(KernelInvariantError);
    expect(() => {
      validateEffectBatch([cmd('damage', { amount: Number.NaN })]);
    }).toThrow(KernelInvariantError);
  });

  it('rejects malformed ids and stages', () => {
    expect(() => {
      validateEffectBatch([cmd('damage', { commandId: 'Bad Id' })]);
    }).toThrow(KernelInvariantError);
    expect(() => {
      validateEffectBatch([cmd('damage', { stage: 'Z' })]);
    }).toThrow(KernelInvariantError);
    expect(() => {
      validateEffectBatch([cmd('damage', { targetRef: { kind: 'entity', entityId: 'Bad Id', groundKey: null, slotId: null } })]);
    }).toThrow(KernelInvariantError);
  });
});

describe('P19-T03 effect executor — canonical order and sequences', () => {
  it('orders by (scheduledTick, stagePriority, instance, effectIndex, targetKey) and assigns sequences', () => {
    const later = cmd('damage', { commandId: 'cmd_later', effectIndex: 1, scheduledTick: 20 });
    const earlier = cmd('heal', { commandId: 'cmd_earlier', effectIndex: 2, scheduledTick: 5 });
    const out = canonicalizeEffectBatch([later, earlier]);
    expect(out[0]?.commandId).toBe('cmd_earlier');
    expect(out[1]?.commandId).toBe('cmd_later');
    expect(out.map((c) => c.sequence)).toEqual([0, 1]);
  });

  it('is permutation-stable', () => {
    const a = cmd('damage', { commandId: 'cmd_a', effectIndex: 1, scheduledTick: 5 });
    const b = cmd('heal', { commandId: 'cmd_b', effectIndex: 2, scheduledTick: 15 });
    const one = canonicalizeEffectBatch([a, b]);
    const two = canonicalizeEffectBatch([b, a]);
    expect(one.map((c) => c.commandId)).toEqual(two.map((c) => c.commandId));
  });

  it('breaks ties by stage priority then instance then effectIndex then target', () => {
    const inst2 = cmd('damage', { commandId: 'cmd_b', abilityInstanceId: 'ability_instance_2' });
    const inst1 = cmd('heal', { commandId: 'cmd_a', abilityInstanceId: 'ability_instance_1' });
    const out = canonicalizeEffectBatch([inst2, inst1]);
    expect(out.map((c) => c.commandId)).toEqual(['cmd_a', 'cmd_b']);
  });
});

describe('P19-T03 effect executor — kernel mapping', () => {
  it('maps damage/heal to apply_lp_delta with sign', () => {
    expect(mapToKernelCommand(cmd('damage', { amount: 120 }))).toEqual({ kind: 'apply_lp_delta', entityId: 'enemy_1', delta: -120, sourceId: 'source' });
    expect(mapToKernelCommand(cmd('heal', { amount: 80 }))).toEqual({ kind: 'apply_lp_delta', entityId: 'enemy_1', delta: 80, sourceId: 'source' });
  });

  it('maps shield to set_shields', () => {
    const s = shield();
    const mapped = mapToKernelCommand(cmd('shield', { shields: [s] }));
    expect(mapped).toEqual({ kind: 'set_shields', entityId: 'enemy_1', shields: [s] });
  });

  it('maps apply_status/mark to set_statuses', () => {
    const s = statusInstance();
    expect(mapToKernelCommand(cmd('apply_status', { statuses: [s] }))).toEqual({ kind: 'set_statuses', statuses: [s] });
    expect(mapToKernelCommand(cmd('mark', { statuses: [s] }))).toEqual({ kind: 'set_statuses', statuses: [s] });
  });

  it('maps cleanse/dispel to queue_cleanse_dispel', () => {
    expect(mapToKernelCommand(cmd('cleanse'))).toEqual({ kind: 'queue_cleanse_dispel', targetId: 'enemy_1', request: 'cleanse' });
    expect(mapToKernelCommand(cmd('dispel'))).toEqual({ kind: 'queue_cleanse_dispel', targetId: 'enemy_1', request: 'dispel' });
  });

  it('maps move to set_position and lane_change to set_lane_change', () => {
    expect(mapToKernelCommand(cmd('move', { lane: 'bottom', x100: 4000 }))).toEqual({ kind: 'set_position', entityId: 'enemy_1', lane: 'bottom', x100: 4000 });
    const lc = startLaneChange('middle', 'bottom', tick(5), 'source', 'ability');
    expect(mapToKernelCommand(cmd('lane_change', { laneChange: lc }))).toEqual({ kind: 'set_lane_change', entityId: 'enemy_1', state: lc });
  });
});

describe('P19-T03 effect executor — deferral', () => {
  it('defers spawn_request to Phase 20', () => {
    expect(deferredReasonOf(cmd('spawn_request'))).toBe('summon_lifecycle_phase20');
  });

  it('defers remove_status and modify_charge to the ability system', () => {
    expect(deferredReasonOf(cmd('remove_status'))).toBe('ability_system_internal');
    expect(deferredReasonOf(cmd('modify_charge'))).toBe('ability_system_internal');
  });

  it('defers taunt/objective/world to future authorized ports', () => {
    expect(deferredReasonOf(cmd('taunt'))).toBe('no_authorized_port');
    expect(deferredReasonOf(cmd('modify_objective'))).toBe('no_authorized_port');
    expect(deferredReasonOf(cmd('modify_world'))).toBe('no_authorized_port');
  });

  it('enqueueEffect returns mapped for damage and deferred for taunt', () => {
    const mapped = enqueueEffect(cmd('damage'));
    expect(mapped.status).toBe('mapped');
    const deferred = enqueueEffect(cmd('taunt'));
    expect(deferred.status).toBe('deferred');
    if (deferred.status === 'deferred') expect(deferred.reason).toBe('no_authorized_port');
  });
});
