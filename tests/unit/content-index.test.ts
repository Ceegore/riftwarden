import { describe, expect, it } from "vitest";
import { ContentIndex } from "../../src/game/content/runtime/content-index";
import { publishVerifiedContent } from "../../src/game/content/runtime/load-content";
import { CONTENT_RECOVERY_MESSAGE_KEY, type ContentRecoveryPort } from "../../src/game/content/runtime/recovery-port";
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

  it("exposes typed unit getter", () => {
    const entity = { id: "hero_x", category: "hero" };
    const index = new ContentIndex(makeManifest(), new Map([["unit", new Map([["hero_x", entity]])]]));
    expect(index.unit("hero_x").category).toBe("hero");
    expect(() => index.unit("hero_missing")).toThrow(/P09_REF_MISSING/);
  });

  it("exposes content/simulation/locale versions", () => {
    const index = new ContentIndex(makeManifest(), new Map());
    expect(index.contentVersion).toBe("a".repeat(64));
    expect(index.simulationVersion).toBe(9001);
    expect(index.localeVersions).toEqual({ de: "v1", en: "v1" });
  });

  it("exposes read-only pool/compatibility/codex indices", () => {
    const indexEntity = {
      id: "content-index",
      pools: { encounter: { mission_1: ["encounter_a"] } },
      compatibility: { item: { item_blade: ["hero_x"] } },
      codex: { unit: { hero_x: "screen_codex" } },
    };
    const index = new ContentIndex(
      makeManifest(),
      new Map([["index", new Map([["content-index", indexEntity]])]]),
    );
    expect(index.pools.get("encounter")?.get("mission_1")).toEqual(["encounter_a"]);
    expect(index.compatibility.get("item")?.get("item_blade")).toEqual(["hero_x"]);
    expect(index.codex.get("unit")?.get("hero_x")).toBe("screen_codex");
    expect(Object.isFrozen(index.pools.get("encounter")?.get("mission_1"))).toBe(true);
    expect(() => (index.pools as Map<string, unknown>).set("x", new Map())).toThrow(/P09_IMMUTABLE_BUNDLE/);
  });

  it("keeps indices read-only against nested mutation", () => {
    const indexEntity = {
      id: "content-index",
      pools: { encounter: { mission_1: ["encounter_a"] } },
      compatibility: { item: { item_blade: ["hero_x"] } },
      codex: { unit: { hero_x: "screen_codex" } },
    };
    const index = new ContentIndex(
      makeManifest(),
      new Map([["index", new Map([["content-index", indexEntity]])]]),
    );
    const members = index.pools.get("encounter")?.get("mission_1");
    expect(members).toBeDefined();
    expect(Object.isFrozen(members)).toBe(true);
    expect(() => (members as string[]).push("x")).toThrow();
  });
});

describe("publishVerifiedContent recovery (§10.2/§10.3)", () => {
  function recoverySpy() {
    const calls: unknown[] = [];
    const port: ContentRecoveryPort = {
      enterContentRecovery(failure) {
        calls.push(failure);
      },
    };
    return { port, calls };
  }

  it("publishes a valid bundle and never enters recovery", async () => {
    const { port, calls } = recoverySpy();
    const manifest = makeManifest();
    const result = await publishVerifiedContent(
      () => Promise.resolve({ manifest, entitiesByType: new Map([["unit", new Map([["hero_x", { id: "hero_x" }]])]]) }),
      port,
    );
    expect(result).toBeInstanceOf(ContentIndex);
    expect(result?.unit("hero_x").id).toBe("hero_x");
    expect(calls).toHaveLength(0);
  });

  it("enters recovery exactly once and never publishes on failure", async () => {
    const { port, calls } = recoverySpy();
    let verifyCalls = 0;
    const result = await publishVerifiedContent(
      () => {
        verifyCalls += 1;
        return Promise.reject(new Error("P09_MANIFEST_HASH: tampered"));
      },
      port,
    );
    expect(result).toBeNull();
    expect(verifyCalls).toBe(1);
    expect(calls).toHaveLength(1);
    const failure = calls[0] as { code: string; messageKey: string; diagnostics: { code: string }[] };
    expect(failure.code).toBe("P09_PARTIAL_BUNDLE");
    expect(failure.messageKey).toBe(CONTENT_RECOVERY_MESSAGE_KEY);
    expect(failure.diagnostics).toEqual([{ code: "P09_MANIFEST_HASH: tampered" }]);
  });
});
