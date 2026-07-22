#!/usr/bin/env node
// Build chunk-k.json (chapters 42-47) staging file from GDD V5.
// Reads excerpts from docs/requirements/generated/chapters/chapter-42..47.txt
// and writes the staging file docs/requirements/requirements/_staging/chunk-k.json.
// Hashes are computed at build time.
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { createHash } from 'node:crypto';

function sha(s) { return 'sha256:' + createHash('sha256').update(s, 'utf8').digest('hex'); }

const requirements = [];

function add(req) {
  requirements.push({
    id: req.id,
    title: req.title,
    statement: req.statement,
    norm: req.norm,
    category: req.category,
    source: {
      sourceId: 'gdd-v5',
      chapter: req.chapter,
      section: req.section ?? null,
      locator: req.locator,
      quoteHash: sha(req.excerpt),
      originalExcerpt: req.excerpt,
    },
    ownerPhases: req.ownerPhases,
    verification: req.verification,
    numericConstraints: req.numericConstraints ?? [],
    relatedNormIds: [],
    relatedScreenIds: [],
    status: 'planned',
    notes: null,
  });
}

// =============== CHAPTER 42: Savegame, Versionierung und Offline-Verhalten ===============

// 42.1 Mindestens 3 rotierende Autosave-Slots + 1 manuelles Profil-Backup im App-Speicher.
add({
  id: 'REQ-TEMP-K-0001', chapter: 42, locator: 'block:1458',
  title: 'Mindestens drei rotierende lokale Autosave-Slots plus ein manuelles Profil-Backup im App-Speicher.',
  statement: 'Mindestens drei rotierende lokale Autosave-Slots plus ein manuelles Profil-Backup im App-Speicher.',
  excerpt: 'Mindestens drei rotierende lokale Autosave-Slots plus ein manuelles Profil-Backup im App-Speicher.',
  norm: 'MUST', category: 'Save',
  ownerPhases: ['PHASE-05'],
  verification: [{ type: 'unit', plannedPhase: 'PHASE-05', testIds: ['UT-AUTOSLOT-COUNT-042'] }],
  numericConstraints: [{ kind: 'min', name: 'autoSaveSlots', value: 3 }],
});

// 42.2 Save-Inhalt: schemaVersion, contentVersion, simulationVersion, Fortschritt, Inventarfreischaltungen, Politur, Ruhm, Meisterschaft, Erfolge, Einstellungen, aktuelle Expedition und deterministische Seeds.
add({
  id: 'REQ-TEMP-K-0002', chapter: 42, locator: 'block:1459',
  title: 'Save enthält schemaVersion, contentVersion, simulationVersion, Fortschritt, Inventarfreischaltungen, Politur, Ruhm, Meisterschaft, Erfolge, Einstellungen, aktuelle Expedition und deterministische Seeds.',
  statement: 'Save enthält schemaVersion, contentVersion, simulationVersion, Fortschritt, Inventarfreischaltungen, Politur, Ruhm, Meisterschaft, Erfolge, Einstellungen, aktuelle Expedition und deterministische Seeds.',
  excerpt: 'Save enthält schemaVersion, contentVersion, simulationVersion, Fortschritt, Inventarfreischaltungen, Politur, Ruhm, Meisterschaft, Erfolge, Einstellungen, aktuelle Expedition und deterministische Seeds.',
  norm: 'MUST', category: 'Save',
  ownerPhases: ['PHASE-05'],
  verification: [{ type: 'unit', plannedPhase: 'PHASE-05', testIds: ['UT-SAVE-FIELDS-042'] }],
});

// 42.3 Atomarer Schreibvorgang: in temporäre Datei, Prüfsumme, dann ersetzen. Beschädigter neuester Slot fällt auf vorherigen zurück und informiert den Spieler.
add({
  id: 'REQ-TEMP-K-0003', chapter: 42, locator: 'block:1460',
  title: 'Schreibvorgang atomar: in temporäre Datei, Prüfsumme, dann ersetzen; beschädigter neuester Slot fällt auf vorherigen zurück und informiert den Spieler.',
  statement: 'Schreibvorgang ist atomar: erst temporäre Datei, dann Prüfsumme, dann ersetzen. Ein beschädigter neuester Slot fällt auf den vorherigen Slot zurück und informiert den Spieler.',
  excerpt: 'Schreibvorgang atomar: in temporäre Datei, Prüfsumme, dann ersetzen. Beschädigter neuester Slot fällt auf vorherigen zurück und informiert den Spieler.',
  norm: 'MUST', category: 'Save',
  ownerPhases: ['PHASE-05'],
  verification: [{ type: 'unit', plannedPhase: 'PHASE-05', testIds: ['UT-ATOMIC-WRITE-042'] }],
});

// 42.4 Migrationen sind vorwärtsgerichtet und idempotent; ein Save wird vor Migration gesichert.
add({
  id: 'REQ-TEMP-K-0004', chapter: 42, locator: 'block:1461',
  title: 'Migrationen sind vorwärtsgerichtet und idempotent; ein Save wird vor Migration gesichert.',
  statement: 'Migrationen sind vorwärtsgerichtet und idempotent. Ein Save wird vor Migration gesichert.',
  excerpt: 'Migrationen sind vorwärtsgerichtet und idempotent. Ein Save wird vor Migration gesichert.',
  norm: 'MUST', category: 'Save',
  ownerPhases: ['PHASE-05'],
  verification: [{ type: 'unit', plannedPhase: 'PHASE-05', testIds: ['UT-MIGRATION-IDEMPOTENT-042'] }],
});

// 42.5 Laufender Kampf speichert Startsnapshot plus aktuellen Simulationszustand; Fortsetzen darf nicht neu würfeln oder zum Kampfbeginn zurücksetzen, außer Snapshot ist technisch ungültig.
add({
  id: 'REQ-TEMP-K-0005', chapter: 42, locator: 'block:1462',
  title: 'Laufender Kampf speichert Startsnapshot plus aktuellen Simulationszustand; Fortsetzen darf nicht neu würfeln oder zum Kampfbeginn zurücksetzen, außer Snapshot ist technisch ungültig.',
  statement: 'Ein laufender Kampf speichert Startsnapshot plus aktuellen Simulationszustand. Fortsetzen darf nicht neu würfeln oder zum Kampfbeginn zurücksetzen, außer der Snapshot ist technisch ungültig.',
  excerpt: 'Laufender Kampf speichert Startsnapshot plus aktuellen Simulationszustand; Fortsetzen darf nicht neu würfeln oder zum Kampfbeginn zurücksetzen, außer Snapshot ist technisch ungültig. Dann wird der Kampf mit demselben Seed vom Beginn wiederholt und klar erklärt.',
  norm: 'MUST', category: 'Save',
  ownerPhases: ['PHASE-05'],
  verification: [{ type: 'unit', plannedPhase: 'PHASE-05', testIds: ['UT-COMBAT-RESUME-042'] }],
});

