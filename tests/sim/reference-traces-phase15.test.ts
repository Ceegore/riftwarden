import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stepBattle } from '../../src/game/sim/core/battle-kernel.js';
import { migrateEntity } from '../../src/game/sim/core/migrate.js';
import { createPhase15Systems } from '../../src/game/sim/core/phase15-systems.js';
import { createSnapshot } from '../../src/game/sim/snapshot/snapshot.js';
import type { TickInput } from '../../src/game/sim/core/tick-input.js';
import type { BattleModel } from '../../src/game/sim/core/battle-model.js';
import { battle, entity, randomSession } from './test-helpers.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixture = readFileSync(path.join(here, 'fixtures', 'reference-traces-phase15.json'), 'utf8');
const input: TickInput = Object.freeze({ paused: false, decisions: Object.freeze([]), contentVersion: 'content_fixture' });

function generateTrace(): string {
  const entities = [
    migrateEntity({ entity: entity('unit_player_a', { lane: 'top', x100: 1800 }), radiusX100: 100 }),
    migrateEntity({ entity: entity('unit_player_b', { lane: 'middle', x100: 2400 }), radiusX100: 120 }),
    migrateEntity({ entity: entity('unit_enemy_a', { side: 'enemy', lane: 'middle', x100: 6200 }), radiusX100: 140 }),
    migrateEntity({ entity: entity('unit_enemy_b', { side: 'enemy', lane: 'bottom', x100: 7600 }), radiusX100: 150 }),
  ];
  let state: BattleModel = battle({ entities, simulationVersion: 'phase15-fixture-v1' });
  const random = randomSession();
  const systems = createPhase15Systems({ speedsX100PerSecond: { unit_player_a: 305, unit_player_b: 300 } });
  const checkpoints: { tick: number; checksum: string }[] = [];
  let order: string[] = [];
  for (let i = 0; i < 60; i++) {
    const r = stepBattle({ state, input, random, rules: {}, content: {}, systems });
    state = r.state;
    if (i === 0) order = [...r.callOrder];
    if (r.checkpoint) checkpoints.push({ tick: state.tick, checksum: r.checkpoint.checksum });
  }
  const trace = { schemaVersion: 1, simulationVersion: 'phase15-fixture-v1', pipelineCallOrder: order, checkpoints, finalSnapshotChecksum: createSnapshot(state).checksum };
  return `${JSON.stringify(trace, null, 2)}\n`;
}

describe('Phase 15 golden reference trace', () => {
  it('60-tick movement trace is byte-identical to the pinned fixture', () => {
    expect(generateTrace()).toBe(fixture);
  });

  it('movement runs in stage F ahead of the noop reservation', () => {
    const parsed = JSON.parse(generateTrace()) as { pipelineCallOrder: string[] };
    expect(parsed.pipelineCallOrder).toContain('F:phase15.movement');
    expect(parsed.pipelineCallOrder).not.toContain('F:noop.movement');
  });
});
