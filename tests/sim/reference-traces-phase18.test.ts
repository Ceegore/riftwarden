import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stepBattle } from '../../src/game/sim/core/battle-kernel.js';
import { migrateEntity } from '../../src/game/sim/core/migrate.js';
import { createPhase18Systems } from '../../src/game/sim/core/phase18-systems.js';
import { createSnapshot } from '../../src/game/sim/snapshot/snapshot.js';
import { tick } from '../../src/game/sim/core/primitives.js';
import type { TickInput } from '../../src/game/sim/core/tick-input.js';
import type { BattleModel } from '../../src/game/sim/core/battle-model.js';
import type { StatusInstance } from '../../src/game/sim/status/status-instance.js';
import { battle, entity, randomSession } from './test-helpers.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixture = readFileSync(path.join(here, 'fixtures', 'reference-traces-phase18.json'), 'utf8');
const input: TickInput = Object.freeze({ paused: false, decisions: Object.freeze([]), contentVersion: 'content_fixture' });

function mk(id: string, side: 'player' | 'enemy', x100: number, lane: 'top' | 'middle' | 'bottom'): ReturnType<typeof migrateEntity> {
  return migrateEntity({ entity: entity(id, { side, lane, x100, maxLp: 1000, lp: 1000 }), radiusX100: 100 });
}

function st(overrides: Partial<StatusInstance>): StatusInstance {
  return Object.freeze({
    statusId: 'st_burn_a',
    kind: 'burn',
    polarity: 'negative',
    targetId: 'unit_player_a',
    sourceId: 'unit_enemy_a',
    effectId: 'ef_burn',
    startTick: 0,
    endTick: 100,
    strength: 1,
    stackGroup: 'burn',
    sequence: 1,
    stackPolicy: 'extend_duration_capped',
    maxStacks: 5,
    flags: Object.freeze([]),
    ...overrides,
  });
}

function generateTrace(): string {
  const entities = [
    mk('unit_player_a', 'player', 1800, 'top'),
    mk('unit_player_b', 'player', 2400, 'middle'),
    mk('unit_enemy_a', 'enemy', 6200, 'middle'),
    mk('unit_enemy_b', 'enemy', 7600, 'bottom'),
  ];
  let state: BattleModel = battle({
    simulationVersion: 'phase18-fixture-v1',
    tick: tick(0),
    entities,
    statuses: Object.freeze([
      st({
        statusId: 'st_burn_a',
        endTick: 100,
        periodic: Object.freeze({ effectKind: 'burn', intervalTicks: 10, nextTick: 10, tickIndex: 0, initialTick: false, dedupKey: 'burn_01' }),
      }),
      st({
        statusId: 'st_poison_a',
        kind: 'poison',
        polarity: 'negative',
        targetId: 'unit_enemy_a',
        sourceId: 'unit_player_a',
        effectId: 'ef_poison',
        stackGroup: 'poison',
        sequence: 2,
        endTick: 45,
        periodic: Object.freeze({ effectKind: 'poison', intervalTicks: 15, nextTick: 15, tickIndex: 0, initialTick: false, dedupKey: 'poison_01' }),
      }),
      st({
        statusId: 'st_regen_a',
        kind: 'regeneration',
        polarity: 'positive',
        targetId: 'unit_player_b',
        sourceId: 'unit_player_a',
        effectId: 'ef_regen',
        stackGroup: 'regen',
        sequence: 3,
        endTick: 100,
        periodic: Object.freeze({ effectKind: 'regeneration', intervalTicks: 20, nextTick: 20, tickIndex: 0, initialTick: false, dedupKey: 'regen_01' }),
      }),
    ]),
  });
  const random = randomSession();
  const systems = createPhase18Systems({
    speedsX100PerSecond: {},
    status: {
      periodic: {
        burn_01: { effectKind: 'burn', amountPerTick: 50 },
        poison_01: { effectKind: 'poison', amountPerTick: 40 },
        regen_01: { effectKind: 'regeneration', amountPerTick: 25 },
      },
    },
  });
  const checkpoints: { tick: number; checksum: string }[] = [];
  let order: string[] = [];
  for (let i = 0; i < 60; i++) {
    const r = stepBattle({ state, input, random, rules: {}, content: {}, systems });
    state = r.state;
    if (i === 0) order = [...r.callOrder];
    if (r.checkpoint) checkpoints.push({ tick: state.tick, checksum: r.checkpoint.checksum });
  }
  const trace = { schemaVersion: 1, simulationVersion: 'phase18-fixture-v1', pipelineCallOrder: order, checkpoints, finalSnapshotChecksum: createSnapshot(state).checksum };
  return `${JSON.stringify(trace, null, 2)}\n`;
}

describe('Phase 18 golden reference trace', () => {
  it('status periodic/expiry trace is byte-identical to the pinned fixture', () => {
    expect(generateTrace()).toBe(fixture);
  });

  it('runs the status system through the pipeline', () => {
    const parsed = JSON.parse(generateTrace()) as { pipelineCallOrder: string[]; checkpoints: { tick: number }[] };
    expect(parsed.pipelineCallOrder).toContain('I:phase18.i1.status');
    expect(parsed.checkpoints.map((c) => c.tick)).toEqual([30, 60]);
  });
});
