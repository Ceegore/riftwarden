import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stepBattle } from '../../src/game/sim/core/battle-kernel.js';
import { createNoopSystems } from '../../src/game/sim/core/noop-systems.js';
import { createSnapshot } from '../../src/game/sim/snapshot/snapshot.js';
import { EVENT_SPEC } from '../../src/game/sim/events/event-spec.js';
import type { TickInput } from '../../src/game/sim/core/tick-input.js';
import type { BattleModel } from '../../src/game/sim/core/battle-model.js';
import { battle, randomSession } from './test-helpers.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const fixture = readFileSync(path.join(here, 'fixtures', 'reference-traces.json'), 'utf8');

const input: TickInput = Object.freeze({ paused: false, decisions: Object.freeze([]), contentVersion: 'content_fixture' });

interface Checkpoint { tick: number; checksum: string }

function generateTrace(): string {
  let state: BattleModel = battle();
  const random = randomSession();
  const checkpoints: Checkpoint[] = [];
  let order: string[] = [];
  for (let i = 0; i < 60; i++) {
    const r = stepBattle({ state, input, random, rules: {}, content: {}, systems: createNoopSystems() });
    state = r.state;
    if (i === 0) order = [...r.callOrder];
    if (r.checkpoint) checkpoints.push({ tick: state.tick, checksum: r.checkpoint.checksum });
  }
  const trace = { schemaVersion: 1, pipelineCallOrder: order, eventTypes: Object.keys(EVENT_SPEC).sort(), checkpoints, finalSnapshotChecksum: createSnapshot(state).checksum };
  return `${JSON.stringify(trace, null, 2)}\n`;
}

describe('golden reference trace', () => {
  it('60-tick deterministic trace is byte-identical to the pinned fixture', () => {
    expect(generateTrace()).toBe(fixture);
  });

  it('checkpoints fall on ticks 30 and 60 only', () => {
    const parsed = JSON.parse(generateTrace()) as { checkpoints: Checkpoint[] };
    expect(parsed.checkpoints.map((c) => c.tick)).toEqual([30, 60]);
  });
});
