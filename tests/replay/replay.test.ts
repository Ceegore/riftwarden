import { describe, expect, it } from 'vitest';
import { canonicalJson, encodeReplay, decodeReplay, type JsonValue } from '../../src/game/replay/index';
import { parseRunSeed } from '../../src/game/sim/random/index';
import { nodeSha256 } from '../../tools/random/node-sha256-port.mjs';

const authoritative = {
  schemaVersion: 1 as const,
  contentVersion: 'a'.repeat(64),
  simulationVersion: 'phase13-fixture-v1',
  runSeed: parseRunSeed(['00000000', '00000001', '00000002', '00000003']),
  startSnapshot: { tick: 0, entities: [] },
  decisions: [{ tick: 5, sequence: 0, type: 'battle.speed.selected', payload: { speedMilli: 2000 } }]
};
const policy = { supportedSimulationVersions: new Set(['phase13-fixture-v1']) };

describe('canonical JSON', () => {
  it('orders object keys', () => {
    expect(canonicalJson({ z: 1, a: { y: 2, x: 3 } })).toBe('{"a":{"x":3,"y":2},"z":1}');
  });
  it('float and negative zero block', () => {
    expect(() => canonicalJson({ x: 1.5 })).toThrow('P13_CANONICAL_JSON');
    expect(() => canonicalJson({ x: -0 })).toThrow('P13_CANONICAL_JSON');
  });
});

describe('replay codec', () => {
  it('roundtrip canonical replay', async () => {
    const raw = await encodeReplay({ authoritative, display: { speedEvents: [{ tick: 5, speedMilli: 2000 }] } }, nodeSha256);
    expect(canonicalJson(JSON.parse(raw) as JsonValue)).toBe(raw);
    expect(await decodeReplay(raw, nodeSha256, policy)).toEqual(JSON.parse(raw) as JsonValue);
  });
  it('display and debug excluded from the authoritative hash', async () => {
    const a = JSON.parse(await encodeReplay({ authoritative }, nodeSha256)) as { integrity: { authoritativeHash: string } };
    const b = JSON.parse(
      await encodeReplay({ authoritative, display: { speedEvents: [{ tick: 9, speedMilli: 3000 }] }, debug: { eventLog: [{ type: 'x' }] } }, nodeSha256),
    ) as { integrity: { authoritativeHash: string } };
    expect(a.integrity.authoritativeHash).toBe(b.integrity.authoritativeHash);
  });
  it('tamper blocks', async () => {
    const file = JSON.parse(await encodeReplay({ authoritative }, nodeSha256)) as { authoritative: { decisions: { tick: number }[] } };
    const first = file.authoritative.decisions[0] ?? { tick: 0 };
    first.tick = 6;
    await expect(decodeReplay(canonicalJson(file as JsonValue), nodeSha256, policy)).rejects.toThrow('P13_REPLAY_TAMPERED');
  });
  it('noncanonical bytes block', async () => {
    const raw = await encodeReplay({ authoritative }, nodeSha256);
    await expect(decodeReplay(raw + '\n', nodeSha256, policy)).rejects.toThrow('P13_REPLAY_NONCANONICAL');
  });
  it('unknown simulation version blocks', async () => {
    const raw = await encodeReplay({ authoritative: { ...authoritative, simulationVersion: 'future-v9' } }, nodeSha256);
    await expect(decodeReplay(raw, nodeSha256, policy)).rejects.toThrow('P13_REPLAY_SIMULATION_UNSUPPORTED');
  });
  it('unknown field blocks', async () => {
    const f = JSON.parse(await encodeReplay({ authoritative }, nodeSha256)) as Record<string, unknown>;
    f['extra'] = true;
    await expect(decodeReplay(canonicalJson(f as JsonValue), nodeSha256, policy)).rejects.toThrow('P13_REPLAY_FIELD');
  });
});
