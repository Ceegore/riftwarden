import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { ZodType } from "zod";
import {
  AbilitySourceSchema,
  AudioRequirementSourceSchema,
  EncounterSourceSchema,
  EventSourceSchema,
  ItemSourceSchema,
  MissionSourceSchema,
  RelicSourceSchema,
  RewardTableSourceSchema,
  ScreenReferenceSourceSchema,
  StatusSourceSchema,
  TargetProfileSourceSchema,
  UnitSourceSchema,
  VisualRequirementSourceSchema,
} from "../../content/schemas/index";

// The compiler validates with hand-kept .mjs mirrors of the .ts schemas. This
// suite asserts both implementations agree on every probe so drift (a field,
// range or enum present in one but not the other) fails loudly instead of
// silently accepting/rejecting different content.
// (Typings for the .mjs mirror live in tests/unit/schema-parity.d.ts.)
import { ENTITY_SCHEMAS } from "../../tools/content/lib/entity-schemas.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const sourceRoot = path.resolve(here, "../../content/source");

const TS_SCHEMAS: Record<string, ZodType> = {
  unit: UnitSourceSchema,
  ability: AbilitySourceSchema,
  status: StatusSourceSchema,
  targetProfile: TargetProfileSourceSchema,
  encounter: EncounterSourceSchema,
  mission: MissionSourceSchema,
  event: EventSourceSchema,
  rewardTable: RewardTableSourceSchema,
  item: ItemSourceSchema,
  relic: RelicSourceSchema,
  screen: ScreenReferenceSourceSchema,
  visual: VisualRequirementSourceSchema,
  audio: AudioRequirementSourceSchema,
};

const FIXTURE_FILES: Record<string, string> = {
  unit: "units/units.json",
  ability: "abilities/abilities.json",
  status: "statuses/statuses.json",
  targetProfile: "targets/targets.json",
  encounter: "world/encounters.json",
  mission: "world/missions.json",
  event: "world/events.json",
  rewardTable: "progression/rewards.json",
  item: "progression/items.json",
  relic: "progression/relics.json",
  screen: "presentation/screens.json",
  visual: "presentation/visuals.json",
  audio: "presentation/audio.json",
};

interface Probe {
  label: string;
  op: "set" | "del";
  path: string;
  value?: unknown;
}

type Entity = Record<string, unknown>;

function applyProbe(entity: Entity, probe: Probe): Entity {
  const result = structuredClone(entity);
  const segments = probe.path.split(".");
  const last = segments.pop();
  if (last === undefined) throw new Error(`bad probe path ${probe.path}`);
  let current: Record<string, unknown> = result;
  for (const segment of segments) {
    const next = current[segment];
    if (next === null || typeof next !== "object") throw new Error(`bad probe path ${probe.path}`);
    current = next as Record<string, unknown>;
  }
  if (probe.op === "set") current[last] = probe.value;
  else Reflect.deleteProperty(current, last);
  return result;
}

function accepts(schema: { safeParse(value: unknown): { success: boolean } }, value: unknown): boolean {
  return schema.safeParse(value).success;
}

interface Battery {
  type: string;
  probes: Probe[];
}

