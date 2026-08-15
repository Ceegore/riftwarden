import { describe, expect, it } from "vitest";
import { ContentIndex } from "../../src/game/content/runtime/content-index";
import type { ContentManifest } from "../../src/game/content/types/content";

function makeManifest(): ContentManifest {
  return {
    schemaVersion: 1,
    contentVersion: "a".repeat(64),
    simulationVersion: 9001,
    localeVersions: { de: "v1", en: "v1" },
    counts: { unit: 2 },
    files: [{ path: "unit.json", sha256: "b".repeat(64), byteLength: 0, entityType: "unit" }],
  };
}

describe("ContentIndex", () => {
  it("requires an entity by type and id", () => {
    const index = new ContentIndex(makeManifest(), new Map([["unit", new Map([["hero_x", { id: "hero_x" }]])]]));
    expect(index.require("unit", "hero_x")).toEqual({ id: "hero_x" });
  });

  it("throws on missing entity", () => {
    const index = new ContentIndex(makeManifest(), new Map());
    expect(() => index.require("unit", "hero_x")).toThrow(/P09_REF_MISSING/);
  });

  it("deep-freezes entities", () => {
    const entity = { id: "hero_x", stats: { hp: 1 } };
    const index = new ContentIndex(makeManifest(), new Map([["unit", new Map([["hero_x", entity]])]]));
    const loaded = index.require<{ id: string; stats: { hp: number } }>("unit", "hero_x");
    expect(Object.isFrozen(loaded)).toBe(true);
    expect(Object.isFrozen(loaded.stats)).toBe(true);
  });

  it("freezes the byType maps against mutation", () => {
    const index = new ContentIndex(makeManifest(), new Map([["unit", new Map([["hero_x", { id: "hero_x" }]])]]));
    expect(() => (index.byType as Map<string, unknown>).set("x", new Map())).toThrow(/P09_IMMUTABLE_BUNDLE/);
    expect(() => (index.byType.get("unit") as Map<string, unknown>).set("y", {})).toThrow(/P09_IMMUTABLE_BUNDLE/);
  });

  it("keeps stable iteration order by id", () => {
    const index = new ContentIndex(makeManifest(), new Map([["unit", new Map([["hero_b", {}], ["hero_a", {}]])]]));
    const unitMap = index.byType.get("unit");
    expect(unitMap ? [...unitMap.keys()] : []).toEqual(["hero_a", "hero_b"]);
  });
});
