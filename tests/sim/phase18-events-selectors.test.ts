import { describe, expect, it } from 'vitest';
import { buildStatusPayload, ignoreReasonOrdinal, statusContentIds } from '../../src/game/sim/status/status-events.js';
import { progressBps, sourceCount, stackCount } from '../../src/game/sim/status/selectors.js';
import {
  PERMANENT_END_TICK,
  removalReasonOrdinal,
  statusKindOrdinal,
  type StatusInstance,
  type StatusKind,
} from '../../src/game/sim/status/status-instance.js';

let seq = 0;
function status(kind: StatusKind, overrides: Partial<StatusInstance> = {}): StatusInstance {
  seq += 1;
  return Object.freeze({
    statusId: `st_${String(seq)}`,
    kind,
    polarity: 'negative',
    targetId: 'unit_target',
    sourceId: 'unit_source',
    effectId: 'effect_x',
    startTick: 10,
    endTick: 60,
    strength: 100,
    stackGroup: 'group',
    sequence: seq,
    stackPolicy: 'refresh_duration',
    maxStacks: 1,
    flags: Object.freeze([]),
    ...overrides,
  });
}

describe('P18 T06 selectors (§10)', () => {
  it('progress advances in basis points and clamps at both ends', () => {
    const s = status('burn', { startTick: 10, endTick: 60 });
    expect(progressBps(s, 10)).toBe(0);
    expect(progressBps(s, 35)).toBe(5000); // halfway
    expect(progressBps(s, 60)).toBe(10000);
    expect(progressBps(s, 70)).toBe(10000);
    expect(progressBps(s, 5)).toBe(0);
  });

  it('permanent statuses report zero progress', () => {
    expect(progressBps(status('mark', { endTick: PERMANENT_END_TICK }), 1000)).toBe(0);
  });

  it('counts distinct sources and stacks', () => {
    const a = status('burn', { sourceId: 's1' });
    const b = status('burn', { sourceId: 's2' });
    const c = status('poison', { sourceId: 's1' });
    expect(sourceCount([a, b, c])).toBe(2);
    expect(stackCount([a, b, c])).toBe(3);
    expect(stackCount([a, b, c], 'burn')).toBe(2);
    expect(stackCount([a, b, c], 'poison')).toBe(1);
  });
});

describe('P18 T06 status events (§10)', () => {
  it('carries integer/ID-based payloads with stable ordinals', () => {
    const s = status('burn', { strength: 120, endTick: 60, contentIconId: 'icon_burn' });
    const payload = buildStatusPayload(s, 2, 'cleansed');
    expect(payload).toEqual({
      stackCount: 2,
      endTick: 60,
      strength: 120,
      kindOrdinal: statusKindOrdinal('burn'),
      reasonOrdinal: removalReasonOrdinal('cleansed'),
    });
    expect(statusContentIds(s)).toEqual([s.statusId, 'effect_x', 'icon_burn']);
  });

  it('ordinals are stable for reasons', () => {
    expect(removalReasonOrdinal('expired')).toBe(0);
    expect(removalReasonOrdinal('cleansed')).toBe(1);
    expect(removalReasonOrdinal('dispelled')).toBe(2);
    expect(ignoreReasonOrdinal('ignored_weaker')).toBe(0);
    expect(ignoreReasonOrdinal('ignored_no_reapply')).toBe(1);
    expect(ignoreReasonOrdinal('ignored_duration_cap')).toBe(2);
    expect(ignoreReasonOrdinal('refreshed_no_delta')).toBe(3);
  });
});
