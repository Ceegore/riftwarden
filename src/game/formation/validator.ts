import { compareCodeUnits } from './model.js';
import type { Finding, Formation } from './types.js';

/**
 * Formation validation (FORMATION_VALIDATION_CONTRACT): pure and deterministic.
 * Hard errors block apply/start (empty group, count limits, duplicate hero,
 * locked slot, incompatible loadout, missing instance, invalid contract copy);
 * warnings only inform (no healer, no melee, empty pressured lane). Every
 * finding carries a typed code, localization key and path; there is no
 * auto-repair and no substitution.
 */
export type HardFindingCode =
  | 'EMPTY_GROUP'
  | 'REGULAR_LIMIT'
  | 'HERO_LIMIT'
  | 'SAME_TROOP_LIMIT'
  | 'DUPLICATE_INSTANCE'
  | 'DUPLICATE_HERO'
  | 'LOCKED_SLOT'
  | 'INCOMPATIBLE_LOADOUT'
  | 'MISSING_INSTANCE'
  | 'INVALID_CONTRACT_COPY';

export type WarningFindingCode = 'NO_HEALER' | 'NO_MELEE' | 'EMPTY_PRESSURED_LANE';

export type FindingCode = HardFindingCode | WarningFindingCode;

export const HARD_FINDING_CODES: readonly HardFindingCode[] = [
  'EMPTY_GROUP',
  'REGULAR_LIMIT',
  'HERO_LIMIT',
  'SAME_TROOP_LIMIT',
  'DUPLICATE_INSTANCE',
  'DUPLICATE_HERO',
  'LOCKED_SLOT',
  'INCOMPATIBLE_LOADOUT',
  'MISSING_INSTANCE',
  'INVALID_CONTRACT_COPY',
];

export const WARNING_FINDING_CODES: readonly WarningFindingCode[] = ['NO_HEALER', 'NO_MELEE', 'EMPTY_PRESSURED_LANE'];

export interface ValidationContext {
  /** Slot ids the profile authorizes; slot availability comes only from here. */
  readonly unlockedSlots: ReadonlySet<string>;
  /** Equipment/kit compatibility predicate (content-index authority only). */
  readonly compatible: (instanceId: string) => boolean;
  /** Lanes under pressure from the preview; empty ones are warned. */
  readonly pressuredLanes: ReadonlySet<string>;
  /** Roles per instance, used for the authorized preview warnings. */
  readonly rolesByInstance: ReadonlyMap<string, readonly string[]>;
  /** Instances that exist and are available in the player's collection. */
  readonly availableInstances: ReadonlySet<string>;
  /** Copy/contract-level validity predicate for an instance. */
  readonly instanceValid: (instanceId: string) => boolean;
}

function hard(code: HardFindingCode, path: string): Finding {
  return { code, severity: 'hard', path, messageKey: `formation.error.${code}` };
}

function warn(code: WarningFindingCode, path: string): Finding {
  return { code, severity: 'warning', path, messageKey: `formation.warning.${code}` };
}

export function validateFormation(formation: Formation, context: ValidationContext): readonly Finding[] {
  const out: Finding[] = [];
  const instanceIds = new Set<string>();
  const heroContents = new Set<string>();
  let regular = 0;
  let heroes = 0;
  const troops = new Map<string, number>();

  if (formation.entries.length === 0) out.push(hard('EMPTY_GROUP', 'entries'));

  for (const entry of formation.entries) {
    const unit = entry.unit;
    if (instanceIds.has(unit.instanceId)) out.push(hard('DUPLICATE_INSTANCE', entry.slotId));
    instanceIds.add(unit.instanceId);
    if (!context.availableInstances.has(unit.instanceId)) out.push(hard('MISSING_INSTANCE', unit.instanceId));
    if (!context.unlockedSlots.has(entry.slotId)) out.push(hard('LOCKED_SLOT', entry.slotId));
    if (!context.compatible(unit.instanceId)) out.push(hard('INCOMPATIBLE_LOADOUT', unit.instanceId));
    if (!context.instanceValid(unit.instanceId)) out.push(hard('INVALID_CONTRACT_COPY', unit.instanceId));
    if (unit.kind === 'hero') {
      heroes += 1;
      if (heroContents.has(unit.contentId)) out.push(hard('DUPLICATE_HERO', unit.contentId));
      heroContents.add(unit.contentId);
    } else {
      regular += 1;
      const troop = unit.troopTypeId ?? unit.contentId;
      troops.set(troop, (troops.get(troop) ?? 0) + 1);
    }
  }

  if (regular > 7) out.push(hard('REGULAR_LIMIT', 'entries'));
  if (heroes > 3) out.push(hard('HERO_LIMIT', 'entries'));
  for (const [troop, count] of troops) {
    if (count > 3) out.push(hard('SAME_TROOP_LIMIT', troop));
  }

  const roles = formation.entries.flatMap((entry) => context.rolesByInstance.get(entry.unit.instanceId) ?? []);
  if (!roles.includes('healer')) out.push(warn('NO_HEALER', 'entries'));
  if (!roles.includes('melee')) out.push(warn('NO_MELEE', 'entries'));
  for (const lane of context.pressuredLanes) {
    if (!formation.entries.some((entry) => entry.slotId.startsWith(`${lane}:`))) {
      out.push(warn('EMPTY_PRESSURED_LANE', lane));
    }
  }

  return out.sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === 'hard' ? -1 : 1;
    return compareCodeUnits(a.code, b.code);
  });
}

/** Start-enabled is exactly: no hard findings (disclosure handled separately). */
export function canStart(findings: readonly Finding[]): boolean {
  return !findings.some((finding) => finding.severity === 'hard');
}
