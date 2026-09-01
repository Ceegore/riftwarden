import { describe, expect, it } from 'vitest';
import { EVENT_DEFINITIONS } from '../../src/game/expedition/events/event-content.js';
import { attachEventSnapshot, buildEventCommands, materializeEvent, optionAvailability } from '../../src/game/expedition/events/event-service.js';
import { eventHandler } from '../../src/game/expedition/nodes/handlers/event.js';
import { commitNodeAction, prepareNodeCommit } from '../../src/game/expedition/nodes/node-transaction.js';
import { commitFlow, definition, openAndPrepare, request, baseState } from './phase32-helpers.js';
import type { EventDefinition } from '../../src/game/expedition/events/event-types.js';

function eventDefinition(overrides: Partial<EventDefinition>): EventDefinition {
  return {
    eventId: 'test-event',
    prerequisites: [],
    options: [
      { optionId: 'test-a', labelKey: 'test.a', cost: { gold: 5 }, preview: ['VISIBLE_SAFE_OUTCOME'], rollSlots: [] },
      { optionId: 'test-b', labelKey: 'test.b', cost: {}, preview: ['VISIBLE_RISK'], rollSlots: ['test-risk'] },
      { optionId: 'test-c', labelKey: 'test.c', cost: { instability: 2 }, preview: ['VISIBLE_TRADEOFF'], rollSlots: [] },
    ],
    ...overrides,
  };
}

describe('phase32 event content + snapshot', () => {
  it('materializes exactly once and replays the stored snapshot on reload', () => {
    const state = baseState();
    const first = materializeEvent(state, EVENT_DEFINITIONS[0] ?? eventDefinition({}), 'node-event-1');
    expect(first.kind).toBe('EVENT');
    const attached = attachEventSnapshot(state, first);
    const replay = materializeEvent(attached, EVENT_DEFINITIONS[0] ?? eventDefinition({}), 'node-event-1');
    expect(replay).toBe(first);
  });

  it('resolves roll slots deterministically from the persisted seed', () => {
    const state = baseState({ runId: 'run-rolls' });
    const a = materializeEvent(state, EVENT_DEFINITIONS[0] ?? eventDefinition({}), 'node-event-1');
    const b = materializeEvent(state, EVENT_DEFINITIONS[0] ?? eventDefinition({}), 'node-event-1');
    expect(a.rollSlots).toEqual(b.rollSlots);
    expect(Object.values(a.rollSlots).every((v) => v >= 0 && v < 10000)).toBe(true);
  });

  it('keeps non-fulfillable options visible but greyed with a reason', () => {
    const poor = baseState({ gold: 3 });
    const availability = optionAvailability(poor, eventDefinition({}));
    const safe = availability.find((o) => o.optionId === 'test-a');
    expect(safe?.available).toBe(false);
    expect(safe?.blockedReasonKey).toBe('event.requirement.gold');
    const free = availability.find((o) => o.optionId === 'test-b');
    expect(free?.available).toBe(true);
  });

  it('blocks options whose prerequisites are unmet (precondition filter)', () => {
    const state = baseState();
    const availability = optionAvailability(state, eventDefinition({ prerequisites: ['relic:gate'] }));
    expect(availability.every((o) => !o.available)).toBe(true);
    const withKnowledge = baseState({ knowledge: ['relic:gate'] });
    const reopened = optionAvailability(withKnowledge, eventDefinition({ prerequisites: ['relic:gate'] }));
    expect(reopened.every((o) => o.available)).toBe(true);
  });

  it('blocks options that would exceed the instability cap', () => {
    const state = baseState({ instability: 99 });
    const availability = optionAvailability(state, eventDefinition({}));
    const tradeoff = availability.find((o) => o.optionId === 'test-c');
    expect(tradeoff?.available).toBe(false);
    expect(tradeoff?.blockedReasonKey).toBe('event.requirement.instability');
  });
});