// 42.6 Bei ungültigem Snapshot wird der Kampf mit demselben Seed vom Beginn wiederholt und klar erklärt.
add({
  id: 'REQ-TEMP-K-0006', chapter: 42, locator: 'block:1462',
  title: 'Bei technisch ungültigem Snapshot wird der Kampf mit demselben Seed vom Beginn wiederholt und dem Spieler klar erklärt.',
  statement: 'Ist der Snapshot technisch ungültig, wird der Kampf mit demselben Seed vom Beginn wiederholt und dem Spieler klar erklärt.',
  excerpt: 'Dann wird der Kampf mit demselben Seed vom Beginn wiederholt und klar erklärt.',
  norm: 'MUST', category: 'Save',
  ownerPhases: ['PHASE-05'],
  verification: [{ type: 'unit', plannedPhase: 'PHASE-05', testIds: ['UT-INVALID-SNAPSHOT-042'] }],
});

// 42.7 Kein Fortschritt hängt von Uhrzeit, Zeitzone, Geräte-ID, Account oder Internet ab.
add({
  id: 'REQ-TEMP-K-0007', chapter: 42, locator: 'block:1463',
  title: 'Kein Fortschritt hängt von Uhrzeit, Zeitzone, Geräte-ID, Account oder Internet ab.',
  statement: 'Kein Fortschritt hängt von Uhrzeit, Zeitzone, Geräte-ID, Account oder Internet ab.',
  excerpt: 'Kein Fortschritt hängt von Uhrzeit, Zeitzone, Geräte-ID, Account oder Internet ab.',
  norm: 'MUST_NOT', category: 'Save',
  ownerPhases: ['PHASE-05'],
  verification: [{ type: 'unit', plannedPhase: 'PHASE-05', testIds: ['UT-NO-CLOCK-DEP-042'] }],
});

// 42.8 Deinstallation kann lokale Daten löschen; Export/Import eines Savefiles ist als Komfortfunktion vorgesehen, aber keine Cloudpflicht.
add({
  id: 'REQ-TEMP-K-0008', chapter: 42, locator: 'block:1464',
  title: 'Export/Import eines Savefiles ist als Komfortfunktion vorgesehen, jedoch keine Cloudpflicht.',
  statement: 'Export und Import eines Savefiles sind als Komfortfunktion vorgesehen, jedoch keine Cloudpflicht.',
  excerpt: 'Export/Import eines Savefiles ist als Komfortfunktion vorgesehen, aber keine Cloudpflicht.',
  norm: 'MAY', category: 'Save',
  ownerPhases: ['PHASE-05'],
  verification: [{ type: 'review', plannedPhase: 'PHASE-05', testIds: ['REV-EXPORT-IMPORT-042'] }],
});

// =============== CHAPTER 43: Balancing-Leitplanken ===============

// 43.1 Keine Begegnung wird nur durch massive LP-Skalierung schwierig; mindestens eine Formations-/Mechanikänderung.
add({
  id: 'REQ-TEMP-K-0009', chapter: 43, locator: 'block:1468',
  title: 'Keine Begegnung wird nur durch massive LP-Skalierung schwierig; es ist mindestens eine Formations- oder Mechanikänderung erforderlich.',
  statement: 'Keine Begegnung wird nur durch massive LP-Skalierung schwierig; mindestens eine Formations- oder Mechanikänderung.',
  excerpt: 'Keine Begegnung wird nur durch massive LP-Skalierung schwierig; mindestens eine Formations-/Mechanikänderung.',
  norm: 'MUST_NOT', category: 'Sim',
  ownerPhases: ['PHASE-20'],
  verification: [{ type: 'unit', plannedPhase: 'PHASE-20', testIds: ['GR-NO-LP-ONLY-043'] }],
});

// 43.2 Keine Fähigkeit erhält versteckte Trefferchance oder zufällige kritische Treffer, um Zielwerte zu erreichen.
add({
  id: 'REQ-TEMP-K-0010', chapter: 43, locator: 'block:1469',
  title: 'Keine Fähigkeit darf eine versteckte Trefferchance oder zufällige kritische Treffer erhalten, um Zielwerte zu erreichen.',
  statement: 'Keine Fähigkeit erhält versteckte Trefferchance oder zufällige kritische Treffer, um Zielwerte zu erreichen.',
  excerpt: 'Keine Fähigkeit erhält versteckte Trefferchance oder zufällige kritische Treffer, um Zielwerte zu erreichen.',
  norm: 'MUST_NOT', category: 'Sim',
  ownerPhases: ['PHASE-20'],
  verification: [{ type: 'unit', plannedPhase: 'PHASE-20', testIds: ['GR-NO-HIDDEN-RNG-043'] }],
});

// 43.3 Kein Boss wird gegen Kontrolle vollständig immun ohne sichtbares reduziertes Feedback.
add({
  id: 'REQ-TEMP-K-0011', chapter: 43, locator: 'block:1470',
  title: 'Kein Boss wird gegen Kontrolle vollständig immun ohne sichtbares reduziertes Feedback.',
  statement: 'Kein Boss wird gegen Kontrolle vollständig immun ohne sichtbares reduziertes Feedback.',
  excerpt: 'Kein Boss wird gegen Kontrolle vollständig immun ohne sichtbares reduziertes Feedback.',
  norm: 'MUST_NOT', category: 'Sim',
  ownerPhases: ['PHASE-08'],
  verification: [{ type: 'unit', plannedPhase: 'PHASE-08', testIds: ['UT-BOSS-CONTROL-FEEDBACK-043'] }],
});

// 43.4 Keine einzelne Synergie oder Heldengruppe darf alle vier Hauptbosse ohne Anpassung deutlich dominieren.
add({
  id: 'REQ-TEMP-K-0012', chapter: 43, locator: 'block:1471',
  title: 'Keine einzelne Synergie oder Heldengruppe darf alle vier Hauptbosse ohne Anpassung deutlich dominieren.',
  statement: 'Keine einzelne Synergie oder Heldengruppe darf alle vier Hauptbosse ohne Anpassung deutlich dominieren.',
  excerpt: 'Keine einzelne Synergie oder Heldengruppe darf alle vier Hauptbosse ohne Anpassung deutlich dominieren.',
  norm: 'MUST_NOT', category: 'Sim',
  ownerPhases: ['PHASE-20'],
  verification: [{ type: 'unit', plannedPhase: 'PHASE-20', testIds: ['GR-NO-DOMINANT-043'] }],
});

