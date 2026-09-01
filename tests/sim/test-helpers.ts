import { parseRunSeed } from '../../src/game/sim/random/run-seed.js';
import { RngStreamMap } from '../../src/game/sim/random/rng-stream-map.js';
import { RollSlotRegistry } from '../../src/game/sim/random/roll-slot-registry.js';
import { RandomSession } from '../../src/game/sim/random/random-session.js';
import { tick, sequence, priority } from '../../src/game/sim/core/primitives.js';
import { EVENT_SPEC, type EventType } from '../../src/game/sim/events/event-spec.js';
import type { BattleModel } from '../../src/game/sim/core/battle-model.js';
import type { KernelEntity } from '../../src/game/sim/core/entity.js';
import type { KernelEventInput } from '../../src/game/sim/events/event-types.js';
import type { ScheduledEvent } from '../../src/game/sim/scheduler/scheduled-event.js';

export { tick, sequence, priority };

export function randomSession(trace = false): RandomSession {
  const streams = RngStreamMap.fromRunSeed(parseRunSeed(['00000001', '00000002', '00000003', '00000004']));
  return new RandomSession(streams, new RollSlotRegistry([]), trace);
}

export function entity(id = 'entity_alpha', overrides: Partial<KernelEntity> = {}): KernelEntity {
  return Object.freeze({
    id,
    side: 'player',
    phase: Object.freeze({ phase: 'ACTIVE', enteredTick: tick(0), controlledReturn: null }),
    maxLp: 1000,
    lp: 1000,
    shield: 0,
    lane: 'middle',
    x100: 1800,
    targetId: null,
    timers: Object.freeze({}),
    ...overrides,
  });
}

export function battle(overrides: Partial<BattleModel> = {}): BattleModel {
  const random = randomSession();
  return Object.freeze({
    schemaVersion: 1,
    simulationVersion: 'phase14-fixture-v1',
    battleId: 'battle_fixture',
    tick: tick(0),
    nextSequence: sequence(0),
    emittedEventCount: 0,
    phase: Object.freeze({ phase: 'ACTIVE', enteredTick: tick(0), resolvingEndTicks: 0 }),
    entities: Object.freeze([entity()]),
    scheduledEvents: Object.freeze([]),
    authoritativeStreams: random.streams.snapshotAuthoritative(),
    endReason: null,
    ...overrides,
  });
}

export function eventInput(type: EventType = 'BattleStarted', overrides: Partial<KernelEventInput> = {}): KernelEventInput {
  const payload = Object.fromEntries(EVENT_SPEC[type].payload.map((key, i) => [key, i + 1])) as Record<string, number>;
  return Object.freeze({
    type,
    sourceId: null,
    targetIds: Object.freeze([]),
    contentIds: Object.freeze([]),
    payload: Object.freeze(payload),
    logTags: Object.freeze(['sim.fixture']),
    ...overrides,
  });
}

export function scheduled(type: EventType = 'BattleStarted', overrides: Partial<ScheduledEvent> = {}): ScheduledEvent {
  return Object.freeze({
    scheduledTick: tick(1),
    eventPriority: priority(10),
    sourceEntityId: null,
    abilityId: null,
    eventSequence: sequence(0),
    event: eventInput(type),
    ...overrides,
  });
}