describe('phase32 event handler', () => {
  const def = definition('node-event-9', 'event', 'event-01');

  it('confirms an option and commits costs plus the deterministic outcome exactly once', () => {
    let state = openAndPrepare(baseState(), eventHandler, def);
    const confirm = commitFlow(state, eventHandler, def, request(def.nodeId, 'CONFIRM', 'tx-event-confirm', 'event-01-a'));
    expect(confirm.outcome.result.status).toBe('COMMITTED');
    state = confirm.state;
    expect(state.gold).toBe(95);
    expect(state.unsecuredLoot).toContain('event-01:event-01-a:safe');
    const replay = commitFlow(state, eventHandler, def, request(def.nodeId, 'CONFIRM', 'tx-event-confirm', 'event-01-a'));
    expect(replay.outcome.replayed).toBe(true);
    expect(replay.outcome.result.status).toBe('COMMITTED');
    expect(replay.state.gold).toBe(95);
  });

  it('a duplicate callback never double-charges', () => {
    const state = openAndPrepare(baseState(), eventHandler, def);
    const first = commitFlow(state, eventHandler, def, request(def.nodeId, 'CONFIRM', 'tx-event-dup', 'event-01-a'));
    const second = commitFlow(first.state, eventHandler, def, request(def.nodeId, 'CONFIRM', 'tx-event-dup', 'event-01-a'));
    expect(first.state.gold).toBe(95);
    expect(second.state.gold).toBe(95);
    expect(second.outcome.replayed).toBe(true);
  });

  it('risk options use the roll slot resolved at open (no re-roll on reload)', () => {
    const defB = definition('node-event-10', 'event', 'event-01');
    const state = openAndPrepare(baseState(), eventHandler, defB);
    const snapshot = state.snapshots[defB.nodeId];
    if (snapshot?.kind !== 'EVENT') throw new Error('event snapshot missing');
    const before = { ...snapshot.rollSlots };
    const confirmed = commitFlow(state, eventHandler, defB, request(defB.nodeId, 'CONFIRM', 'tx-event-risk', 'event-01-b'));
    expect(confirmed.outcome.result.status).toBe('COMMITTED');
    const after = confirmed.state.snapshots[defB.nodeId];
    if (after?.kind !== 'EVENT') throw new Error('event snapshot missing');
    expect(after.rollSlots).toEqual(before);
  });

  it('decline ends the node without costs and without rewards', () => {
    let state = openAndPrepare(baseState(), eventHandler, def);
    const decline = commitFlow(state, eventHandler, def, request(def.nodeId, 'DECLINE', 'tx-event-decline'));
    expect(decline.outcome.result.status).toBe('COMMITTED');
    state = decline.state;
    expect(state.gold).toBe(100);
    expect(state.unsecuredLoot).toHaveLength(0);
  });

  it('rejects unavailable options with a visible reason', () => {
    const poor = openAndPrepare(baseState({ gold: 3 }), eventHandler, def);
    const confirm = commitFlow(poor, eventHandler, def, request(def.nodeId, 'CONFIRM', 'tx-event-poor', 'event-01-a'));
    expect(confirm.outcome.result.status).toBe('REJECTED');
    expect(confirm.outcome.result.reason).toBe('OPTION_UNAVAILABLE');
    expect(confirm.state.gold).toBe(3);
  });

  it('rejects an unknown option as structural misuse (no ledger entry)', () => {
    const state = openAndPrepare(baseState(), eventHandler, def);
    expect(() => commitFlow(state, eventHandler, def, request(def.nodeId, 'CONFIRM', 'tx-event-unknown', 'event-99'))).toThrow();
  });

  it('unknown event payload is a content build error', () => {
    const bad = definition('node-event-11', 'event', 'event-999');
    expect(() => eventHandler.prepare(bad, baseState())).toThrow();
  });

  it('commands from the snapshot are deterministic across reloads', () => {
    const stateA = openAndPrepare(baseState({ runId: 'run-evt-a' }), eventHandler, def);
    const stateB = openAndPrepare(baseState({ runId: 'run-evt-a' }), eventHandler, def);
    const commandsA = buildEventCommands(stateA, EVENT_DEFINITIONS[0] ?? eventDefinition({}), def.nodeId, 'event-01-a');
    const commandsB = buildEventCommands(stateB, EVENT_DEFINITIONS[0] ?? eventDefinition({}), def.nodeId, 'event-01-a');
    expect(commandsA).toEqual(commandsB);
  });

  it('safely recovers a COMMITTING event visit via the ledger', () => {
    const state = openAndPrepare(baseState(), eventHandler, def);
    const prepared = prepareNodeCommit(state, request(def.nodeId, 'CONFIRM', 'tx-event-recover', 'event-01-a'));
    expect(prepared.visits[def.nodeId]?.status).toBe('COMMITTING');
    // Kill here: recovery sees the ledger entry (commit ran durably) → COMMITTED.
    const committed = commitNodeAction(
      prepared,
      request(def.nodeId, 'CONFIRM', 'tx-event-recover', 'event-01-a'),
      def,
      eventHandler.validate.bind(eventHandler),
      eventHandler.commit.bind(eventHandler),
    );
    expect(committed.result.status).toBe('COMMITTED');
    expect(committed.state.visits[def.nodeId]?.status).toBe('COMMITTED');
  });
});
