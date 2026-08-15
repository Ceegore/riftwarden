import { describe, expect, it } from 'vitest';
import { canonicalJson, encodeReplay, decodeReplay, type JsonValue } from '../../src/game/replay/index';
import { parseRunSeed } from '../../src/game/sim/random/index';
import { nodeSha256 } from '../../tools/random/node-sha256-port.mjs';

const base = {
  schemaVersion: 1 as const,
  contentVersion: 'b'.repeat(64),
  simulationVersion: 'phase13-fixture-v1',
  runSeed: parseRunSeed(['11111111', '22222222', '33333333', '44444444']),
  startSnapshot: { tick: 0 },
  decisions: [
    { tick: 1, sequence: 0, type: 'choice.first', payload: {} },
    { tick: 1, sequence: 1, type: 'choice.second', payload: {} }
  ] as const
};
const policy = { supportedSimulationVersions: new Set(['phase13-fixture-v1']) };
async function file(): Promise<Record<string, unknown>> {
  return JSON.parse(await encodeReplay({ authoritative: base }, nodeSha256)) as Record<string, unknown>;
}

describe('replay negatives', () => {
  it('older schema visible unsupported', async () => {
    const f = (await file()) as { authoritative: { schemaVersion: number } };
    f.authoritative.schemaVersion = 0;
    await expect(decodeReplay(canonicalJson(f), nodeSha256, policy)).rejects.toThrow('P13_REPLAY_SCHEMA_UNSUPPORTED');
  });
  it('newer schema visible unsupported', async () => {
    const f = (await file()) as { authoritative: { schemaVersion: number } };
    f.authoritative.schemaVersion = 2;
    await expect(decodeReplay(canonicalJson(f), nodeSha256, policy)).rejects.toThrow('P13_REPLAY_SCHEMA_UNSUPPORTED');
  });
  it('decision tick order blocks', async () => {
    await expect(
      encodeReplay({ authoritative: { ...base, decisions: [base.decisions[1], { ...base.decisions[0], tick: 0 }] } }, nodeSha256),
    ).rejects.toThrow('P13_REPLAY_FIELD');
  });
  it('decision sequence duplicate blocks', async () => {
    await expect(
      encodeReplay({ authoritative: { ...base, decisions: [base.decisions[0], { ...base.decisions[1], sequence: 0 }] } }, nodeSha256),
    ).rejects.toThrow('P13_REPLAY_FIELD');
  });
  it('speed event order blocks', async () => {
    await expect(
      encodeReplay({ authoritative: base, display: { speedEvents: [{ tick: 9, speedMilli: 1000 }, { tick: 8, speedMilli: 2000 }] } }, nodeSha256),
    ).rejects.toThrow('P13_REPLAY_FIELD');
  });
  it('duplicate keys become noncanonical', async () => {
    const raw = await encodeReplay({ authoritative: base }, nodeSha256);
    const duplicate = raw.replace('"integrity":{', `"integrity":{"algorithm":"sha256","authoritativeHash":"${'0'.repeat(64)}"},"integrity":{`);
    await expect(decodeReplay(duplicate, nodeSha256, policy)).rejects.toThrow(/P13_REPLAY_NONCANONICAL|P13_REPLAY_TAMPERED/);
  });
  it('wrong hash algorithm blocks', async () => {
    const f = (await file()) as { integrity: { algorithm: string } };
    f.integrity.algorithm = 'sha1';
    await expect(decodeReplay(canonicalJson(f), nodeSha256, policy)).rejects.toThrow('P13_REPLAY_FIELD');
  });
  it('invalid content hash blocks', async () => {
    const f = (await file()) as { authoritative: { contentVersion: string } };
    f.authoritative.contentVersion = 'ABC';
    await expect(decodeReplay(canonicalJson(f), nodeSha256, policy)).rejects.toThrow('P13_REPLAY_FIELD');
  });
  it('cycle blocks encode', () => {
    const x: { self?: unknown } = {};
    x.self = x;
    expect(() => canonicalJson(x as unknown as JsonValue)).toThrow('P13_CANONICAL_JSON');
  });
  it('non-plain object blocks encode', () => {
    expect(() => canonicalJson({ x: new Date(0) } as unknown as JsonValue)).toThrow('P13_CANONICAL_JSON');
  });
});