// 43.5 Keine Kampagnenfreischaltung verlangt wiederholtes Farmen derselben Mission auf Normal.
add({
  id: 'REQ-TEMP-K-0013', chapter: 43, locator: 'block:1472',
  title: 'Keine Kampagnenfreischaltung verlangt wiederholtes Farmen derselben Mission auf Normal.',
  statement: 'Keine Kampagnenfreischaltung verlangt wiederholtes Farmen derselben Mission auf Normal.',
  excerpt: 'Keine Kampagnenfreischaltung verlangt wiederholtes Farmen derselben Mission auf Normal.',
  norm: 'MUST_NOT', category: 'Product',
  ownerPhases: ['PHASE-20'],
  verification: [{ type: 'review', plannedPhase: 'PHASE-20', testIds: ['GR-NO-FARM-GATE-043'] }],
});

// 43.6 Keine Niederlage wird durch Reduzieren permanenter Progression "gelöst"; zuerst Lesbarkeit, Counter und Werte prüfen.
add({
  id: 'REQ-TEMP-K-0014', chapter: 43, locator: 'block:1473',
  title: 'Keine Niederlage wird durch Reduzieren permanenter Progression "gelöst"; zuerst werden Lesbarkeit, Counter und Werte geprüft.',
  statement: 'Keine Niederlage wird durch Reduzieren permanenter Progression gelöst; zuerst werden Lesbarkeit, Counter und Werte geprüft.',
  excerpt: 'Keine Niederlage wird durch Reduzieren permanenter Progression „gelöst"; zuerst Lesbarkeit, Counter und Werte prüfen.',
  norm: 'MUST_NOT', category: 'Product',
  ownerPhases: ['PHASE-20'],
  verification: [{ type: 'review', plannedPhase: 'PHASE-20', testIds: ['GR-NO-NERF-PROGRESSION-043'] }],
});

// =============== CHAPTER 44: Vertikaler Inhaltsprototyp ===============

// 44 Intro: vertikaler Prototyp vor Vollproduktion muss beweisen, dass beobachteter Kampf als Kernfantasie funktioniert.
add({
  id: 'REQ-TEMP-K-0015', chapter: 44, locator: 'block:1481',
  title: 'Vor Vollproduktion muss ein vertikaler Prototyp beweisen, dass der beobachtete Kampf als Kernfantasie funktioniert, und nutzt die spätere Simulationslogik und Datenstruktur.',
  statement: 'Vor Vollproduktion muss ein vertikaler Prototyp beweisen, dass der beobachtete Kampf als Kernfantasie funktioniert. Er verwendet die spätere Simulationslogik und Datenstruktur.',
  excerpt: 'Vor Vollproduktion muss ein vertikaler Prototyp beweisen, dass der beobachtete Kampf als Kernfantasie funktioniert. Er ist kein Wegwerf-Mockup, sondern verwendet die spätere Simulationslogik und Datenstruktur.',
  norm: 'MUST', category: 'Sim',
  ownerPhases: ['PHASE-01'],
  verification: [{ type: 'review', plannedPhase: 'PHASE-01', testIds: ['REV-VERTICAL-PROTOTYPE-044'] }],
});

// 44.1 Mindestens 80% interner Tester können nach einer Niederlage eine zutreffende Ursache nennen.
add({
  id: 'REQ-TEMP-K-0016', chapter: 44, locator: 'block:1483',
  title: 'Mindestens 80% interner Tester können nach einer Niederlage eine zutreffende Ursache nennen.',
  statement: 'Mindestens 80% interner Tester können nach einer Niederlage eine zutreffende Ursache nennen.',
  excerpt: 'Mindestens 80% interner Tester können nach einer Niederlage eine zutreffende Ursache nennen.',
  norm: 'MUST', category: 'UX',
  ownerPhases: ['PHASE-19'],
  verification: [{ type: 'manual', plannedPhase: 'PHASE-19', testIds: ['FQA-DEF-CAUSE-044'] }],
  numericConstraints: [{ kind: 'min', name: 'defeatCauseTestersPct', value: 80, unit: 'percent' }],
});

// 44.1 Mindestens 70% verändern vor einem Retry bewusst Formation, Doktrin, Einheit oder Ausrüstung.
add({
  id: 'REQ-TEMP-K-0017', chapter: 44, locator: 'block:1484',
  title: 'Mindestens 70% der Spieler verändern vor einem Retry bewusst Formation, Doktrin, Einheit oder Ausrüstung.',
  statement: 'Mindestens 70% verändern vor einem Retry bewusst Formation, Doktrin, Einheit oder Ausrüstung.',
  excerpt: 'Mindestens 70% verändern vor einem Retry bewusst Formation, Doktrin, Einheit oder Ausrüstung.',
  norm: 'MUST', category: 'UX',
  ownerPhases: ['PHASE-19'],
  verification: [{ type: 'manual', plannedPhase: 'PHASE-19', testIds: ['FQA-RETRY-ADAPT-044'] }],
  numericConstraints: [{ kind: 'min', name: 'retryAdaptTestersPct', value: 70, unit: 'percent' }],
});

// 44.1 Zielwechsel werden überwiegend als nachvollziehbar bewertet; keine wiederkehrenden sichtbaren KI-Aussetzer.
add({
  id: 'REQ-TEMP-K-0018', chapter: 44, locator: 'block:1485',
  title: 'Zielwechsel werden überwiegend als nachvollziehbar bewertet; es treten keine wiederkehrenden sichtbaren KI-Aussetzer auf.',
  statement: 'Zielwechsel werden überwiegend als nachvollziehbar bewertet; keine wiederkehrenden sichtbaren KI-Aussetzer.',
  excerpt: 'Zielwechsel werden überwiegend als nachvollziehbar bewertet; keine wiederkehrenden sichtbaren KI-Aussetzer.',
  norm: 'MUST', category: 'Sim',
  ownerPhases: ['PHASE-19'],
  verification: [{ type: 'manual', plannedPhase: 'PHASE-19', testIds: ['FQA-TARGETING-044'] }],
});

// 44.1 Der Aschenkönig ist ohne Entwicklererklärung nach Vorschau lernbar.
add({
  id: 'REQ-TEMP-K-0019', chapter: 44, locator: 'block:1486',
  title: 'Der Aschenkönig ist ohne Entwicklererklärung nach Vorschau lernbar.',
  statement: 'Der Aschenkönig ist ohne Entwicklererklärung nach Vorschau lernbar.',
  excerpt: 'Der Aschenkönig ist ohne Entwicklererklärung nach Vorschau lernbar.',
  norm: 'MUST', category: 'UX',
  ownerPhases: ['PHASE-19'],
  verification: [{ type: 'manual', plannedPhase: 'PHASE-19', testIds: ['FQA-BOSS-LEARNABLE-044'] }],
});

