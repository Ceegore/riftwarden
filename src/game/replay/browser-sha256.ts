import { RandomInvariantError } from '../sim/random/invariant-error.js';
import type { Sha256Port } from './replay-types.js';

export const browserSha256Hex: Sha256Port = async (bytes) => {
  const cryptoApi = globalThis.crypto as Crypto | undefined;
  if (!cryptoApi?.subtle) throw new RandomInvariantError('P13_REPLAY_FIELD', { reason: 'sha256-unavailable' });
  const digest = await cryptoApi.subtle.digest('SHA-256', bytes as unknown as BufferSource);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('');
};
