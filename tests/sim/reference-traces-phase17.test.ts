import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stepBattle } from '../../src/game/sim/core/battle-kernel.js';
import { migrateEntity } from '../../src/game/sim/core/migrate.js';
import { createPhase17Systems } from '../../src/game/sim/core/phase17-systems.js';
import { createSnapshot } from '../../src/game/sim/snapshot/snapshot.js';
import { asX100 } from '../../src/game/sim/geometry/x100.js';
import type { TickInput } from '../../src/game/sim/core/tick-input.js';
import type { BattleModel } from '../../src/game/sim/core/battle-model.js';
import { battle, entity, randomSession } from './test-helpers.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixture = readFileSync(path.join(here, 'fixtures', 'reference-traces-phase17.json'), 'utf8');
const input: TickInput = Object.freeze({ paused: false, decisions: Object.freeze([]), contentVersion: 'content_fixture' });

function generateTrace(): string {
  const entities = [
    migrateEntity({ entity: entity('unit_player_a', { lane: 'top', x100: 1800 }), radiusX100: 100 }),
    migrateEntity({ entity: entity('unit_player_b', { lane: 'middle', x100: 2400 }), radiusX100: 120 }),
    migrateEntity({ entity: entity('unit_enemy_a', { side: 'enemy', lane: 'middle', x100: 6200 }), radiusX100: 140 }),
    migrateEntity({ entity: entity('unit_enemy_b', { side: 'enemy', lane: 'bottom', x100: 7600 }), radiusX100: 150 }),
  ];
  let state: BattleModel = battle({ entities, simulationVersion: 'phase17-fixture-v1' });
  const random = randomSession();
  const systems = createPhase17Systems({
    speedsX100PerSecond: { unit_player_a: 305, unit_player_b: 300 },
    attackPrep: {
      preferredRangeX100: {
        unit_player_a: asX100(5000),
        unit_player_b: asX100(4000),
      },
    },
    basicAttack: {
      parameters: {
        unit_player_a: {
          attackIntervalTicks: 40,
          prepareTicks: 1,
          recoveryTicks: 3,
          preferredRangeX100: asX100(9000),
          delivery: {
            kind: 'projectile',
            speedX100PerSecond: 3000,
            homing: false,
            maxTurnX100PerTick: 0,
            expiryTicks: 60,
            lostTargetPolicy: 'impact_stored_position',
            coverIgnoring: true,
            piercing: false,
            rawAmount: 100,
            damageTypeOrdinal: 0,
            defense: 0,
            bossCapBps: null,
          },
        },
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
  const trace = { schemaVersion: 1, simulationVersion: 'phase17-fixture-v1', pipelineCallOrder: order, checkpoints, finalSnapshotChecksum: createSnapshot(state).checksum };
  return `${JSON.stringify(trace, null, 2)}\n`;
}

describe('Phase 17 golden reference trace', () => {
  it('60-tick basic-attack/projectile/damage trace is byte-identical to the pinned fixture', () => {
    expect(generateTrace()).toBe(fixture);
  });

  it('runs the Phase 17 G/H/I systems in the pipeline', () => {
    const parsed = JSON.parse(generateTrace()) as { pipelineCallOrder: string[] };
    expect(parsed.pipelineCallOrder).toContain('G:phase17.g1.basic_attack');
    expect(parsed.pipelineCallOrder).toContain('H:phase17.h1.projectile');
    expect(parsed.pipelineCallOrder).toContain('I:phase17.i1.combat_application');
    expect(parsed.pipelineCallOrder).not.toContain('noop.resolve_committed');
    expect(parsed.pipelineCallOrder).not.toContain('noop.apply_effects');
  });
});
