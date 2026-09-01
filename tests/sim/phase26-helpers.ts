import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AnnouncementEvent, AnnouncementKind, PresentedEntity, WarningItem } from '../../src/game/hud/types.js';
import { HudError } from '../../src/game/hud/hud-error.js';

const here = path.dirname(fileURLToPath(import.meta.url));

/** Reads a Phase 26 contract or fixture file (JSON). */
export function readJson(name: string): unknown {
  return JSON.parse(readFileSync(path.join(here, '..', '..', 'contracts', 'phase26', name), 'utf8'));
}

/** Returns the HudError code of a throwing call, or null when it succeeds. */
export function catchHudCode(fn: () => void): string | null {
  try {
    fn();
    return null;
  } catch (error) {
    return error instanceof HudError ? error.code : null;
  }
}

export function presentedEntity(id: string, overrides: Partial<PresentedEntity> = {}): PresentedEntity {
  return { id, side: 'PLAYER', lane: 'TOP', x: 100, hp: 100, maxHp: 100, shield: 0, ...overrides };
}

export function warningItem(id: string, overrides: Partial<WarningItem> = {}): WarningItem {
  return { id, dueTick: 100, severity: 1, lane: 'TOP', x: 50, ...overrides };
}

export function announcement(id: string, kind: AnnouncementKind, overrides: Partial<AnnouncementEvent> = {}): AnnouncementEvent {
  return { id, kind, text: kind.toLowerCase(), tick: 0, ...overrides };
}

/** Deterministic 64-hex hash for the speed/pause invariance driver. */
export function hexHash(n: number): string {
  return String(n).padStart(64, '0');
}
