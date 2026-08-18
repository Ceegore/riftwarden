import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stepBattle } from '../../src/game/sim/core/battle-kernel.js';
import { migrateEntity } from '../../src/game/sim/core/migrate.js';
import { createPhase17Systems } from '../../src/game/sim/core/phase17-systems.js';
import { createSnapshot } from '../../src/game/sim/snapshot/snapshot.js';
import { asX100 } from '../../src/game/sim/geometry/x100.js';
import { tick } from '../../src/game/sim/core/primitives.js';
import type { TickInput } from '../../src/game/sim/core/tick-input.js';
import type { BattleModel } from '../../src/game/sim/core/battle-model.js';
import { battle, entity, randomSession } from './test-helpers.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixture = readFileSync(path.join(here, 'fixtures', 'reference-traces-phase17jl.json'), 'utf8');
const input: TickInput = Object.freeze({ paused: false, decisions: Object.freeze([]), contentVersion: 'content_fixture' });

function generateTrace(): string {
  const mk = (id: string, side: 'player' | 'enemy', x100: number, lane: 'top' | 'middle' | 'bottom', lp: number) =>
    migrateEntity({ entity: entity(id, { side, lane, x100, maxLp: 1000, lp }), radiusX100: 100 });
  const entities = [
    mk('unit_player_a', 'player', 1800, 'top', 1000),
    mk('unit_player_b', 'player', 2400, 'middle', 1000),
    mk('unit_enemy_a', 'enemy', 6200, 'middle', 500),
    mk('unit_enemy_b', 'enemy', 7600, 'bottom', 400),
  ];
  let state: BattleModel = battle({ entities, simulationVersion: 'phase17jl-fixture-v1', tick: tick(2680) });
  const random = randomSession();
  const systems = createPhase17Systems({
    speedsX100PerSecond: {},
    basicAttack: {
      parameters: {
        unit_player_a: {
          attackIntervalTicks: 10,
          prepareTicks: 1,
          recoveryTicks: 3,
          preferredRangeX100: asX100(9000),
          delivery: { kind: 'direct', rawAmount: 400, damageTypeOrdinal: 0, defense: 0, bossCapBps: null },
        },
      },
    },
  });
  const checkpoints: { tick: number; checksum: string }[] = [];
  let order: string[] = [];
  for (let i = 0; i < 500; i++) {
    const r = stepBattle({ state, input, random, rules: {}, content: {}, systems });
    state = r.state;
    if (i === 0) order = [...r.callOrder];
    if (r.checkpoint) checkpoints.push({ tick: state.tick, checksum: r.checkpoint.checksum });
    if (['VICTORY', 'DEFEAT', 'DRAW_ABORT'].includes(state.phase.phase)) break;
  }
  const trace = { schemaVersion: 1, simulationVersion: 'phase17jl-fixture-v1', pipelineCallOrder: order, checkpoints, finalSnapshotChecksum: createSnapshot(state).checksum };
  return `${JSON.stringify(trace, null, 2)}\n`;
}

describe('Phase 17 stage J/L golden reference trace', () => {
  it('defeat + collapse + battle-end trace is byte-identical to the pinned fixture', () => {
    expect(generateTrace()).toBe(fixture);
  });

  it('runs to a terminal outcome through stage J and stage L', () => {
    const parsed = JSON.parse(generateTrace()) as { pipelineCallOrder: string[]; checkpoints: { tick: number }[] };
    expect(parsed.pipelineCallOrder).toContain('J:phase17.j1.defeat_resolver');
    expect(parsed.pipelineCallOrder).toContain('L:phase17.l1.battle_end');
    // The trace must reach the collapse window (2700) and the terminal tick.
    expect(parsed.checkpoints.some((c) => c.tick === 2700)).toBe(true);
    expect(parsed.checkpoints.some((c) => c.tick > 3150)).toBe(true);
  });
});
