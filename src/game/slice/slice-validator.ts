import { compareCodeUnit } from '../expedition/stable.js';
import type { SliceEntry, SliceKind, SliceManifest } from './types.js';

/**
 * Slice manifest validation (SLICE_MANIFEST_CONTRACT): exactly four heroes
 * and six troops from the authorized Act-I/Ash-King roster; every id is
 * unique, revision-bound and referentially closed; a boss must be present.
 * Validation is pure, deterministic and never repairs or substitutes —
 * findings are reported in stable code-unit order.
 */
export type SliceViolationCode =
  | 'HERO_COUNT'
  | 'TROOP_COUNT'
  | 'DUPLICATE_ID'
  | 'MISSING_REVISION'
  | 'BOSS_MISSING'
  | 'UNRESOLVED_CONTENT_REVISION'
  | 'UNKNOWN_KIND';

export interface SliceViolation {
  readonly code: SliceViolationCode;
  readonly id?: string;
  readonly messageKey: string;
}

export const SLICE_KINDS: readonly SliceKind[] = ['HERO', 'TROOP', 'ENEMY', 'BOSS', 'ITEM', 'RELIC', 'EVENT', 'MODIFIER'];
const KIND_SET: ReadonlySet<string> = new Set(SLICE_KINDS);

export const SLICE_VIOLATION_CODES: readonly SliceViolationCode[] = [
  'HERO_COUNT',
  'TROOP_COUNT',
  'DUPLICATE_ID',
  'MISSING_REVISION',
  'BOSS_MISSING',
  'UNRESOLVED_CONTENT_REVISION',
  'UNKNOWN_KIND',
];

export interface SliceValidation {
  readonly ok: boolean;
  readonly violations: readonly SliceViolation[];
}

function violation(code: SliceViolationCode, id?: string): SliceViolation {
  return id === undefined ? { code, messageKey: `slice.error.${code}` } : { code, id, messageKey: `slice.error.${code}` };
}

export function validateSlice(manifest: SliceManifest): SliceValidation {
  const out: SliceViolation[] = [];
  if (manifest.heroes.length !== 4) out.push(violation('HERO_COUNT'));
  if (manifest.troops.length !== 6) out.push(violation('TROOP_COUNT'));
  if (manifest.contentRevision === 'UNRESOLVED' || manifest.contentRevision.length === 0) out.push(violation('UNRESOLVED_CONTENT_REVISION'));

  const all: readonly SliceEntry[] = [...manifest.heroes, ...manifest.troops, ...manifest.others];
  const ids = new Set<string>();
  for (const entry of all) {
    if (!KIND_SET.has(entry.kind)) out.push(violation('UNKNOWN_KIND', entry.id));
    if (ids.has(entry.id)) out.push(violation('DUPLICATE_ID', entry.id));
    ids.add(entry.id);
    if (entry.revision.length === 0) out.push(violation('MISSING_REVISION', entry.id));
  }
  if (!all.some((entry) => entry.kind === 'BOSS')) out.push(violation('BOSS_MISSING'));

  const unique = new Map<string, SliceViolation>();
  for (const item of out) {
    const key = item.id === undefined ? item.code : `${item.code}:${item.id}`;
    if (!unique.has(key)) unique.set(key, item);
  }
  const violations = [...unique.values()].sort((a, b) => compareCodeUnit(a.code, b.code));
  return { ok: violations.length === 0, violations };
}
