import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FormationError } from '../../src/game/formation/formation-error.js';
import { SLOT_IDS } from '../../src/game/formation/model.js';
import type { Formation, SlotEntry, SlotId, UnitKind, UnitRef } from '../../src/game/formation/types.js';
import type { ValidationContext } from '../../src/game/formation/validator.js';

const here = path.dirname(fileURLToPath(import.meta.url));

/** Reads a Phase 27 contract or fixture file (JSON). */
export function readJson(name: string): unknown {
  return JSON.parse(readFileSync(path.join(here, '..', '..', 'contracts', 'phase27', name), 'utf8'));
}

/** Returns the FormationError code of a throwing call, or null when it succeeds. */
export function catchFormationCode(fn: () => void): string | null {
  try {
    fn();
    return null;
  } catch (error) {
    return error instanceof FormationError ? error.code : null;
  }
}

export function unit(instanceId: string, kind: UnitKind = 'regular', overrides: Partial<UnitRef> = {}): UnitRef {
  return { instanceId, contentId: `content_${instanceId}`, kind, ...overrides };
}

export function entry(slotId: SlotId, ref: UnitRef): SlotEntry {
  return { slotId, unit: ref };
}

export function formation(entries: readonly SlotEntry[], overrides: Partial<Formation> = {}): Formation {
  return { entries, ...overrides };
}

export interface ContextOverrides {
  readonly unlockedSlots?: ReadonlySet<string>;
  readonly availableInstances?: ReadonlySet<string>;
  readonly compatible?: (instanceId: string) => boolean;
  readonly instanceValid?: (instanceId: string) => boolean;
  readonly pressuredLanes?: ReadonlySet<string>;
  readonly rolesByInstance?: ReadonlyMap<string, readonly string[]>;
}

export function validationContext(overrides: ContextOverrides = {}): ValidationContext {
  return {
    unlockedSlots: overrides.unlockedSlots ?? new Set(SLOT_IDS),
    availableInstances: overrides.availableInstances ?? new Set(),
    compatible: overrides.compatible ?? (() => true),
    instanceValid: overrides.instanceValid ?? (() => true),
    pressuredLanes: overrides.pressuredLanes ?? new Set(),
    rolesByInstance: overrides.rolesByInstance ?? new Map(),
  };
}

export function codesOf(findings: readonly { readonly code: string }[]): readonly string[] {
  return findings.map((finding) => finding.code);
}
