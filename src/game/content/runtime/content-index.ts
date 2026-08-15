import type { ContentManifest, UnitDefinition } from "../types/content";

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

export interface ContentIndexSnapshot {
  pools: Record<string, Record<string, string[]>>;
  compatibility: Record<string, Record<string, string[]>>;
  codex: Record<string, Record<string, string>>;
}

/**
 * Immutable, fully-verified content index (§10.1). Exposes require(), typed
 * convenience getters, content/simulation/locale versions and read-only
 * pool/compatibility indices. No set, no raw mutable map, no displayName lookup.
 */
export class ContentIndex {
  readonly manifest: Readonly<ContentManifest>;
  readonly byType: ReadonlyMap<string, ReadonlyMap<string, Readonly<unknown>>>;
  readonly pools: ReadonlyMap<string, ReadonlyMap<string, readonly string[]>>;
  readonly compatibility: ReadonlyMap<string, ReadonlyMap<string, readonly string[]>>;
  readonly codex: ReadonlyMap<string, ReadonlyMap<string, string>>;

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
    const snapshot = (this.byType.get("index")?.get("content-index") ?? {}) as Partial<ContentIndexSnapshot>;
    this.pools = freezeMap(toMapOfMaps(snapshot.pools));
    this.compatibility = freezeMap(toMapOfMaps(snapshot.compatibility));
    this.codex = freezeMap(toMapOfStrings(snapshot.codex));
    Object.freeze(this);
  }

  require<T>(type: string, id: string): Readonly<T> {
    const entity = this.byType.get(type)?.get(id);
    if (!entity) throw new Error(`P09_REF_MISSING:${type}:${id}`);
    return entity as Readonly<T>;
  }

  // Typed convenience getters (§10.1).
  unit(id: string): Readonly<UnitDefinition> {
    return this.require<UnitDefinition>("unit", id);
  }
  ability(id: string): Readonly<unknown> {
    return this.require("ability", id);
  }
  status(id: string): Readonly<unknown> {
    return this.require("status", id);
  }
  targetProfile(id: string): Readonly<unknown> {
    return this.require("targetProfile", id);
  }
  encounter(id: string): Readonly<unknown> {
    return this.require("encounter", id);
  }
  mission(id: string): Readonly<unknown> {
    return this.require("mission", id);
  }
  event(id: string): Readonly<unknown> {
    return this.require("event", id);
  }
  rewardTable(id: string): Readonly<unknown> {
    return this.require("rewardTable", id);
  }
  item(id: string): Readonly<unknown> {
    return this.require("item", id);
  }
  relic(id: string): Readonly<unknown> {
    return this.require("relic", id);
  }
  screen(id: string): Readonly<unknown> {
    return this.require("screen", id);
  }
  visual(id: string): Readonly<unknown> {
    return this.require("visual", id);
  }
  audio(id: string): Readonly<unknown> {
    return this.require("audio", id);
  }

  // Versions (§10.1).
  get contentVersion(): string {
    return this.manifest.contentVersion;
  }
  get simulationVersion(): number {
    return this.manifest.simulationVersion;
  }
  get localeVersions(): Readonly<Record<"de" | "en", string>> {
    return this.manifest.localeVersions;
  }
}

function toMapOfMaps(record: Record<string, Record<string, string[]>> | undefined): Map<string, ReadonlyMap<string, readonly string[]>> {
  const map = new Map<string, ReadonlyMap<string, readonly string[]>>();
  for (const [outerKey, inner] of Object.entries(record ?? {})) {
    const innerMap = new Map<string, readonly string[]>();
    for (const [innerKey, ids] of Object.entries(inner)) innerMap.set(innerKey, Object.freeze([...ids]));
    map.set(outerKey, freezeMap(innerMap));
  }
  return map;
}

function toMapOfStrings(record: Record<string, Record<string, string>> | undefined): Map<string, ReadonlyMap<string, string>> {
  const map = new Map<string, ReadonlyMap<string, string>>();
  for (const [outerKey, inner] of Object.entries(record ?? {})) {
    const innerMap = new Map<string, string>();
    for (const [innerKey, value] of Object.entries(inner)) innerMap.set(innerKey, value);
    map.set(outerKey, freezeMap(innerMap));
  }
  return map;
}
