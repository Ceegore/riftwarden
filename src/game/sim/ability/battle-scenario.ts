import { KernelInvariantError } from '../core/invariant-error.js';
import type { StatusInstance } from '../status/status-instance.js';
import { LANES, type Lane } from '../geometry/x100.js';
import type { AbilityInstance } from './ability-system.js';

/**
 * Phase 19 T06 scenario builder (§10). Fluent and pure, with no hidden
 * defaults: `build()` hard-fails unless the tick, ids, positions/lanes, stats,
 * statuses, ability states, events and expected queue/eventlog outputs were
 * all explicitly provided. Empty collections must be declared explicitly
 * (`.withNoStatuses()`, `.withNoAbilityInstances()`).
 */

export interface ScenarioEntitySpec {
  readonly id: string;
  readonly side: 'player' | 'enemy';
  readonly lane: Lane;
  readonly x100: number;
  readonly maxLp: number;
  readonly lp: number;
  readonly shield: number;
  readonly origin: 'regular' | 'summoned' | 'construct';
}

export interface AbilityScenario {
  readonly abilityId: string;
  readonly tick: number;
  readonly entities: readonly ScenarioEntitySpec[];
  readonly statuses: readonly StatusInstance[];
  readonly abilityInstances: readonly AbilityInstance[];
  readonly expectedEvents: readonly string[];
  readonly expectedCommandKinds: readonly string[];
}

const ID = /^[a-z][a-z0-9_]*$/;

function assertId(value: string, code: string, field: string): void {
  if (!ID.test(value)) throw new KernelInvariantError(code, { [field]: value });
}

/** Validates an entity spec (§10: explicit ids, lane, position, stats). */
export function validateScenarioEntitySpec(spec: ScenarioEntitySpec): void {
  assertId(spec.id, 'P19_SCENARIO_INVALID', 'id');
  if (!(['player', 'enemy'] as readonly string[]).includes(spec.side)) throw new KernelInvariantError('P19_SCENARIO_INVALID', { side: spec.side });
  if (!(LANES as readonly string[]).includes(spec.lane)) throw new KernelInvariantError('P19_SCENARIO_INVALID', { lane: spec.lane });
  for (const [field, value] of [['x100', spec.x100], ['maxLp', spec.maxLp], ['lp', spec.lp], ['shield', spec.shield]] as const) {
    if (!Number.isSafeInteger(value) || value < 0 || Object.is(value, -0)) throw new KernelInvariantError('P19_SCENARIO_INVALID', { [field]: value });
  }
  if (spec.x100 > 10000) throw new KernelInvariantError('P19_SCENARIO_INVALID', { x100: spec.x100 });
  if (spec.lp > spec.maxLp) throw new KernelInvariantError('P19_SCENARIO_INVALID', { reason: 'lp-over-max', maxLp: spec.maxLp, lp: spec.lp });
  if (!['regular', 'summoned', 'construct'].includes(spec.origin)) throw new KernelInvariantError('P19_SCENARIO_INVALID', { origin: spec.origin });
}

/**
 * Fluent builder. No hidden defaults: every required field must be set
 * explicitly before `build()`, otherwise a `P19_SCENARIO_INCOMPLETE` error is
 * thrown naming the missing field.
 */
export class AbilityScenarioBuilder {
  private abilityId: string | null = null;
  private tick: number | null = null;
  private entities: ScenarioEntitySpec[] | null = null;
  private statuses: StatusInstance[] | null = null;
  private abilityInstances: AbilityInstance[] | null = null;
  private expectedEvents: string[] | null = null;
  private expectedCommandKinds: string[] | null = null;

  forAbility(abilityId: string): this {
    assertId(abilityId, 'P19_SCENARIO_INVALID', 'abilityId');
    this.abilityId = abilityId;
    return this;
  }

  atTick(tick: number): this {
    if (!Number.isSafeInteger(tick) || tick < 0 || Object.is(tick, -0)) throw new KernelInvariantError('P19_SCENARIO_INVALID', { tick });
    this.tick = tick;
    return this;
  }

  withEntities(entities: readonly ScenarioEntitySpec[]): this {
    for (const spec of entities) validateScenarioEntitySpec(spec);
    this.entities = [...entities];
    return this;
  }

  withStatuses(statuses: readonly StatusInstance[]): this {
    this.statuses = [...statuses];
    return this;
  }

  withNoStatuses(): this {
    this.statuses = [];
    return this;
  }

  withAbilityInstances(instances: readonly AbilityInstance[]): this {
    this.abilityInstances = [...instances];
    return this;
  }

  withNoAbilityInstances(): this {
    this.abilityInstances = [];
    return this;
  }

  expectEvents(events: readonly string[]): this {
    this.expectedEvents = [...events];
    return this;
  }

  expectCommandKinds(kinds: readonly string[]): this {
    this.expectedCommandKinds = [...kinds];
    return this;
  }

  build(): AbilityScenario {
    const { abilityId, tick, entities, statuses, abilityInstances, expectedEvents, expectedCommandKinds } = this;
    const missing: string[] = [];
    if (abilityId === null) missing.push('abilityId');
    if (tick === null) missing.push('tick');
    if (entities === null) missing.push('entities');
    if (statuses === null) missing.push('statuses');
    if (abilityInstances === null) missing.push('abilityInstances');
    if (expectedEvents === null) missing.push('expectedEvents');
    if (expectedCommandKinds === null) missing.push('expectedCommandKinds');
    if (missing.length > 0) throw new KernelInvariantError('P19_SCENARIO_INCOMPLETE', { missing });
    if (
      abilityId === null ||
      tick === null ||
      entities === null ||
      statuses === null ||
      abilityInstances === null ||
      expectedEvents === null ||
      expectedCommandKinds === null
    ) {
      throw new KernelInvariantError('P19_SCENARIO_INCOMPLETE', { missing });
    }
    return Object.freeze({
      abilityId,
      tick,
      entities: Object.freeze(entities),
      statuses: Object.freeze(statuses),
      abilityInstances: Object.freeze(abilityInstances),
      expectedEvents: Object.freeze(expectedEvents),
      expectedCommandKinds: Object.freeze(expectedCommandKinds),
    });
  }
}

/** Convenience: a new fluent builder. */
export function scenario(): AbilityScenarioBuilder {
  return new AbilityScenarioBuilder();
}