// 44.1 Kampf bei 3x bleibt lesbar und identisch im Ergebnis.
add({
  id: 'REQ-TEMP-K-0020', chapter: 44, locator: 'block:1487',
  title: 'Kampf bei 3x bleibt lesbar und identisch im Ergebnis.',
  statement: 'Kampf bei 3x bleibt lesbar und identisch im Ergebnis.',
  excerpt: 'Kampf bei 3x bleibt lesbar und identisch im Ergebnis.',
  norm: 'MUST', category: 'UX',
  ownerPhases: ['PHASE-08'],
  verification: [{ type: 'unit', plannedPhase: 'PHASE-08', testIds: ['UT-SPEED-3X-044'] }],
  numericConstraints: [{ kind: 'exact', name: 'speedMultiplierReadable', value: 3 }],
});

// 44.1 Mobile Zielhardware hält 60 FPS im Normalfall und mindestens 45 FPS bei maximaler Beschwörungs-/Effektlast; Simulation darf keine Ticks verlieren.
add({
  id: 'REQ-TEMP-K-0021', chapter: 44, locator: 'block:1488',
  title: 'Mobile Zielhardware hält 60 FPS im Normalfall und mindestens 45 FPS bei maximaler Beschwörungs- oder Effektlast; Simulation darf keine Ticks verlieren.',
  statement: 'Mobile Zielhardware hält 60 FPS im Normalfall und mindestens 45 FPS bei maximaler Beschwörungs- oder Effektlast; die Simulation darf keine Ticks verlieren.',
  excerpt: 'Mobile Zielhardware hält 60 FPS im Normalfall und mindestens 45 FPS bei maximaler Beschwörungs-/Effektlast; Simulation darf keine Ticks verlieren.',
  norm: 'MUST', category: 'Perf',
  ownerPhases: ['PHASE-21'],
  verification: [{ type: 'integration', plannedPhase: 'PHASE-21', testIds: ['PERF-MOBILE-FPS-044'] }],
  numericConstraints: [
    { kind: 'min', name: 'mobileFpsNormal', value: 60 },
    { kind: 'min', name: 'mobileFpsMaxLoad', value: 45 },
  ],
});

// =============== CHAPTER 45: Release-Abnahmekriterien ===============

// 45.1 20 Missionen vollständig spielbar, alle Erst-/Wiederholungsbelohnungen korrekt.
add({
  id: 'REQ-TEMP-K-0022', chapter: 45, locator: 'block:1495',
  title: '20 Missionen vollständig spielbar, alle Erst- und Wiederholungsbelohnungen korrekt.',
  statement: '20 Missionen vollständig spielbar, alle Erst- und Wiederholungsbelohnungen korrekt.',
  excerpt: '20 Missionen vollständig spielbar, alle Erst-/Wiederholungsbelohnungen korrekt.',
  norm: 'MUST', category: 'Content',
  ownerPhases: ['PHASE-10'],
  verification: [{ type: 'unit', plannedPhase: 'PHASE-10', testIds: ['GR-MISSIONS-045'] }],
  numericConstraints: [{ kind: 'exact', name: 'missionCount', value: 20 }],
});

// 45.1 10 Helden x 3 Level, 18 Truppen, 14 Beschwörungen, 28 Grundgegner, 12 Elites, 8 Champions, 4 Zwischen- und 4 Hauptbosse implementiert.
add({
  id: 'REQ-TEMP-K-0023', chapter: 45, locator: 'block:1496',
  title: 'Inhaltliche Mindestmenge implementiert: 10 Helden × 3 Stufen, 18 Truppen, 14 Beschwörungen, 28 Grundgegner, 12 Elites, 8 Champions, 4 Zwischen- und 4 Hauptbosse.',
  statement: '10 Helden x 3 Level, 18 Truppen, 14 Beschwörungen, 28 Grundgegner, 12 Elites, 8 Champions, 4 Zwischen- und 4 Hauptbosse implementiert.',
  excerpt: '10 Helden x 3 Level, 18 Truppen, 14 Beschwörungen, 28 Grundgegner, 12 Elites, 8 Champions, 4 Zwischen- und 4 Hauptbosse implementiert.',
  norm: 'MUST', category: 'Content',
  ownerPhases: ['PHASE-10'],
  verification: [{ type: 'unit', plannedPhase: 'PHASE-10', testIds: ['GR-CONTENT-COUNT-045'] }],
  numericConstraints: [
    { kind: 'exact', name: 'heroesCount', value: 10 },
    { kind: 'exact', name: 'heroLevels', value: 3 },
    { kind: 'exact', name: 'troopsCount', value: 18 },
    { kind: 'exact', name: 'summonsCount', value: 14 },
    { kind: 'exact', name: 'baseEnemiesCount', value: 28 },
    { kind: 'exact', name: 'eliteEnemiesCount', value: 12 },
    { kind: 'exact', name: 'championsCount', value: 8 },
    { kind: 'exact', name: 'intermediateBossesCount', value: 4 },
    { kind: 'exact', name: 'mainBossesCount', value: 4 },
  ],
});

// 45.1 42 permanente Gegenstände, 36 Relikte, 30 Ereignisse, 18 Modifikatoren, 7 Kampfvarianten vollständig.
add({
  id: 'REQ-TEMP-K-0024', chapter: 45, locator: 'block:1497',
  title: '42 permanente Gegenstände, 36 Relikte, 30 Ereignisse, 18 Modifikatoren und 7 Kampfvarianten vollständig.',
  statement: '42 permanente Gegenstände, 36 Relikte, 30 Ereignisse, 18 Modifikatoren, 7 Kampfvarianten vollständig.',
  excerpt: '42 permanente Gegenstände, 36 Relikte, 30 Ereignisse, 18 Modifikatoren, 7 Kampfvarianten vollständig.',
  norm: 'MUST', category: 'Content',
  ownerPhases: ['PHASE-10'],
  verification: [{ type: 'unit', plannedPhase: 'PHASE-10', testIds: ['GR-ITEM-COUNT-045'] }],
  numericConstraints: [
    { kind: 'exact', name: 'permanentItemsCount', value: 42 },
    { kind: 'exact', name: 'relicsCount', value: 36 },
    { kind: 'exact', name: 'eventsCount', value: 30 },
    { kind: 'exact', name: 'modifiersCount', value: 18 },
    { kind: 'exact', name: 'battleVariantsCount', value: 7 },
  ],
});

