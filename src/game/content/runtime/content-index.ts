import type { ContentManifest } from "../types/content";

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  }
  return value;
}

function freezeMap<K, V>(map: Map<K, V>): ReadonlyMap<K, V> {
  const blocked = (): never => {
    throw new Error("P09_IMMUTABLE_BUNDLE");
  };
  map.set = blocked;
  map.delete = blocked;
  map.clear = blocked;
  return Object.freeze(map);
}

export class ContentIndex {
  readonly manifest: Readonly<ContentManifest>;
  readonly byType: ReadonlyMap<string, ReadonlyMap<string, Readonly<unknown>>>;

  constructor(manifest: ContentManifest, source: Map<string, Map<string, unknown>>) {
    this.manifest = deepFreeze(structuredClone(manifest));
    const outer = new Map<string, ReadonlyMap<string, Readonly<unknown>>>();
    for (const [type, entities] of [...source.entries()].sort(([a], [b]) => a.localeCompare(b, "en"))) {
      const stable = new Map<string, Readonly<unknown>>();
      for (const [id, entity] of [...entities.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
        stable.set(id, deepFreeze(structuredClone(entity)) as Readonly<unknown>);
      }
      outer.set(type, freezeMap(stable));
    }
    this.byType = freezeMap(outer);
    Object.freeze(this);
  }

  require<T>(type: string, id: string): Readonly<T> {
    const entity = this.byType.get(type)?.get(id);
    if (!entity) throw new Error(`P09_REF_MISSING:${type}:${id}`);
    return entity as Readonly<T>;
  }
}
