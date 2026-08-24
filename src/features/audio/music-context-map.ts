/**
 * Phase 39: maps a screen-facing nav state to a semantic music context.
 * Pure function kept separate from the React provider for fast-refresh.
 *
 * Every PostBootScreen NavState (string literal or object `kind`) is
 * covered so no reachable screen accidentally crossfades to silence.
 *
 * Combat nodes (battle/elite/boss) request battle or boss music; all other
 * node types continue the region theme so merchants, events, and treasure
 * rooms do not trigger combat music.
 */
import type { MusicContext } from '../../game/content/audio/music-director.js';

export interface MusicContextOptions {
  readonly regionId?: string;
  /** Current node type when a run is active (battle/elite/boss/…). */
  readonly nodeType?: string;
}

function regionFor(options: MusicContextOptions | undefined): MusicContext {
  return { kind: 'region', regionId: options?.regionId ?? 'standard' };
}

function battleFor(nodeType: string | undefined): MusicContext {
  if (nodeType === 'boss') return { kind: 'bossPhase', phase: 1 };
  if (nodeType === 'elite') return { kind: 'battle', intensity: 'elite' };
  return { kind: 'battle', intensity: 'normal' };
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
      return regionFor(options);
    case 'reward':
      return regionFor(options);

    // Combat: only battle/elite/boss request battle music; other node
    // types (merchant, event, …) keep the region theme.
    case 'node':
      if (options?.nodeType === 'battle' || options?.nodeType === 'elite' || options?.nodeType === 'boss') {
        return battleFor(options.nodeType);
      }
      return regionFor(options);

    // Battle result: keep the combat theme while settling the outcome.
    case 'battleResult':
      return battleFor(options?.nodeType);

    default:
      return 'silence';
  }
}