// 45.1 Ascension 1-10, 28 Konstellationsknoten, Jenseits 1-20, Endlose Rift und alle Meilensteine funktionieren offline.
add({
  id: 'REQ-TEMP-K-0025', chapter: 45, locator: 'block:1498',
  title: 'Ascension 1-10, 28 Konstellationsknoten, Jenseits 1-20, Endlose Rift und alle Meilensteine funktionieren offline.',
  statement: 'Ascension 1-10, 28 Konstellationsknoten, Jenseits 1-20, Endlose Rift und alle Meilensteine funktionieren offline.',
  excerpt: 'Ascension 1-10, 28 Konstellationsknoten, Jenseits 1-20, Endlose Rift und alle Meilensteine funktionieren offline.',
  norm: 'MUST', category: 'Content',
  ownerPhases: ['PHASE-10'],
  verification: [{ type: 'unit', plannedPhase: 'PHASE-10', testIds: ['GR-ENDGAME-OFFLINE-045'] }],
  numericConstraints: [
    { kind: 'exact', name: 'ascensionTiers', value: 10 },
    { kind: 'exact', name: 'constellationNodes', value: 28 },
    { kind: 'exact', name: 'beyondTiers', value: 20 },
  ],
});

// 45.1 50 Meisterschaftsziele, Kodex und 36 Erfolge vollständig prüfbar.
add({
  id: 'REQ-TEMP-K-0026', chapter: 45, locator: 'block:1499',
  title: '50 Meisterschaftsziele, Kodex und 36 Erfolge vollständig prüfbar.',
  statement: '50 Meisterschaftsziele, Kodex und 36 Erfolge vollständig prüfbar.',
  excerpt: '50 Meisterschaftsziele, Kodex und 36 Erfolge vollständig prüfbar.',
  norm: 'MUST', category: 'Content',
  ownerPhases: ['PHASE-10'],
  verification: [{ type: 'unit', plannedPhase: 'PHASE-10', testIds: ['GR-META-COUNT-045'] }],
  numericConstraints: [
    { kind: 'exact', name: 'masteryGoalsCount', value: 50 },
    { kind: 'exact', name: 'achievementsCount', value: 36 },
  ],
});

// 45.2 Keine nicht deterministische Abweichung bei identischem Seed und Snapshot.
add({
  id: 'REQ-TEMP-K-0027', chapter: 45, locator: 'block:1500',
  title: 'Keine nicht deterministische Abweichung bei identischem Seed und Snapshot.',
  statement: 'Keine nicht deterministische Abweichung bei identischem Seed und Snapshot.',
  excerpt: 'Keine nicht deterministische Abweichung bei identischem Seed und Snapshot.',
  norm: 'MUST_NOT', category: 'Sim',
  ownerPhases: ['PHASE-20'],
  verification: [{ type: 'unit', plannedPhase: 'PHASE-20', testIds: ['GR-DETERMINISM-045'] }],
});

// 45.2 Keine Endlosschleife durch Heilung, Wiederbelebung, Beschwörung oder unzugängliche Position.
add({
  id: 'REQ-TEMP-K-0028', chapter: 45, locator: 'block:1501',
  title: 'Keine Endlosschleife durch Heilung, Wiederbelebung, Beschwörung oder unzugängliche Position.',
  statement: 'Keine Endlosschleife durch Heilung, Wiederbelebung, Beschwörung oder unzugängliche Position.',
  excerpt: 'Keine Endlosschleife durch Heilung, Wiederbelebung, Beschwörung oder unzugängliche Position.',
  norm: 'MUST_NOT', category: 'Sim',
  ownerPhases: ['PHASE-08'],
  verification: [{ type: 'unit', plannedPhase: 'PHASE-08', testIds: ['UT-NO-INFINITE-LOOP-045'] }],
});

// 45.2 Keine Einheit oder Fähigkeit kann globale Gruppen-/Beschwörungsgrenzen umgehen.
add({
  id: 'REQ-TEMP-K-0029', chapter: 45, locator: 'block:1502',
  title: 'Keine Einheit oder Fähigkeit kann globale Gruppen- oder Beschwörungsgrenzen umgehen.',
  statement: 'Keine Einheit oder Fähigkeit kann globale Gruppen- oder Beschwörungsgrenzen umgehen.',
  excerpt: 'Keine Einheit oder Fähigkeit kann globale Gruppen-/Beschwörungsgrenzen umgehen.',
  norm: 'MUST_NOT', category: 'Sim',
  ownerPhases: ['PHASE-08'],
  verification: [{ type: 'unit', plannedPhase: 'PHASE-08', testIds: ['UT-NO-LIMIT-BYPASS-045'] }],
});

// 45.2 Alle strategisch relevanten Boss-/Modifikator-/Championfähigkeiten vor Kampf sichtbar.
add({
  id: 'REQ-TEMP-K-0030', chapter: 45, locator: 'block:1503',
  title: 'Alle strategisch relevanten Boss-, Modifikator- und Championfähigkeiten sind vor Kampf sichtbar.',
  statement: 'Alle strategisch relevanten Boss-, Modifikator- und Championfähigkeiten sind vor Kampf sichtbar.',
  excerpt: 'Alle strategisch relevanten Boss-/Modifikator-/Championfähigkeiten vor Kampf sichtbar.',
  norm: 'MUST', category: 'UX',
  ownerPhases: ['PHASE-08'],
  verification: [{ type: 'unit', plannedPhase: 'PHASE-08', testIds: ['UT-PRECOMBAT-VISIBILITY-045'] }],
});

// 45.2 Alle Käufe, Belohnungen, Saves und Migrationen sind crash- und duplikationssicher.
add({
  id: 'REQ-TEMP-K-0031', chapter: 45, locator: 'block:1504',
  title: 'Alle Käufe, Belohnungen, Saves und Migrationen sind crash- und duplikationssicher.',
  statement: 'Alle Käufe, Belohnungen, Saves und Migrationen sind crash- und duplikationssicher.',
  excerpt: 'Alle Käufe, Belohnungen, Saves und Migrationen sind crash- und duplikationssicher.',
  norm: 'MUST', category: 'Save',
  ownerPhases: ['PHASE-05'],
  verification: [{ type: 'unit', plannedPhase: 'PHASE-05', testIds: ['UT-CRASH-DUP-SAFE-045'] }],
});

// 45.2 Alle Kampfauswertungen und Hinweise basieren auf tatsächlichen Events.
add({
  id: 'REQ-TEMP-K-0032', chapter: 45, locator: 'block:1505',
  title: 'Alle Kampfauswertungen und Hinweise basieren auf tatsächlichen Events.',
  statement: 'Alle Kampfauswertungen und Hinweise basieren auf tatsächlichen Events.',
  excerpt: 'Alle Kampfauswertungen und Hinweise basieren auf tatsächlichen Events.',
  norm: 'MUST', category: 'UX',
  ownerPhases: ['PHASE-08'],
  verification: [{ type: 'unit', plannedPhase: 'PHASE-08', testIds: ['UT-EVAL-AUTHENTIC-045'] }],
});

