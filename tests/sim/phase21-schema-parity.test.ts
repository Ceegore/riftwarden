import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { EncounterSourceSchema, BossObjectSourceSchema } from '../../content/schemas/index.js';
import { bossObjectFromContent, type ContentBossObjectEntry } from '../../src/game/sim/boss/encounter-adapter.js';

/**
 * Phase 21 §6 content-vs-sim parity gate. The content schema
 * (BossObjectSourceSchema) expresses boss objects and the sim contract
 * (validateBossObjectContent / validateBossObjectSpec) re-validates them at
 * placement/adapter time. A "crossing" would let the schema accept content the
 * sim silently rejects — or vice versa — so content that "validates" would
 * still fail at runtime. This suite closes that gap: it runs every declared
 * boss object through both layers and proves they agree on accept/reject, and
 * it probes every enum/range boundary so the two contracts can never drift.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const encountersFile = path.join(here, '../../content/source/world/encounters.json');

function allEncounterEntries(): readonly ContentBossObjectEntry[] {
  const envelope = JSON.parse(readFileSync(encountersFile, 'utf8')) as { entities: readonly Record<string, unknown>[] };
  const entries: ContentBossObjectEntry[] = [];
  for (const entity of envelope.entities) {
    const parsed = EncounterSourceSchema.parse(entity);
    for (const entry of parsed.bossObjects) {
      entries.push(entry);
    }
  }
  return entries;
}

function allEncounterEntities(): readonly Record<string, unknown>[] {
  const envelope = JSON.parse(readFileSync(encountersFile, 'utf8')) as { entities: readonly Record<string, unknown>[] };
  return envelope.entities;
}

function schemaAccepts(value: unknown): boolean {
  return BossObjectSourceSchema.safeParse(value).success;
}

function simAccepts(entry: ContentBossObjectEntry): boolean {
  try {
    bossObjectFromContent(entry);
    return true;
  } catch {
    return false;
  }
}

describe('P21 boss-object schema ↔ sim parity (§6)', () => {
  it('every declared boss object in content is accepted by BOTH the schema and the sim', () => {
    const entries = allEncounterEntries();
    expect(entries.length).toBeGreaterThan(0);
    for (const entry of entries) {
      expect(schemaAccepts(entry), `schema rejected ${entry.entityId}`).toBe(true);
      expect(simAccepts(entry), `sim rejected schema-valid ${entry.entityId}`).toBe(true);
    }
  });

  it('every encounter that declares boss objects parses through the encounter schema 1:1', () => {
    let declaring = 0;
    for (const entity of allEncounterEntities()) {
      const parsed = EncounterSourceSchema.parse(entity);
      if (parsed.bossObjects.length === 0) continue;
      declaring += 1;
      for (const entry of parsed.bossObjects) {
        const content = bossObjectFromContent(entry);
        expect(content.entityId).toBe(entry.entityId);
        expect(content.spec.slotId).toBe(entry.slotId);
        expect(content.maxLp).toBe(entry.maxLp);
      }
    }
    expect(declaring).toBeGreaterThan(0);
  });

  it('schema and sim agree on every enum/range boundary probe (no crossing)', () => {
    // Probes mutate the flat source-schema shape; we translate to the adapter's
    // nested-spec shape the way bossObjectFromContent does, then ask both layers.
    type Flat = Record<string, unknown>;
    const flatBase = (): Flat => ({
      entityId: 'obj_parity_probe', side: 'enemy', ownerId: 'boss_probe_unit', sourceId: 'content_parity',
      slotId: 'boss_slot_0', lane: 'middle', x100: 5000, targetable: true, objectiveLink: null,
      damagePolicy: 'normal', statusPolicy: 'allow', cleanupPolicy: 'manual', fallback: 'FAIL',
      maxLp: 500, radiusX100: 120,
    });
    const boundaryProbes: [label: string, patch: (f: Flat) => void][] = [
      ['slotId outside the four slots', (f) => { f['slotId'] = 'boss_slot_9'; }],
      ['lane not top/middle/bottom', (f) => { f['lane'] = 'sky'; }],
      ['unknown damagePolicy', (f) => { f['damagePolicy'] = 'armor'; }],
      ['unknown statusPolicy', (f) => { f['statusPolicy'] = 'reflect'; }],
      ['unknown cleanupPolicy', (f) => { f['cleanupPolicy'] = 'never'; }],
      ['unknown fallback', (f) => { f['fallback'] = 'IGNORE'; }],
      ['x100 non-integer', (f) => { f['x100'] = '5000'; }],
      ['x100 negative', (f) => { f['x100'] = -1; }],
      ['maxLp zero', (f) => { f['maxLp'] = 0; }],
      ['maxLp non-integer', (f) => { f['maxLp'] = 100.5; }],
      ['maxLp negative', (f) => { f['maxLp'] = -10; }],
      ['radiusX100 zero', (f) => { f['radiusX100'] = 0; }],
      ['objectId uppercase', (f) => { f['entityId'] = 'UPPER'; }],
      ['targetable not boolean', (f) => { f['targetable'] = 1; }],
    ];
    for (const [label, patch] of boundaryProbes) {
      const flat = flatBase();
      patch(flat);
      const schema = schemaAccepts({ ...flat });
      const nested: ContentBossObjectEntry = {
        entityId: flat['entityId'] as string,
        side: flat['side'] as ContentBossObjectEntry['side'],
        ownerId: flat['ownerId'] as string,
        sourceId: flat['sourceId'] as string,
        slotId: flat['slotId'] as ContentBossObjectEntry['slotId'],
        lane: flat['lane'] as ContentBossObjectEntry['lane'],
        x100: flat['x100'] as number,
        targetable: flat['targetable'] as boolean,
        objectiveLink: flat['objectiveLink'] as string | null,
        damagePolicy: flat['damagePolicy'] as ContentBossObjectEntry['damagePolicy'],
        statusPolicy: flat['statusPolicy'] as ContentBossObjectEntry['statusPolicy'],
        cleanupPolicy: flat['cleanupPolicy'] as ContentBossObjectEntry['cleanupPolicy'],
        fallback: flat['fallback'] as ContentBossObjectEntry['fallback'],
        maxLp: flat['maxLp'] as number,
        radiusX100: flat['radiusX100'] as number,
      };
      const sim = simAccepts(nested);
      expect(sim, `sim/schema crossing on: ${label}`).toBe(schema);
    }
  });
});
