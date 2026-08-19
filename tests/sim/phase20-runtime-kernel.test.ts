import { describe, expect, it } from 'vitest';
import { stepBattle } from '../../src/game/sim/core/battle-kernel.js';
import { createPhase20Systems } from '../../src/game/sim/core/phase20-systems.js';
import { createSnapshot } from '../../src/game/sim/snapshot/snapshot.js';
import type { EffectCommand } from '../../src/game/sim/ability/effect-command.js';
import type { KernelSystem } from '../../src/game/sim/core/tick-context.js';
import type { TickInput } from '../../src/game/sim/core/tick-input.js';
import type { BattleModel } from '../../src/game/sim/core/battle-model.js';
import type { KernelEvent } from '../../src/game/sim/events/event-types.js';
import { battle, entity, randomSession } from './test-helpers.js';

const input: TickInput = Object.freeze({ paused: false, decisions: Object.freeze([]), contentVersion: 'content_fixture' });

const unit = (id: string, overrides: Parameters<typeof entity>[1] = {}) => entity(id, { origin: 'regular', ...overrides });

function spawnEffect(summonId: string, index: number): EffectCommand {
  const effect: EffectCommand = {
    commandId: `spawn_${String(index)}_${summonId}`,
    abilityInstanceId: `inst_summon_${String(index)}`,
    abilityId: 'ability_summon',
    effectIndex: 0,
    sourceId: 'unit_p',
    targetRef: Object.freeze({ kind: 'summon_slot', entityId: null, groundKey: null, slotId: null }),
    scheduledTick: 0,
    stage: 'K',
    sourceSnapshot: Object.freeze({ sourceId: 'unit_p', sourceLane: 'middle', sourceX100: 1800, sourceLp: 1000, sourceMaxLp: 1000 }),
    sequence: index,
    kind: 'spawn_request',
    summonId,
  };
  return Object.freeze(effect);
}

function stateWith(overrides: Partial<BattleModel> = {}): BattleModel {
  return battle({
    simulationVersion: 'phase15-fixture-v1',
    entities: Object.freeze([unit('unit_p'), unit('unit_q'), unit('unit_e', { side: 'enemy', x100: 6200 })]),
    temporaryEntities: Object.freeze([]),
    ...overrides,
  });
}

const config = Object.freeze({
  unitTraits: Object.freeze({ unit_p: Object.freeze(['kingdom', 'faith']), unit_q: Object.freeze(['kingdom']), unit_e: Object.freeze(['wild']) }),
  spawnPolicies: Object.freeze({ ability_summon: 'BLOCK' }),
  spawnLifetimes: Object.freeze({ ability_summon: 5 }),
});

function runWith(state: BattleModel, systems: readonly KernelSystem[], ticks = 1): { state: BattleModel; events: KernelEvent[] } {
  let current = state;
  const events: KernelEvent[] = [];
  const random = randomSession();
  for (let i = 0; i < ticks; i++) {
    const r = stepBattle({ state: current, input, random, rules: {}, content: {}, systems });
    current = r.state;
    events.push(...r.events);
  }
  return { state: current, events };
}

describe('Phase 20 kernel: synergy commit', () => {
  it('commits the tier map once from content traits and locks it', () => {
    const systems = createPhase20Systems(config);
    const { state } = runWith(stateWith(), systems, 1);
    expect(state.synergyTiers).toEqual({ faith: 0, kingdom: 2, wild: 0 });
    // Locked: a second run does not re-derive from live (post-death) entities.
    const { state: second } = runWith(state, systems, 1);
    expect(second.synergyTiers).toEqual({ faith: 0, kingdom: 2, wild: 0 });
  });

  it('treats summons and constructs as non-contributing (origin != regular)', () => {
    const systems = createPhase20Systems(config);
    const state = stateWith({
      entities: Object.freeze([unit('unit_p'), unit('unit_s', { origin: 'summoned' }), unit('unit_c', { origin: 'construct' })]),
    });
    const { state: out } = runWith(state, systems, 1);
    // unit_s/unit_c have no traits in content anyway; the point is they are skipped as non-regular.
    expect(out.synergyTiers).toEqual({ faith: 0, kingdom: 0 });
  });
});

describe('Phase 20 kernel: summon registry commit', () => {
  it('commits a spawn_request effect into the registry and emits Spawned', () => {
    const systems = createPhase20Systems(config);
    const state = stateWith({ plannedEffects: Object.freeze([spawnEffect('summon_0', 0)]) });
    const { state: out, events } = runWith(state, systems, 1);
    expect(out.temporaryEntities?.map((e) => e.id)).toEqual(['summon_0']);
    expect(events.map((e) => e.type)).toContain('Spawned');
  });

  it('enforces cap 6: the 7th request is blocked with SummonLimitBlocked', () => {
    const systems = createPhase20Systems(config);
    const effects = Array.from({ length: 7 }, (_, i) => spawnEffect(`summon_${String(i)}`, i));
    const state = stateWith({ plannedEffects: Object.freeze(effects) });
    const { state: out, events } = runWith(state, systems, 1);
    expect(out.temporaryEntities?.length).toBe(6);
    expect(events.some((e) => e.type === 'SummonLimitBlocked')).toBe(true);
  });

  it('removes the consumed spawn_request effects from plannedEffects', () => {
    const systems = createPhase20Systems(config);
    const state = stateWith({ plannedEffects: Object.freeze([spawnEffect('summon_0', 0)]) });
    const { state: out } = runWith(state, systems, 1);
    expect(out.plannedEffects).toEqual([]);
  });
});

describe('Phase 20 kernel: expiry', () => {
  it('expires a lifetime summon at its inclusive expiry tick and emits Removed', () => {
    const systems = createPhase20Systems(config);
    const state = stateWith({ plannedEffects: Object.freeze([spawnEffect('summon_0', 0)]) });
    // spawn at tick 0 with lifetime 5 => expiresAtTick 5.
    const first = runWith(state, systems, 1);
    expect(first.state.temporaryEntities?.length).toBe(1);
    const second = runWith(first.state, systems, 5);
    expect(second.state.temporaryEntities?.length).toBe(0);
    expect(second.events.map((e) => e.type)).toContain('Removed');
  });
});

describe('Phase 20 kernel: determinism', () => {
  it('produces byte-identical snapshots for the same seed and content', () => {
    const systems = createPhase20Systems(config);
    const state = stateWith({ plannedEffects: Object.freeze([spawnEffect('summon_0', 0), spawnEffect('summon_1', 1)]) });
    const a = runWith(state, systems, 3);
    const b = runWith(state, systems, 3);
    expect(createSnapshot(a.state).checksum).toBe(createSnapshot(b.state).checksum);
  });
});