// 45.3 Alle Kernflows mit Touch, Maus und Controller/Tastatur vollständig bedienbar.
add({
  id: 'REQ-TEMP-K-0033', chapter: 45, locator: 'block:1506',
  title: 'Alle Kernflows sind mit Touch, Maus und Controller/Tastatur vollständig bedienbar.',
  statement: 'Alle Kernflows mit Touch, Maus und Controller/Tastatur vollständig bedienbar.',
  excerpt: 'Alle Kernflows mit Touch, Maus und Controller/Tastatur vollständig bedienbar.',
  norm: 'MUST', category: 'A11y',
  ownerPhases: ['PHASE-12'],
  verification: [{ type: 'integration', plannedPhase: 'PHASE-12', testIds: ['IT-INPUT-MODES-045'] }],
});

// 45.3 Keine abgeschnittenen Texte bei 150% Textgröße auf unterstützten Mindestauflösungen.
add({
  id: 'REQ-TEMP-K-0034', chapter: 45, locator: 'block:1507',
  title: 'Keine abgeschnittenen Texte bei 150% Textgröße auf unterstützten Mindestauflösungen.',
  statement: 'Keine abgeschnittenen Texte bei 150% Textgröße auf unterstützten Mindestauflösungen.',
  excerpt: 'Keine abgeschnittenen Texte bei 150% Textgröße auf unterstützten Mindestauflösungen.',
  norm: 'MUST_NOT', category: 'A11y',
  ownerPhases: ['PHASE-12'],
  verification: [{ type: 'visual', plannedPhase: 'PHASE-12', testIds: ['VIS-TEXT-150-045'] }],
  numericConstraints: [{ kind: 'exact', name: 'textScaleTest', value: 150, unit: 'percent' }],
});

// 45.3 Alle Warnungen ohne Farbinformation verständlich; reduzierte Bewegung/Effekte funktionieren vollständig.
add({
  id: 'REQ-TEMP-K-0035', chapter: 45, locator: 'block:1508',
  title: 'Alle Warnungen sind ohne Farbinformation verständlich; reduzierte Bewegung und Effekte funktionieren vollständig.',
  statement: 'Alle Warnungen ohne Farbinformation verständlich; reduzierte Bewegung und Effekte funktionieren vollständig.',
  excerpt: 'Alle Warnungen ohne Farbinformation verständlich; reduzierte Bewegung/Effekte funktionieren vollständig.',
  norm: 'MUST', category: 'A11y',
  ownerPhases: ['PHASE-12'],
  verification: [{ type: 'integration', plannedPhase: 'PHASE-12', testIds: ['IT-A11Y-WARNINGS-045'] }],
});

// 45.3 App startet und alle Inhalte funktionieren im Flugmodus ohne Netzwerkdialog.
add({
  id: 'REQ-TEMP-K-0036', chapter: 45, locator: 'block:1509',
  title: 'App startet und alle Inhalte funktionieren im Flugmodus ohne Netzwerkdialog.',
  statement: 'App startet und alle Inhalte funktionieren im Flugmodus ohne Netzwerkdialog.',
  excerpt: 'App startet und alle Inhalte funktionieren im Flugmodus ohne Netzwerkdialog.',
  norm: 'MUST', category: 'Save',
  ownerPhases: ['PHASE-22'],
  verification: [{ type: 'integration', plannedPhase: 'PHASE-22', testIds: ['IT-AIRPLANE-MODE-045'] }],
});

// 45.3 Unterbrechung/Prozessbeendigung an jedem Knoten und in jedem Kampf führt zu gültigem Fortsetzen.
add({
  id: 'REQ-TEMP-K-0037', chapter: 45, locator: 'block:1510',
  title: 'Unterbrechung oder Prozessbeendigung an jedem Knoten und in jedem Kampf führt zu gültigem Fortsetzen.',
  statement: 'Unterbrechung oder Prozessbeendigung an jedem Knoten und in jedem Kampf führt zu gültigem Fortsetzen.',
  excerpt: 'Unterbrechung/Prozessbeendigung an jedem Knoten und in jedem Kampf führt zu gültigem Fortsetzen.',
  norm: 'MUST', category: 'Save',
  ownerPhases: ['PHASE-05'],
  verification: [{ type: 'unit', plannedPhase: 'PHASE-05', testIds: ['UT-INTERRUPT-RESUME-045'] }],
});

// 45.3 Keine Werbung, IAP, Accountpflicht, Trackingpflicht oder künstliche Wartezeit vorhanden.
add({
  id: 'REQ-TEMP-K-0038', chapter: 45, locator: 'block:1511',
  title: 'Keine Werbung, IAP, Accountpflicht, Trackingpflicht oder künstliche Wartezeit vorhanden.',
  statement: 'Keine Werbung, IAP, Accountpflicht, Trackingpflicht oder künstliche Wartezeit vorhanden.',
  excerpt: 'Keine Werbung, IAP, Accountpflicht, Trackingpflicht oder künstliche Wartezeit vorhanden.',
  norm: 'MUST_NOT', category: 'Store',
  ownerPhases: ['PHASE-22'],
  verification: [{ type: 'review', plannedPhase: 'PHASE-22', testIds: ['REV-NO-MONETIZATION-045'] }],
});

// =============== CHAPTER 46: Zielumfang, Spielzeit und Scope-Schutz ===============

// 46 Neue Inhalte nur, wenn sie eine erkennbare strategische Lücke schließen und keine Kernqualität gefährden.
add({
  id: 'REQ-TEMP-K-0039', chapter: 46, locator: 'block:1524',
  title: 'Neue Inhalte werden nur aufgenommen, wenn sie eine erkennbare strategische Lücke schließen und keine Kernqualität gefährden.',
  statement: 'Neue Inhalte dürfen nur aufgenommen werden, wenn sie eine erkennbare strategische Lücke schließen und keine Kernqualität gefährden.',
  excerpt: 'Neue Inhalte dürfen nur aufgenommen werden, wenn sie eine erkennbare strategische Lücke schließen und keine Kernqualität gefährden.',
  norm: 'MUST', category: 'Product',
  ownerPhases: ['PHASE-00'],
  verification: [{ type: 'review', plannedPhase: 'PHASE-00', testIds: ['REV-SCOPE-GATE-046'] }],
});

