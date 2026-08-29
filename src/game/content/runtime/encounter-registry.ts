/**
 * Phase 21 §9 content encounter registry (CONTENT_RUNTIME_CONTRACT).
 *
 * The expedition's battle nodes carry a payload key; this module resolves them
 * to REAL content encounters through the content runtime — the same layer the
 * app's ContentIndex serves once the bundle loader is wired. The registry is a
 * pure read-only projection of the committed content source
 * (content/source/world/*.json) — the exact data the content compiler emits
 * into content/generated/*, so swapping the import below for the compiled
 * bundle is the only change a wired bundle loader needs.
 *
 * Resolution is deterministic and payloadKey-driven:
 *   1. a payload key that names a registered encounter wins (the expedition can
 *      carry an encounter id directly);
 *   2. otherwise the node family selects deterministically from the registry —
 *      canonical asciiCompare order, never locale — by content classification
 *      (boss-family = declares a boss; duo = declares a secondary boss too).
 * Everything is frozen; there is no mutation surface.
 */

import type { ContentBossObjectEntry, ContentModifierSource, EncounterObjectiveKind, EncounterWaveSource } from '../../../game/sim/boss/encounter-adapter.js';
import type { ContentBossPhaseSource } from '../../../game/sim/boss/boss-phase-content-adapter.js';
import type { Lane } from '../../../game/sim/geometry/x100.js';

import encountersData from '../../../../content/source/world/encounters.json';
import modifiersData from '../../../../content/source/world/modifiers.json';
import unitsData from '../../../../content/source/units/units.json';

/** One flattened encounter entry (the shape the sim adapter consumes). */
export interface ContentEnemySlot {
  readonly unitId: string;
  readonly lane: Lane;
}
export interface ContentEncounterEntry {
  readonly id: string;
  readonly objective: EncounterObjectiveKind;
  readonly enemySlots: readonly ContentEnemySlot[];
  readonly modifierIds?: readonly string[];
  readonly reinforcementWaves?: readonly EncounterWaveSource[];
  readonly bossUnitId?: string | null;
  readonly bossUnitIdSecondary?: string | null;
  readonly survivalDurationSeconds?: number | null;
  readonly healSustainCount?: number | null;
  readonly bossPhases?: readonly ContentBossPhaseSource[];
  readonly bossPhasesSecondary?: readonly ContentBossPhaseSource[];
  readonly bossObjects?: readonly ContentBossObjectEntry[];
}
export interface ContentUnitEntry {
  readonly id: string;
  readonly baseStats: { readonly maxHp: number };
  readonly collisionRadiusX100: number;
}
export interface ContentModifierEntry extends ContentModifierSource {
  readonly id: string;
}

interface EncounterEnvelope { readonly entities: readonly ContentEncounterEntry[] }
interface ModifierEnvelope { readonly entities: readonly ContentModifierEntry[] }
interface UnitEnvelope { readonly entities: readonly ContentUnitEntry[] }

export const CONTENT_ENCOUNTERS: ReadonlyMap<string, Readonly<ContentEncounterEntry>> = new Map(
  (encountersData as unknown as EncounterEnvelope).entities.map((e) => [e.id, Object.freeze(e)] as const),
);
export const CONTENT_MODIFIERS: ReadonlyMap<string, Readonly<ContentModifierEntry>> = new Map(
  (modifiersData as unknown as ModifierEnvelope).entities.map((e) => [e.id, Object.freeze(e)] as const),
);
export const CONTENT_UNITS: ReadonlyMap<string, Readonly<ContentUnitEntry>> = new Map(
  (unitsData as unknown as UnitEnvelope).entities.map((e) => [e.id, Object.freeze(e)] as const),
);

/** Canonical ordering: asciiCompare/code-unit compare — never localeCompare. */
function compareIds(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function encounterById(id: string): Readonly<ContentEncounterEntry> | null {
  return CONTENT_ENCOUNTERS.get(id) ?? null;
}

export function unitById(id: string): Readonly<ContentUnitEntry> | null {
  return CONTENT_UNITS.get(id) ?? null;
}

export function modifierById(id: string): Readonly<ContentModifierEntry> | null {
  return CONTENT_MODIFIERS.get(id) ?? null;
}

/** Boss-family encounter: declares a boss unit. */
export function isBossEncounter(entry: Readonly<ContentEncounterEntry>): boolean {
  const bossId = entry.bossUnitId;
  return bossId !== undefined && bossId !== null && bossId !== '';
}

/** Sustained-heal mission encounter (heal_sustain objective). */
export function isSustainEncounter(entry: Readonly<ContentEncounterEntry>): boolean {
  return entry.objective === 'heal_sustain';
}

/** Duo encounter: a boss-family encounter with a secondary boss authority. */
export function isDuoEncounter(entry: Readonly<ContentEncounterEntry>): boolean {
  if (!isBossEncounter(entry)) return false;
  const second = entry.bossUnitIdSecondary;
  return second !== undefined && second !== null && second !== '';
}

function firstMatch(entries: readonly Readonly<ContentEncounterEntry>[], predicate: (e: Readonly<ContentEncounterEntry>) => boolean): Readonly<ContentEncounterEntry> | null {
  const sorted = [...entries].filter(predicate).sort((a, b) => compareIds(a.id, b.id));
  return sorted[0] ?? null;
}

/**
 * Resolves an expedition battle node to a real content encounter:
 * payloadKey-first (a key that names an encounter wins), then the node family
 * picks deterministically from the registry by content classification. Unknown
 * node types and empty payload keys resolve to `null` (the caller keeps its
 * honest stand-in feed).
 */
export function resolveEncounterForNode(nodeType: string, payloadKey: string): Readonly<ContentEncounterEntry> | null {
  if (payloadKey === '') return null;
  const byKey = encounterById(payloadKey);
  if (byKey !== null) return byKey;
  const all = [...CONTENT_ENCOUNTERS.values()];
  if (nodeType === 'boss') {
    return firstMatch(all, isDuoEncounter) ?? firstMatch(all, isBossEncounter);
  }
  if (nodeType === 'elite') {
    return firstMatch(all, (e) => isBossEncounter(e) && !isDuoEncounter(e)) ?? firstMatch(all, isBossEncounter);
  }
  if (nodeType === 'battle') {
    return firstMatch(all, (e) => !isBossEncounter(e));
  }
  return null;
}
