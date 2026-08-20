import { FormationError } from './formation-error.js';
import { PRESET_KINDS, type Formation, type Preset, type PresetKind, type RestoreReport } from './types.js';

/**
 * Presets (PRESET_CONTRACT): exactly four kinds (standard, defensive,
 * offensive, a named custom). Restoring applies skip-and-report: exact copies
 * with missing content are skipped deterministically and reported in stable
 * order; nothing is substituted. Persistence needs an explicit migration hook
 * (handled by the draft store), so this module stays pure.
 */
export const PRESET_COUNT = PRESET_KINDS.length;

const PRESET_KIND_SET: ReadonlySet<PresetKind> = new Set(PRESET_KINDS);

export function isPresetKind(value: unknown): value is PresetKind {
  return typeof value === 'string' && PRESET_KIND_SET.has(value as PresetKind);
}

export function assertPresetKind(value: unknown): asserts value is PresetKind {
  if (!isPresetKind(value)) {
    throw new FormationError('UNKNOWN_PRESET_KIND', { kind: value });
  }
}

/** Custom preset names are non-empty and locale-independent for identity. */
export function validatePresetName(name: string): boolean {
  return name.trim().length > 0;
}

/**
 * Deterministically picks one name for a duplicate custom-preset name: the
 * first occurrence wins and later ones are renamed `name (2)`, `name (3)`, ...
 * Order is the order of the input array (callers sort by code units first).
 */
export function dedupePresetNames(names: readonly string[]): readonly string[] {
  const seen = new Map<string, number>();
  const out: string[] = [];
  for (const raw of names) {
    let candidate = raw;
    const count = seen.get(candidate) ?? 0;
    if (count === 0) {
      seen.set(candidate, 1);
    } else {
      let suffix = 2;
      let next = `${raw} (${String(suffix)})`;
      while (seen.has(next)) {
        suffix += 1;
        next = `${raw} (${String(suffix)})`;
      }
      seen.set(next, 1);
      candidate = next;
    }
    out.push(candidate);
  }
  return out;
}

export function restorePreset(preset: Preset, available: ReadonlySet<string>): RestoreReport {
  const missing = preset.formation.entries
    .filter((entry) => !available.has(entry.unit.instanceId))
    .map((entry) => entry.unit.instanceId)
    .sort();
  return {
    formation: {
      ...preset.formation,
      entries: preset.formation.entries.filter((entry) => available.has(entry.unit.instanceId)),
    },
    missingInstanceIds: missing,
  };
}

/** Builds a preset with a validated kind; the custom kind demands a name. */
export function createPreset(kind: PresetKind, formation: Formation, name = ''): Preset {
  assertPresetKind(kind);
  if (kind === 'custom' && !validatePresetName(name)) {
    throw new FormationError('UNKNOWN_PRESET_KIND', { kind, reason: 'custom-preset-needs-name' });
  }
  return { kind, name, formation };
}