// 46 Vor Release werden keine weiteren Helden, Regionen, Hauptbosse, Talentbäume, Gegenstandsaffixe oder Onlinefunktionen ergänzt.
add({
  id: 'REQ-TEMP-K-0040', chapter: 46, locator: 'block:1524',
  title: 'Vor Release werden keine weiteren Helden, Regionen, Hauptbosse, Talentbäume, Gegenstandsaffixe oder Onlinefunktionen ergänzt.',
  statement: 'Vor Release werden keine weiteren Helden, Regionen, Hauptbosse, Talentbäume, Gegenstandsaffixe oder Onlinefunktionen ergänzt.',
  excerpt: 'Vor Release werden keine weiteren Helden, Regionen, Hauptbosse, Talentbäume, Gegenstandsaffixe oder Onlinefunktionen ergänzt.',
  norm: 'MUST_NOT', category: 'Product',
  ownerPhases: ['PHASE-00'],
  verification: [{ type: 'review', plannedPhase: 'PHASE-00', testIds: ['REV-NO-NEW-SCOPE-046'] }],
});

// 46 Ein späteres Update ist optional und nicht Bestandteil des Produktversprechens.
add({
  id: 'REQ-TEMP-K-0041', chapter: 46, locator: 'block:1524',
  title: 'Ein späteres Update ist optional und nicht Bestandteil des Produktversprechens.',
  statement: 'Ein späteres Update ist optional und nicht Bestandteil des Produktversprechens.',
  excerpt: 'Ein späteres Update ist optional und nicht Bestandteil des Produktversprechens.',
  norm: 'MUST', category: 'Product',
  ownerPhases: ['PHASE-00'],
  verification: [{ type: 'review', plannedPhase: 'PHASE-00', testIds: ['REV-NO-UPDATE-PROMISE-046'] }],
});

// 46.1 Priorität 1: Kampfsimulation, Zielwahl und Lesbarkeit.
add({
  id: 'REQ-TEMP-K-0042', chapter: 46, locator: 'block:1527',
  title: 'Priorität 1 unter Produktionsdruck: Kampfsimulation, Zielwahl und Lesbarkeit.',
  statement: 'Priorität 1 unter Produktionsdruck: Kampfsimulation, Zielwahl und Lesbarkeit.',
  excerpt: 'Kampfsimulation, Zielwahl und Lesbarkeit.',
  norm: 'MUST', category: 'Product',
  ownerPhases: ['PHASE-00'],
  verification: [{ type: 'review', plannedPhase: 'PHASE-00', testIds: ['REV-PRIO-1-046'] }],
});

// 46.1 Priorität 2: Vollständige Kampagne inklusive vier Bosse.
add({
  id: 'REQ-TEMP-K-0043', chapter: 46, locator: 'block:1528',
  title: 'Priorität 2 unter Produktionsdruck: vollständige Kampagne inklusive vier Bosse.',
  statement: 'Priorität 2 unter Produktionsdruck: vollständige Kampagne inklusive vier Bosse.',
  excerpt: 'Vollständige Kampagne inklusive vier Bosse.',
  norm: 'MUST', category: 'Product',
  ownerPhases: ['PHASE-00'],
  verification: [{ type: 'review', plannedPhase: 'PHASE-00', testIds: ['REV-PRIO-2-046'] }],
  numericConstraints: [{ kind: 'exact', name: 'campaignBossCount', value: 4 }],
});

// 46.1 Priorität 3: Formation, Doktrinen, Helden/Truppen und Ausrüstung.
add({
  id: 'REQ-TEMP-K-0044', chapter: 46, locator: 'block:1529',
  title: 'Priorität 3 unter Produktionsdruck: Formation, Doktrinen, Helden/Truppen und Ausrüstung.',
  statement: 'Priorität 3 unter Produktionsdruck: Formation, Doktrinen, Helden/Truppen und Ausrüstung.',
  excerpt: 'Formation, Doktrinen, Helden/Truppen und Ausrüstung.',
  norm: 'MUST', category: 'Product',
  ownerPhases: ['PHASE-00'],
  verification: [{ type: 'review', plannedPhase: 'PHASE-00', testIds: ['REV-PRIO-3-046'] }],
});

// 46.1 Priorität 4: Savegame, Offlinequalität, Bedienung und Barrierefreiheit.
add({
  id: 'REQ-TEMP-K-0045', chapter: 46, locator: 'block:1530',
  title: 'Priorität 4 unter Produktionsdruck: Savegame, Offlinequalität, Bedienung und Barrierefreiheit.',
  statement: 'Priorität 4 unter Produktionsdruck: Savegame, Offlinequalität, Bedienung und Barrierefreiheit.',
  excerpt: 'Savegame, Offlinequalität, Bedienung und Barrierefreiheit.',
  norm: 'MUST', category: 'Product',
  ownerPhases: ['PHASE-00'],
  verification: [{ type: 'review', plannedPhase: 'PHASE-00', testIds: ['REV-PRIO-4-046'] }],
});

// 46.1 Priorität 5: Ascension 1-10 und Konstellation.
add({
  id: 'REQ-TEMP-K-0046', chapter: 46, locator: 'block:1531',
  title: 'Priorität 5 unter Produktionsdruck: Ascension 1-10 und Konstellation.',
  statement: 'Priorität 5 unter Produktionsdruck: Ascension 1-10 und Konstellation.',
  excerpt: 'Ascension 1-10 und Konstellation.',
  norm: 'MUST', category: 'Product',
  ownerPhases: ['PHASE-00'],
  verification: [{ type: 'review', plannedPhase: 'PHASE-00', testIds: ['REV-PRIO-5-046'] }],
  numericConstraints: [{ kind: 'exact', name: 'ascensionMax', value: 10 }],
});

// 46.1 Priorität 6: Endlose Rift, Meisterschaften, Kodex, Erfolge.
add({
  id: 'REQ-TEMP-K-0047', chapter: 46, locator: 'block:1532',
  title: 'Priorität 6 unter Produktionsdruck: Endlose Rift, Meisterschaften, Kodex und Erfolge.',
  statement: 'Priorität 6 unter Produktionsdruck: Endlose Rift, Meisterschaften, Kodex und Erfolge.',
  excerpt: 'Endlose Rift, Meisterschaften, Kodex, Erfolge.',
  norm: 'MUST', category: 'Product',
  ownerPhases: ['PHASE-00'],
  verification: [{ type: 'review', plannedPhase: 'PHASE-00', testIds: ['REV-PRIO-6-046'] }],
});

// 46.1 Priorität 7: Zusätzliche Kosmetik und Dialogvarianten.
add({
  id: 'REQ-TEMP-K-0048', chapter: 46, locator: 'block:1533',
  title: 'Priorität 7 unter Produktionsdruck: zusätzliche Kosmetik und Dialogvarianten.',
  statement: 'Priorität 7 unter Produktionsdruck: zusätzliche Kosmetik und Dialogvarianten.',
  excerpt: 'Zusätzliche Kosmetik und Dialogvarianten.',
  norm: 'MAY', category: 'Product',
  ownerPhases: ['PHASE-00'],
  verification: [{ type: 'review', plannedPhase: 'PHASE-00', testIds: ['REV-PRIO-7-046'] }],
});

