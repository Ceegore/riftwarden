import { advanceResolvingEnd, isTerminalBattlePhase } from './battle-state.js';
import type { BattleModel } from './battle-model.js';
import { StageCommandBuffer } from './command-buffer.js';
import { deepFreeze } from './deep-freeze.js';
import { KernelInvariantError } from './invariant-error.js';
import { nextSequence, nextTick, priority, type EventSequence } from './primitives.js';
import { applyStageCommands } from './state-reducer.js';
import type { TickInput } from './tick-input.js';
import type { KernelSystem, TickContext } from './tick-context.js';
import type { RandomSession } from '../random/random-session.js';
import { canonicalJson } from '../snapshot/canonical-json.js';
import { createSnapshot, shouldCheckpoint, type BattleSnapshotData } from '../snapshot/snapshot.js';
import { EventQueue } from '../scheduler/event-queue.js';
import { EventLog } from '../events/event-log.js';
import type { KernelEvent } from '../events/event-types.js';
import { PIPELINE_STAGES } from './pipeline-stage.js';

export interface KernelStepResult {
  readonly state: BattleModel;
  readonly events: readonly KernelEvent[];
  readonly checkpoint: BattleSnapshotData | null;
  readonly callOrder: readonly string[];
}

export interface StepBattleArgs {
  state: BattleModel;
  input: TickInput;
  random: RandomSession;
  rules: Readonly<Record<string, unknown>>;
  content: Readonly<Record<string, unknown>>;
  systems: readonly KernelSystem[];
}

export function stepBattle(args: StepBattleArgs): KernelStepResult {
  if (args.input.paused || isTerminalBattlePhase(args.state.phase.phase)) {
    return Object.freeze({ state: args.state, events: Object.freeze([]), checkpoint: null, callOrder: Object.freeze([]) });
  }
  if (args.state.tick >= 5400 && !isTerminalBattlePhase(args.state.phase.phase)) {
    throw new KernelInvariantError('P14_HARD_LIMIT', { tick: args.state.tick });
  }
  if (canonicalJson(args.random.streams.snapshotAuthoritative()) !== canonicalJson(args.state.authoritativeStreams)) {
    throw new KernelInvariantError('P14_SNAPSHOT_INVALID', { reason: 'rng-state-mismatch' });
  }
  const queue = new EventQueue(args.state.scheduledEvents);
  if (args.state.nextSequence <= queue.maxSequence()) {
    throw new KernelInvariantError('P14_SEQUENCE_INVALID', { nextSequence: args.state.nextSequence, maxScheduled: queue.maxSequence() });
  }
  let next = args.state.nextSequence;
  const allocate = (): EventSequence => {
    const current = next;
    next = nextSequence(next);
    return current;
  };
  const log = new EventLog();
  const callOrder: string[] = [];
  const frozenInput = deepFreeze(structuredClone(args.input));
  const frozenRules = deepFreeze(structuredClone(args.rules));
  const frozenContent = deepFreeze(structuredClone(args.content));
  let typedState: BattleModel = Object.freeze({ ...args.state, phase: advanceResolvingEnd(args.state.phase) });
  // LP at the start of this tick, persisted as the next tick's `hpBeforeTick`
  // trigger input (Phase 19 §5.2). Only ability-aware states track history.
  const startLp = Object.freeze(Object.fromEntries(typedState.entities.map((e) => [e.id, e.lp] as const)));
  for (const [stage, rawPriority] of PIPELINE_STAGES) {
    const stagePriority = priority(rawPriority);
    const dueEvents = queue.drainDueThrough(typedState.tick, stagePriority);
    const buffer = new StageCommandBuffer(stage);
    const frozen = deepFreeze(structuredClone(typedState)) as BattleModel;
    const context: TickContext = Object.freeze({ stage, state: frozen, input: frozenInput, dueEvents, random: args.random, commands: buffer, rules: frozenRules, content: frozenContent });
    const systems = args.systems.filter((s) => s.stage === stage).sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    for (const system of systems) {
      callOrder.push(`${stage}:${system.id}`);
      system.run(context);
    }
    typedState = applyStageCommands({ state: typedState, commands: buffer.drain(), atTick: typedState.tick, stagePriority, queue, log, allocate });
  }
  // Phase 19/21 trigger + objective history: tracked on ability-aware (Phase 19+)
  // AND boss-aware (Phase 21+) states only, so Phase 14–20 fixtures stay pinned.
  const tracksHistory = args.state.abilities !== undefined || args.state.bossPhase !== undefined;
  const historyExtras = tracksHistory
    ? {
        previousTickLp: startLp,
        previousTickEvents: Object.freeze(log.events().map((e) => Object.freeze({ type: e.type, sourceId: e.sourceId, targetIds: Object.freeze([...e.targetIds]) }))),
      }
    : {};
  typedState = Object.freeze({ ...typedState, tick: nextTick(typedState.tick), nextSequence: next, scheduledEvents: queue.snapshot(), authoritativeStreams: args.random.streams.snapshotAuthoritative(), ...historyExtras });
  const terminal = isTerminalBattlePhase(typedState.phase.phase);
  const checkpoint = shouldCheckpoint(typedState.tick, terminal) ? createSnapshot(typedState) : null;
  return Object.freeze({ state: typedState, events: log.events(), checkpoint, callOrder: Object.freeze(callOrder) });
}
