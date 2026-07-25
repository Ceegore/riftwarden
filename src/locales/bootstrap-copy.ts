import type {
  PreliminaryLocale,
  PreliminarySystemCopy,
  SystemCopyBundle,
  SystemCopyKey,
} from './system-copy';

const DE: SystemCopyBundle = {
  'ui.system.boot.title': 'Riftwarden wird vorbereitet',
  'ui.system.boot.phase.native': 'Native Funktionen werden geprüft.',
  'ui.system.boot.phase.web': 'Die Benutzeroberfläche wird gestartet.',
  'ui.system.boot.phase.settings': 'Einstellungen werden geladen.',
  'ui.system.boot.phase.content': 'Spieldaten werden geprüft.',
  'ui.system.boot.phase.save': 'Lokaler Spielstand wird geprüft.',
  'ui.system.boot.long_wait': 'Dieser Schritt dauert länger als erwartet.',
  'ui.system.action.retry': 'Erneut versuchen',
  'ui.system.action.safe_restart': 'Sicher neu starten',
  'ui.system.action.continue': 'Fortsetzen',
  'ui.system.action.diagnostics': 'Diagnose anzeigen',
  'ui.system.recovery.title': 'Wiederherstellung erforderlich',
  'ui.system.recovery.body': 'Der letzte sichere Zustand bleibt geschützt.',
  'ui.system.compatibility.title': 'Grafikmodus nicht verfügbar',
  'ui.system.compatibility.body': 'Kämpfe benötigen WebGL. Menüs bleiben bedienbar.',
  'ui.system.fatal.title': 'Riftwarden konnte nicht fortfahren',
  'ui.system.fatal.body': 'Der lokale Spielstand wurde nicht gelöscht.',
  'ui.system.resume.title': 'Sitzung fortsetzen',
  'ui.system.resume.body': 'Ein laufender Kampf wird zunächst pausiert geöffnet.',
  'ui.system.error.code_label': 'Fehlercode',
};

const EN: SystemCopyBundle = {
  'ui.system.boot.title': 'Preparing Riftwarden',
  'ui.system.boot.phase.native': 'Checking native capabilities.',
  'ui.system.boot.phase.web': 'Starting the user interface.',
  'ui.system.boot.phase.settings': 'Loading settings.',
  'ui.system.boot.phase.content': 'Validating game content.',
  'ui.system.boot.phase.save': 'Checking the local save.',
  'ui.system.boot.long_wait': 'This step is taking longer than expected.',
  'ui.system.action.retry': 'Try again',
  'ui.system.action.safe_restart': 'Restart safely',
  'ui.system.action.continue': 'Continue',
  'ui.system.action.diagnostics': 'View diagnostics',
  'ui.system.recovery.title': 'Recovery required',
  'ui.system.recovery.body': 'The last safe state remains protected.',
  'ui.system.compatibility.title': 'Graphics mode unavailable',
  'ui.system.compatibility.body': 'Battles require WebGL. Menus remain available.',
  'ui.system.fatal.title': 'Riftwarden could not continue',
  'ui.system.fatal.body': 'The local save was not deleted.',
  'ui.system.resume.title': 'Resume session',
  'ui.system.resume.body': 'An active battle opens paused first.',
  'ui.system.error.code_label': 'Error code',
};

function pseudoize(value: string): string {
  return `⟦${value
    .replaceAll('a', 'á')
    .replaceAll('e', 'ë')
    .replaceAll('i', 'ï')
    .replaceAll('o', 'ô')
    .replaceAll('u', 'ü')}··⟧`;
}

const PSEUDO = Object.fromEntries(
  Object.entries(EN).map(([key, value]) => [key, pseudoize(value)]),
) as SystemCopyBundle;

const BUNDLES: Readonly<Record<PreliminaryLocale, SystemCopyBundle>> = {
  de: DE,
  en: EN,
  pseudo: PSEUDO,
};

export function createPreliminarySystemCopy(
  locale: PreliminaryLocale,
): PreliminarySystemCopy {
  return {
    locale,
    t(key: SystemCopyKey): string {
      return BUNDLES[locale][key];
    },
  };
}
