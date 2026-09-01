import type { RngStreamMap } from './rng-stream-map.js';
import type { RollSlotRegistry } from './roll-slot-registry.js';
import type { RngStreamKey } from './stream-keys.js';
import type { UInt32 } from './uint32.js';

export interface RollUsage { readonly slot: string; readonly stream: RngStreamKey; readonly usageIndex: number; readonly value: UInt32; }

export class RandomSession {
  readonly #usage = new Map<string, number>();
  readonly #trace: RollUsage[] = [];

  constructor(readonly streams: RngStreamMap, readonly registry: RollSlotRegistry, readonly traceEnabled = false) {}

  draw(slot: string, expectedStream?: RngStreamKey): UInt32 {
    const definition = this.registry.require(slot, expectedStream);
    const usageIndex = this.#usage.get(slot) ?? 0;
    const value = this.streams.require(definition.stream).nextUint32();
    this.#usage.set(slot, usageIndex + 1);
    if (this.traceEnabled) this.#trace.push(Object.freeze({ slot, stream: definition.stream, usageIndex, value }));
    return value;
  }

  usageReport(): Readonly<Record<string, number>> { return Object.freeze(Object.fromEntries([...this.#usage].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))); }
  trace(): readonly RollUsage[] { return Object.freeze([...this.#trace]); }
}
