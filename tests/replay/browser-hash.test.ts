import { describe, expect, it } from 'vitest';
import { browserSha256Hex } from '../../src/game/replay/index';
import { nodeSha256 } from '../../tools/random/node-sha256-port.mjs';

describe('browser sha256 port', () => {
  it('webcrypto and node sha256 agree in the Node runtime', async () => {
    const bytes = new TextEncoder().encode('riftwarden-phase13');
    expect(await browserSha256Hex(bytes)).toBe(await nodeSha256(bytes));
  });

  it('matches the NIST SHA-256 known test vector (abc)', async () => {
    const bytes = new TextEncoder().encode('abc');
    expect(await browserSha256Hex(bytes)).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });

  it('matches the NIST SHA-256 known test vector (empty input)', async () => {
    expect(await browserSha256Hex(new Uint8Array())).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    );
  });
});
