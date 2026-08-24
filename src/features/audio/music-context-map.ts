/**
 * Phase 39: maps a screen-facing nav state to a semantic music context.
 * Pure function kept separate from the React provider for fast-refresh.
 *
 * Every PostBootScreen NavState (string literal or object `kind`) is
 * covered so no reachable screen accidentally crossfades to silence.
 */
import type { MusicContext } from '../../game/content/audio/music-director.js';

export interface MusicContextOptions {
  readonly regionId?: string;
  readonly intensity?: 'normal' | 'elite' | 'boss';
}

export function contextForScreen(screen: string, options?: MusicContextOptions): MusicContext {
  switch (screen) {
    // Menu family: calm title theme.
    case 'menu':
    case 'newGame':
    case 'missions':
    case 'missionDetail':
    case 'help':
    case 'settings':
    case 'audioSettings':
    case 'accessibilitySettings':
    case 'controlsSettings':
    case 'graphicsSettings':
    case 'end':
    case 'defeat':
      return 'title';

    // HQ family: hub theme.
    case 'hq':
    case 'heroHall':
    case 'heroDetail':
    case 'barracks':
    case 'troopDetail':
    case 'workshop':
    case 'itemDetail':
    case 'archive':
    case 'codexList':
    case 'codexDetail':
    case 'mastery':
    case 'achievements':
    case 'records':
    case 'storyArchive':
    case 'ascension':
    case 'constellation':
    case 'cyclePreparation':
    case 'beyondSetup':
    case 'endlessSetup':
    case 'riftChamber':
    case 'equipment':
    case 'kits':
    case 'banners':
    case 'formation':
      return 'hq';

    // Expedition: region exploration.
    case 'map':
      return { kind: 'region', regionId: options?.regionId ?? 'standard' };
    case 'reward':
      return { kind: 'region', regionId: options?.regionId ?? 'standard' };

    // Combat: battle theme, boss phase for boss nodes.
    case 'node':
      if (options?.intensity === 'boss') return { kind: 'bossPhase', phase: 1 };
      return { kind: 'battle', intensity: options?.intensity ?? 'normal' };
    case 'battleResult':
      return { kind: 'battle', intensity: options?.intensity ?? 'normal' };

    default:
      return 'silence';
  }
}
