/**
 * Phase 27 formation domain types (FORMATION_DOMAIN_CONTRACT):
 * nine stable slots (lane_0..2 x front/middle/back), concrete instance/content
 * references (never display strings), canonical ordering, closed finding and
 * error codes, preset kinds and disclosure items. Read-only by construction.
 */
export const LANES = ['lane_0', 'lane_1', 'lane_2'] as const;
export const DEPTHS = ['front', 'middle', 'back'] as const;
export type LaneId = (typeof LANES)[number];
export type Depth = (typeof DEPTHS)[number];
export type SlotId = `${LaneId}:${Depth}`;

export type UnitKind = 'regular' | 'hero';

/** Stable reference to a concrete unit copy; display strings are never identity. */
export interface UnitRef {
  readonly instanceId: string;
  readonly contentId: string;
  readonly kind: UnitKind;
  readonly troopTypeId?: string;
}

export interface SlotEntry {
  readonly slotId: SlotId;
  readonly unit: UnitRef;
}

export interface Formation {
  readonly entries: readonly SlotEntry[];
  readonly doctrineId?: string;
  readonly bannerId?: string;
}

export type Severity = 'hard' | 'warning';

export interface Finding {
  readonly code: string;
  readonly severity: Severity;
  readonly path: string;
  readonly messageKey: string;
  readonly suggestedActionKey?: string;
}

export const PRESET_KINDS = ['standard', 'defensive', 'offensive', 'custom'] as const;
export type PresetKind = (typeof PRESET_KINDS)[number];

export interface Preset {
  readonly kind: PresetKind;
  readonly name: string;
  readonly formation: Formation;
}

export interface RestoreReport {
  readonly formation: Formation;
  readonly missingInstanceIds: readonly string[];
}

/** Authorized pre-battle disclosure items (PREBATTLE_DISCLOSURE_CONTRACT). */
export const DISCLOSURE_ITEMS = [
  'enemyFormation',
  'roles',
  'modifiers',
  'objective',
  'bossPhasesOrBullets',
  'hazards',
  'reinforcements',
  'lootPreviewPolicy',
] as const;
export type DisclosureItem = (typeof DISCLOSURE_ITEMS)[number];
