import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { RollSlotRegistry, RandomSession, RngStreamMap, parseRunSeed } from '../../src/game/sim/random/index';

const here = path.dirname(fileURLToPath(import.meta.url));
const cfg = JSON.parse(readFileSync(path.join(here, '..', '..', 'config', 'roll-slots.dev.json'), 'utf8')) as {
  slots: {
    key: string;
    owner: string;
    stream: 'map' | 'encounter' | 'rewards' | 'eventChoices' | 'combatCosmetic';
    purpose: string;
    introducedSimulationVersion: string;
    status: 'ACTIVE' | 'RESERVED' | 'DEPRECATED_BLOCKED';
  }[];
};
const seed = parseRunSeed(['00000000', '00000001', '00000002', '00000003']);

describe('roll slot registry', () => {
  it('report is stable and sorted', () => {
    const r = new RollSlotRegistry(cfg.slots);
    expect(r.report().map((x) => x.key)).toEqual([...r.report().map((x) => x.key)].sort());
  });
  it('duplicate blocks', () => {
    const slot = cfg.slots[0] ?? { key: 'fixture.uniform.primary', owner: 'test', stream: 'rewards', purpose: 'duplicate-probe', introducedSimulationVersion: 'phase13-fixture-v1', status: 'ACTIVE' as const };
    expect(() => new RollSlotRegistry([slot, slot])).toThrow('P13_SLOT_DUPLICATE');
  });
  it('dynamic malformed key blocks', () => {
    const slot = cfg.slots[0] ?? { key: 'fixture.uniform.primary', owner: 'test', stream: 'rewards', purpose: 'dynamic-probe', introducedSimulationVersion: 'phase13-fixture-v1', status: 'ACTIVE' as const };
    expect(() => new RollSlotRegistry([{ ...slot, key: `fixture.1.${String(Date.now())}` }])).toThrow('P13_SLOT_KEY_DYNAMIC');
  });
  it('unknown and wrong-stream blocks', () => {
    const r = new RollSlotRegistry(cfg.slots);
    expect(() => r.require('missing.slot.key')).toThrow('P13_SLOT_UNKNOWN');
    expect(() => r.require('fixture.uniform.primary', 'map')).toThrow('P13_SLOT_WRONG_STREAM');
  });
});

describe('random session', () => {
  it('usage index monotonic and report accurate', () => {
    const s = new RandomSession(RngStreamMap.fromRunSeed(seed), new RollSlotRegistry(cfg.slots), true);
    s.draw('fixture.uniform.primary');
    s.draw('fixture.uniform.primary');
    expect(s.trace().map((x) => x.usageIndex)).toEqual([0, 1]);
    expect(s.usageReport()).toEqual({ 'fixture.uniform.primary': 2 });
  });
});
