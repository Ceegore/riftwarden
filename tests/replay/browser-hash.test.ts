import { describe, expect, it } from 'vitest';
import { browserSha256Hex } from '../../src/game/replay/index';
import { nodeSha256 } from '../../tools/random/node-sha256-port.mjs';

describe('browser sha256 port', () => {
  it('webcrypto and node sha256 agree in the Node runtime', async () => {
    const bytes = new TextEncoder().encode('riftwarden-phase13');
    expect(await browserSha256Hex(bytes)).toBe(await nodeSha256(bytes));
  });
});