// 46.1 Bei Scope-Reduktion zuerst kosmetische Varianten und optionale Textvarianten kürzen, niemals Bosslesbarkeit, vollständige Fähigkeiten, Save-Sicherheit oder notwendige Gegenstrategien.
add({
  id: 'REQ-TEMP-K-0049', chapter: 46, locator: 'block:1534',
  title: 'Bei Scope-Reduktion werden zuerst kosmetische Varianten und optionale Textvarianten gekürzt, niemals Bosslesbarkeit, vollständige Fähigkeiten, Save-Sicherheit oder notwendige Gegenstrategien.',
  statement: 'Wird Scope reduziert, werden zuerst kosmetische Varianten und optionale Textvarianten gekürzt; niemals Bosslesbarkeit, vollständige Fähigkeiten, Save-Sicherheit oder notwendige Gegenstrategien.',
  excerpt: 'Wird Scope reduziert, werden zuerst kosmetische Varianten und optionale Textvarianten gekürzt, niemals Bosslesbarkeit, vollständige Fähigkeiten, Save-Sicherheit oder notwendige Gegenstrategien.',
  norm: 'MUST', category: 'Product',
  ownerPhases: ['PHASE-00'],
  verification: [{ type: 'review', plannedPhase: 'PHASE-00', testIds: ['REV-SCOPE-CUT-RULES-046'] }],
});

// =============== CHAPTER 47: Definition der vollständigen inhaltlichen Zielversion ===============

// 47 Definition of done: Auto RPG Roguelite ist releasebereit, wenn der Spieler eine ungewöhnliche Gruppe aufbauen, Gegner vollständig verstehen, einen Plan formulieren und automatisch umsetzen kann; Siege/Niederlagen erklärbar; Kampagne abgeschlossen; Endgame substanziell; Präsentation poliert; jede Funktion vollständig offline nutzbar.
add({
  id: 'REQ-TEMP-K-0050', chapter: 47, locator: 'block:1540',
  title: 'Riftwarden ist releasebereit, wenn der Spieler eine ungewöhnliche Gruppe aufbauen, Gegner vollständig verstehen, einen Plan durch Formation/Doktrin/Ausrüstung formulieren und automatisch umsetzen sehen kann; Siege und Niederlagen sind erklärbar; die Kampagne ist abgeschlossen; das Endgame ist substanziell; die Präsentation ist poliert; jede Funktion ist vollständig offline nutzbar.',
  statement: 'Riftwarden: Auto RPG Roguelite ist releasebereit, wenn der Spieler eine ungewöhnliche Gruppe aufbauen, Gegner vollständig verstehen, einen Plan durch Formation/Doktrin/Ausrüstung formulieren und anschließend klar beobachten kann, wie dieser Plan automatisch umgesetzt wird. Siege und Niederlagen müssen erklärbar sein. Die Kampagne muss abgeschlossen, das Endgame substanziell, die Präsentation poliert und jede Funktion vollständig offline nutzbar sein.',
  excerpt: 'Riftwarden: Auto RPG Roguelite ist releasebereit, wenn der Spieler eine ungewöhnliche Gruppe aufbauen, Gegner vollständig verstehen, einen Plan durch Formation/Doktrin/Ausrüstung formulieren und anschließend klar beobachten kann, wie dieser Plan automatisch umgesetzt wird. Siege und Niederlagen müssen erklärbar sein. Die Kampagne muss abgeschlossen, das Endgame substanziell, die Präsentation poliert und jede Funktion vollständig offline nutzbar sein.',
  norm: 'MUST', category: 'Product',
  ownerPhases: ['PHASE-22'],
  verification: [{ type: 'review', plannedPhase: 'PHASE-22', testIds: ['REV-DEFINITION-OF-DONE-047'] }],
});

// 47 Zentrale Qualitätsfrage: Kann der Spieler erkennen, welche Vorbereitung zu welchem Kampfverhalten und welchem Ergebnis geführt hat? Wenn nicht eindeutig, zuerst Lesbarkeit oder Regeldefinition verbessern, nicht zusätzlichen Content ergänzen.
add({
  id: 'REQ-TEMP-K-0051', chapter: 47, locator: 'block:1541',
  title: 'Zentrale Qualitätsfrage: "Kann der Spieler erkennen, welche Vorbereitung zu welchem Kampfverhalten und welchem Ergebnis geführt hat?" Ist die Antwort nicht eindeutig, muss zuerst Lesbarkeit oder Regeldefinition verbessert werden, nicht zusätzlicher Content ergänzt werden.',
  statement: 'Die zentrale Qualitätsfrage lautet bei jeder Implementierungsentscheidung: "Kann der Spieler erkennen, welche Vorbereitung zu welchem Kampfverhalten und welchem Ergebnis geführt hat?" Ist die Antwort nicht eindeutig, muss zuerst Lesbarkeit oder Regeldefinition verbessert werden, nicht zusätzlicher Content ergänzt.',
  excerpt: 'Die zentrale Qualitätsfrage lautet bei jeder Implementierungsentscheidung: „Kann der Spieler erkennen, welche Vorbereitung zu welchem Kampfverhalten und welchem Ergebnis geführt hat?" Ist die Antwort nicht eindeutig, muss zuerst Lesbarkeit oder Regeldefinition verbessert werden, nicht zusätzlicher Content ergänzt.',
  norm: 'MUST', category: 'Product',
  ownerPhases: ['PHASE-00'],
  verification: [{ type: 'review', plannedPhase: 'PHASE-00', testIds: ['REV-CORE-QUALITY-047'] }],
});

// =============== Build output ===============

const chaptersWithReqs = new Set(requirements.map((r) => r.source.chapter));
const contextOnly = [];
for (let ch = 42; ch <= 47; ch += 1) {
  if (!chaptersWithReqs.has(ch)) {
    contextOnly.push({
      chapter: ch,
      reason: `Chapter ${ch} wurde im Chunk gelesen, lieferte jedoch keine eigenständigen atomaren normativen Aussagen über die bereits erfassten hinaus.`,
    });
  }
}

const out = {
  schemaVersion: '1.0',
  chunk: 'k',
  chapterRange: { lo: 42, hi: 47 },
  requirements,
  contextOnly,
};

const outPath = 'docs/requirements/requirements/_staging/chunk-k.json';
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, JSON.stringify(out, null, 2) + '\n', 'utf8');
console.log(`Wrote ${requirements.length} requirements to ${outPath}`);
console.log(`Context-only chapters: ${contextOnly.length}`);