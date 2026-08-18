import { RandomInvariantError } from './invariant-error.js';
import type { RngStreamKey } from './stream-keys.js';

export type RollSlotStatus = 'ACTIVE' | 'RESERVED' | 'DEPRECATED_BLOCKED';
export interface RollSlotDefinition { readonly key: string; readonly owner: string; readonly stream: RngStreamKey; readonly purpose: string; readonly introducedSimulationVersion: string; readonly status: RollSlotStatus; }
const KEY_PATTERN = /^[a-z][a-z0-9]*(?:\.[a-z][A-Za-z0-9]*){2,}$/;

export class RollSlotRegistry {
  readonly #byKey: ReadonlyMap<string, RollSlotDefinition>;

  constructor(definitions: readonly RollSlotDefinition[]) {
    const map = new Map<string, RollSlotDefinition>();
    for (const definition of definitions) {
      if (!KEY_PATTERN.test(definition.key)) throw new RandomInvariantError('P13_SLOT_KEY_DYNAMIC', { key: definition.key });
      if (map.has(definition.key)) throw new RandomInvariantError('P13_SLOT_DUPLICATE', { key: definition.key });
      map.set(definition.key, Object.freeze({ ...definition }));
    }
    this.#byKey = map;
  }

  require(key: string, expectedStream?: RngStreamKey): RollSlotDefinition {
    const definition = this.#byKey.get(key);
    if (definition?.status !== 'ACTIVE') throw new RandomInvariantError('P13_SLOT_UNKNOWN', { key });
    if (expectedStream !== undefined && definition.stream !== expectedStream) throw new RandomInvariantError('P13_SLOT_WRONG_STREAM', { key, expectedStream, actualStream: definition.stream });
    return definition;
  }

  report(): readonly RollSlotDefinition[] { return Object.freeze([...this.#byKey.values()].sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))); }
}