const BATTERIES: Battery[] = [
  {
    type: "unit",
    probes: [
      { label: "unknown field", op: "set", path: "bogusField", value: 1 },
      { label: "missing displayNameKey", op: "del", path: "displayNameKey" },
      { label: "category enum violation", op: "set", path: "category", value: "not_a_category" },
      { label: "baseStats.maxHp wrong type", op: "set", path: "baseStats.maxHp", value: "banana" },
      { label: "baseStats.maxHp negative", op: "set", path: "baseStats.maxHp", value: -1 },
      { label: "baseStats.controlResistanceBps overflow", op: "set", path: "baseStats.controlResistanceBps", value: 50001 },
      { label: "baseStats.rangeX100 negative", op: "set", path: "baseStats.rangeX100", value: -5 },
      { label: "baseStats.attackIntervalSeconds wrong type", op: "set", path: "baseStats.attackIntervalSeconds", value: "1" },
      { label: "empty roleTags", op: "set", path: "roleTags", value: [] },
      { label: "too many traitIds", op: "set", path: "traitIds", value: ["a", "b", "c"] },
      { label: "bad id format", op: "set", path: "id", value: "UPPER_CASE" },
      { label: "displayNameKey regex violation", op: "set", path: "displayNameKey", value: "foo.bar" },
      { label: "replacementId null allowed", op: "set", path: "replacementId", value: null },
      { label: "replacementId wrong type", op: "set", path: "replacementId", value: 7 },
    ],
  },
  {
    type: "ability",
    probes: [
      { label: "unknown field", op: "set", path: "bogusField", value: 1 },
      { label: "missing triggerType", op: "del", path: "triggerType" },
      { label: "kind enum violation", op: "set", path: "kind", value: "ultra" },
      { label: "chargeSeconds negative", op: "set", path: "chargeSeconds", value: -1 },
      { label: "usesPerBattle zero", op: "set", path: "usesPerBattle", value: 0 },
      { label: "empty effects", op: "set", path: "effects", value: [] },
      { label: "effects[0].magnitude wrong type", op: "set", path: "effects.0.magnitude", value: "x" },
      { label: "effects[0].type enum violation", op: "set", path: "effects.0.type", value: "nuke" },
      { label: "castSeconds wrong type", op: "set", path: "castSeconds", value: "0.2" },
      { label: "logTags entry bad format", op: "set", path: "logTags", value: ["Bad Tag"] },
      { label: "effects[0].damageType null allowed", op: "set", path: "effects.0.damageType", value: null },
      { label: "bad id format", op: "set", path: "id", value: "9bad" },
    ],
  },
  {
    type: "status",
    probes: [
      { label: "unknown field", op: "set", path: "bogusField", value: 1 },
      { label: "kind enum violation", op: "set", path: "kind", value: "freeze" },
      { label: "maxStacks zero", op: "set", path: "maxStacks", value: 0 },
      { label: "durationCapSeconds negative", op: "set", path: "durationCapSeconds", value: -1 },
      { label: "statModifier missing operation", op: "set", path: "statModifiers", value: [{ stat: "attack_up", value: 100 }] },
      { label: "statModifier with operation add", op: "set", path: "statModifiers", value: [{ stat: "attack_up", operation: "add", value: 100 }] },
      { label: "statModifier with operation multiply_bps", op: "set", path: "statModifiers", value: [{ stat: "attack_up", operation: "multiply_bps", value: 500 }] },
      { label: "statModifier unknown operation", op: "set", path: "statModifiers", value: [{ stat: "attack_up", operation: "subtract", value: 1 }] },
      { label: "periodicEffects interval negative", op: "set", path: "periodicEffects", value: [{ intervalSeconds: -1, effectAbilityId: "a_b" }] },
      { label: "periodicEffects missing effectAbilityId", op: "set", path: "periodicEffects", value: [{ intervalSeconds: 1 }] },
      { label: "bad id format", op: "set", path: "id", value: "Status!" },
    ],
  },
  {
    type: "targetProfile",
    probes: [
      { label: "unknown field", op: "set", path: "bogusField", value: 1 },
      { label: "targetKind enum violation", op: "set", path: "targetKind", value: "enemy" },
      { label: "lanePolicy enum violation", op: "set", path: "lanePolicy", value: "none" },
      { label: "selection enum violation", op: "set", path: "selection", value: "random" },
      { label: "maxRangeX100 negative", op: "set", path: "maxRangeX100", value: -1 },
      { label: "missing id", op: "del", path: "id" },
    ],
  },
  {
    type: "encounter",
    probes: [
      { label: "unknown field", op: "set", path: "bogusField", value: 1 },
      { label: "kind enum violation", op: "set", path: "kind", value: "ambush" },
      { label: "empty enemySlots", op: "set", path: "enemySlots", value: [] },
      { label: "enemySlots[0].lane enum violation", op: "set", path: "enemySlots.0.lane", value: "side" },
      { label: "enemySlots[0].eliteId null allowed", op: "set", path: "enemySlots.0.eliteId", value: null },
      { label: "reinforcementWaves[0].atSeconds negative", op: "set", path: "reinforcementWaves", value: [{ atSeconds: -1, encounterId: "enc_1" }] },
      { label: "objective enum violation", op: "set", path: "objective", value: "win" },
      { label: "empty allowedModes", op: "set", path: "allowedModes", value: [] },
      { label: "allowedModes entry violation", op: "set", path: "allowedModes", value: ["hardcore"] },
    ],
  },
  {
    type: "mission",
    probes: [
      { label: "unknown field", op: "set", path: "bogusField", value: 1 },
      { label: "act below range", op: "set", path: "act", value: 0 },
      { label: "act above range", op: "set", path: "act", value: 5 },
      { label: "sequence below range", op: "set", path: "sequence", value: 0 },
      { label: "sequence above range", op: "set", path: "sequence", value: 6 },
      { label: "minVisitedNodes below 5", op: "set", path: "minVisitedNodes", value: 4 },
      { label: "minVisitedNodes above 5", op: "set", path: "minVisitedNodes", value: 6 },
      { label: "maxVisitedNodes below 8", op: "set", path: "maxVisitedNodes", value: 7 },
      { label: "maxVisitedNodes above 8", op: "set", path: "maxVisitedNodes", value: 9 },
      { label: "empty encounterPoolIds", op: "set", path: "encounterPoolIds", value: [] },
      { label: "unlockFlags entry bad format", op: "set", path: "unlockFlags", value: ["Bad Flag"] },
      { label: "storyEntryKeys entry bad format", op: "set", path: "storyEntryKeys", value: ["story.without.prefix"] },
      { label: "mandatoryNodeRules[0].minimum negative", op: "set", path: "mandatoryNodeRules.0.minimum", value: -1 },
    ],
  },
  {
    type: "event",
    probes: [
      { label: "unknown field", op: "set", path: "bogusField", value: 1 },
      { label: "riskTier above range", op: "set", path: "riskTier", value: 4 },
      { label: "riskTier below range", op: "set", path: "riskTier", value: -1 },
      { label: "too few options", op: "set", path: "options", value: [{ id: "opt_a", labelKey: "ui.a", resultKey: "ui.b" }] },
      { label: "too many options", op: "set", path: "options", value: [{ id: "a", labelKey: "ui.a", resultKey: "ui.b" }, { id: "b", labelKey: "ui.a", resultKey: "ui.b" }, { id: "c", labelKey: "ui.a", resultKey: "ui.b" }, { id: "d", labelKey: "ui.a", resultKey: "ui.b" }] },
      { label: "options[0].rollSlot bad format", op: "set", path: "options.0.rollSlot", value: "Bad Slot" },
      { label: "options[0].labelKey bad format", op: "set", path: "options.0.labelKey", value: "foo" },
      { label: "empty regionTags", op: "set", path: "regionTags", value: [] },
      { label: "repeatPolicy enum violation", op: "set", path: "repeatPolicy", value: "never" },
      { label: "prerequisites[0] missing value", op: "set", path: "prerequisites", value: [{ kind: "flag" }] },
    ],
  },
  {
    type: "rewardTable",
    probes: [
      { label: "unknown field", op: "set", path: "bogusField", value: 1 },
      { label: "empty entries", op: "set", path: "entries", value: [] },
      { label: "entries[0].amount negative", op: "set", path: "entries.0.amount", value: -1 },
      { label: "entries[0].weight zero", op: "set", path: "entries.0.weight", value: 0 },
      { label: "entries[0].rewardType enum violation", op: "set", path: "entries.0.rewardType", value: "cheat" },
      { label: "entries[0].rollSlot bad format", op: "set", path: "entries.0.rollSlot", value: "Bad" },
      { label: "entries[0].contentId null allowed", op: "set", path: "entries.0.contentId", value: null },
    ],
  },
  {
    type: "item",
    probes: [
      { label: "unknown field", op: "set", path: "bogusField", value: 1 },
      { label: "category enum violation", op: "set", path: "category", value: "artifact" },
      { label: "empty acquisitionPoolIds", op: "set", path: "acquisitionPoolIds", value: [] },
      { label: "duplicateGold negative", op: "set", path: "duplicateGold", value: -1 },
      { label: "baseStatMods[0].value wrong type", op: "set", path: "baseStatMods.0.value", value: "x" },
      { label: "effectAbilityId null allowed", op: "set", path: "effectAbilityId", value: null },
      { label: "missing id", op: "del", path: "id" },
    ],
  },
  {
    type: "relic",
    probes: [
      { label: "unknown field", op: "set", path: "bogusField", value: 1 },
      { label: "rarity enum violation", op: "set", path: "rarity", value: "mythic" },
      { label: "empty effectAbilityIds", op: "set", path: "effectAbilityIds", value: [] },
      { label: "maxCopies below range", op: "set", path: "maxCopies", value: 0 },
      { label: "maxCopies above range", op: "set", path: "maxCopies", value: 9 },
      { label: "durationScope enum violation", op: "set", path: "durationScope", value: "forever" },
      { label: "empty poolTags", op: "set", path: "poolTags", value: [] },
      { label: "merchantValue negative", op: "set", path: "merchantValue", value: -5 },
    ],
  },
  {
    type: "screen",
    probes: [
      { label: "unknown field", op: "set", path: "bogusField", value: 1 },
      { label: "screenKey bad format", op: "set", path: "screenKey", value: "Main Screen" },
      { label: "happyPathTestId bad format", op: "set", path: "happyPathTestId", value: "e2e-x" },
      { label: "titleKey bad format", op: "set", path: "titleKey", value: "title" },
      { label: "iconVisualId wrong type", op: "set", path: "iconVisualId", value: 42 },
    ],
  },
  {
    type: "visual",
    probes: [
      { label: "unknown field", op: "set", path: "bogusField", value: 1 },
      { label: "ownerPhase bad format", op: "set", path: "ownerPhase", value: "9" },
      { label: "ownerPhase bad format long", op: "set", path: "ownerPhase", value: "090" },
      { label: "status enum violation", op: "set", path: "status", value: "done" },
      { label: "altTextKey bad format", op: "set", path: "altTextKey", value: "no.prefix" },
    ],
  },
  {
    type: "audio",
    probes: [
      { label: "unknown field", op: "set", path: "bogusField", value: 1 },
      { label: "ownerPhase bad format", op: "set", path: "ownerPhase", value: "phase" },
      { label: "status enum violation", op: "set", path: "status", value: "shipped" },
      { label: "captionKey bad format", op: "set", path: "captionKey", value: "caption" },
    ],
  },
];

