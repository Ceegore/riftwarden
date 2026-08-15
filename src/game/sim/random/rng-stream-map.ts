import { RandomInvariantError } from './invariant-error.js';
import { expandRunSeedV1 } from './splitmix32.js';
import { AUTHORITATIVE_STREAM_KEYS, RNG_STREAM_KEYS, isRngStreamKey, type RngStreamKey } from './stream-keys.js';
import type { RunSeed } from './run-seed.js';
import { Xoshiro128StarStar, type XoshiroState } from './xoshiro128ss.js';

export type StreamSnapshot = Readonly<Record<RngStreamKey, XoshiroState>>;
export type AuthoritativeStreamSnapshot = Readonly<Record<(typeof AUTHORITATIVE_STREAM_KEYS)[number], XoshiroState>>;

export class RngStreamMap {
  readonly #streams: Map<RngStreamKey, Xoshiro128StarStar>;

  private constructor(streams: Map<RngStreamKey, Xoshiro128StarStar>) { this.#streams = streams; }

  static fromRunSeed(seed: RunSeed): RngStreamMap {
    const current = new Xoshiro128StarStar(expandRunSeedV1(seed));
    const streams = new Map<RngStreamKey, Xoshiro128StarStar>();
    for (const key of RNG_STREAM_KEYS) { streams.set(key, current.clone()); current.jump(); }
    return new RngStreamMap(streams);
  }

  static restore(snapshot: unknown): RngStreamMap {
    if (typeof snapshot !== 'object' || snapshot === null || Array.isArray(snapshot)) throw new RandomInvariantError('P13_STREAM_STATE_INVALID');
    const record = snapshot as Record<string, unknown>;
    if (Object.keys(record).length !== RNG_STREAM_KEYS.length || Object.keys(record).some((key) => !isRngStreamKey(key))) throw new RandomInvariantError('P13_STREAM_STATE_INVALID');
    const streams = new Map<RngStreamKey, Xoshiro128StarStar>();
    for (const key of RNG_STREAM_KEYS) {
      const state = record[key];
      if (!Array.isArray(state)) throw new RandomInvariantError('P13_STREAM_STATE_INVALID');
      streams.set(key, new Xoshiro128StarStar(state as unknown as XoshiroState));
    }
    return new RngStreamMap(streams);
  }

  require(key: RngStreamKey): Xoshiro128StarStar {
    const stream = this.#streams.get(key);
    if (!stream) throw new RandomInvariantError('P13_STREAM_UNKNOWN', { key });
    return stream;
  }

  snapshotAll(): StreamSnapshot { return this.#snapshot(RNG_STREAM_KEYS); }
  snapshotAuthoritative(): AuthoritativeStreamSnapshot { return this.#snapshot(AUTHORITATIVE_STREAM_KEYS); }

  #snapshot(keys: readonly RngStreamKey[]): Readonly<Record<string, XoshiroState>> {
    return Object.freeze(Object.fromEntries(keys.map((key) => [key, this.require(key).snapshot()])));
  }
}