function fixtureEntity(type: string): Entity {
  const file = FIXTURE_FILES[type];
  if (!file) throw new Error(`no fixture mapped for ${type}`);
  const envelope = JSON.parse(fs.readFileSync(path.join(sourceRoot, file), "utf8")) as { entities: Entity[] };
  const entity = envelope.entities[0];
  if (!entity) throw new Error(`fixture for ${type} has no entities`);
  return entity;
}

for (const battery of BATTERIES) {
  const tsSchema = TS_SCHEMAS[battery.type];
  const mjsSchema = ENTITY_SCHEMAS[battery.type];
  if (!tsSchema || !mjsSchema) throw new Error(`missing schema for ${battery.type}`);

  describe(`schema parity: ${battery.type}`, () => {
    it("accepts the valid fixture entity in both implementations", () => {
      const valid = fixtureEntity(battery.type);
      expect(accepts(tsSchema, valid), ".ts rejected valid fixture").toBe(true);
      expect(accepts(mjsSchema, valid), ".mjs rejected valid fixture").toBe(true);
    });

    for (const probe of battery.probes) {
      it(`agrees on: ${probe.label}`, () => {
        const mutated = applyProbe(fixtureEntity(battery.type), probe);
        const tsAccepts = accepts(tsSchema, mutated);
        const mjsAccepts = accepts(mjsSchema, mutated);
        expect(mjsAccepts).toBe(tsAccepts);
      });
    }
  });
}
