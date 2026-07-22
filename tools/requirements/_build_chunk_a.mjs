#!/usr/bin/env node
// Throwaway: build chunk-a.json (P00-T02a) and clean up after.
// REQ data is inline as compact tuples. Hashes computed at build time.
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { unlink } from 'node:fs/promises';

function sha(t) { return 'sha256:' + createHash('sha256').update(t, 'utf8').digest('hex'); }

const REQS = [];
const CTX = [];

function add(req) { REQS.push(req); }

// tuple: [ch, loc, norm, cat, owner, planned, testId, excerpt, stmt, numConstraints?]
function make(t) {
  const [ch, loc, norm, cat, owner, planned, testId, excerpt, stmt, num] = t;
  const ownerPhases = owner.split(',').map(s=>s.trim()).filter(Boolean);
  const testIds = testId.split(',').map(s=>s.trim()).filter(Boolean);
  const verification = [{ type: 'unit', plannedPhase: planned, testIds }];
  const numericConstraints = [];
  if (num) for (const part of num.split(';').map(s=>s.trim()).filter(Boolean)) {
    const [unit, expr, target] = part.split('|').map(s=>s.trim());
    const obj = { unit };
    if (expr.includes('..')) { const [lo,hi] = expr.split('..').map(Number); obj.min=lo; obj.max=hi; }
    else if (expr.startsWith('min:')) obj.min = Number(expr.slice(4));
    else if (expr.startsWith('max:')) obj.max = Number(expr.slice(4));
    else obj.value = Number(expr);
    if (target) obj.target = target;
    numericConstraints.push(obj);
  }
  return {
    statement: stmt, norm, category: cat,
    source: { sourceId: 'gdd-v5', chapter: ch, section: null, locator: loc, quoteHash: sha(excerpt), originalExcerpt: excerpt },
    ownerPhases, verification, numericConstraints,
  };
}

// ============= CHAPTER 1 =============
{
  const E = {
    A:'Ein Agent darf keine nicht beschriebenen Kernmechaniken ergänzen, keine festgelegten Obergrenzen aufweichen, keine manuelle Kampfsteuerung einführen und keine technische Grundsatzentscheidung eigenmächtig austauschen.',
    B:'Strategisch relevante Informationen werden vor dem Kampf angezeigt; keine Begegnung beruht auf einer tödlichen Überraschung.',
    C:'Die Zielversion bleibt klein genug für ein hochpoliertes Premiumspiel.',
    D:'Inhaltlich vollständig: Alle Release-Inhalte, Freischaltungen, Rollen und Interaktionen sind benannt.',
    E2:'Systemisch vollständig: Trigger, Prioritäten, Dauer, Stapelung, Abbruch und Sonderfälle sind definiert.',
    F:'Balancingfähig: Jede numerische Baseline besitzt eine klare Funktion und kann datengetrieben angepasst werden.',
    G:'Testbar: Jedes kritische System enthält beobachtbare Abnahmekriterien.',
    H:'Rechtsberatung, verbindliche Steuer- oder Unternehmensentscheidungen und die endgültige Inhaberidentität für Storekonten; diese bleiben beim Publisher.',
    I:'Die konkrete künstlerische Herstellungsmethode einzelner Assets; Dateiverträge, Formate, Größen, Namensregeln und Qualitätskriterien sind jedoch festgelegt.',
    J:'Unveränderliche Pixelpositionen für jedes existierende und zukünftige Gerät; verbindlich sind responsive Regeln, Design-Tokens, Mindestgrößen und Referenzlayouts.',
    K:'Finale Übersetzungstexte aller Dialogvarianten; verbindlich sind Funktion, Ton und maximale Textmenge.',
    L:'Unveränderliche Endbalance. Die Baseline ist implementierbar, muss aber nach deterministischen Simulationen und internen Playtests innerhalb der dokumentierten Korridore abgestimmt werden.',
  };
  add(make([1,'block:12','MUST_NOT','Product','PHASE-00','PHASE-01','GR-PHASE00-001',E.A,'Es dürfen keine nicht beschriebenen Kernmechaniken ergänzt werden.']));
  add(make([1,'block:12','MUST_NOT','Product','PHASE-00','PHASE-01','GR-PHASE00-002',E.A,'Festgelegte Obergrenzen dürfen nicht aufgeweicht werden.']));
  add(make([1,'block:12','MUST_NOT','Sim','PHASE-08','PHASE-08','PT-PHASE08-001',E.A,'Es darf keine manuelle Kampfsteuerung eingeführt werden.']));
  add(make([1,'block:12','MUST_NOT','Product','PHASE-00','PHASE-01','GR-PHASE00-003',E.A,'Technische Grundsatzentscheidungen dürfen nicht eigenmächtig ausgetauscht werden.']));
  add(make([1,'block:12','MUST','UX','PHASE-08','PHASE-08','UT-PHASE08-001',E.B,'Strategisch relevante Informationen werden vor dem Kampf angezeigt.']));
  add(make([1,'block:12','MUST_NOT','Product','PHASE-08','PHASE-08','UT-PHASE08-002',E.B,'Keine Begegnung darf auf einer tödlichen Überraschung beruhen.']));
  add(make([1,'block:12','MUST','Product','PHASE-00','PHASE-01','GR-PHASE00-004',E.C,'Die Zielversion muss klein genug für ein hochpoliertes Premiumspiel bleiben.']));
  add(make([1,'block:12','MUST','Content','PHASE-10','PHASE-10','GR-PHASE10-001',E.D,'Alle Release-Inhalte, Freischaltungen, Rollen und Interaktionen müssen benannt sein.']));
  add(make([1,'block:12','MUST','Sim','PHASE-08','PHASE-08','PT-PHASE08-002',E.E2,'Trigger, Prioritäten, Dauer, Stapelung, Abbruch und Sonderfälle müssen für jedes System definiert sein.']));
  add(make([1,'block:12','MUST','QA','PHASE-20','PHASE-20','GR-PHASE20-001',E.F,'Jede numerische Baseline muss eine klare Funktion besitzen und datengetrieben anpassbar sein.']));
  add(make([1,'block:12','MUST','QA','PHASE-20','PHASE-20','GR-PHASE20-002',E.G,'Jedes kritische System muss beobachtbare Abnahmekriterien enthalten.']));
  add(make([1,'block:21','MUST_NOT','Product','PHASE-00','PHASE-00','GR-PHASE00-005',E.H,'Rechts-, Steuer- und Inhaberfragen bleiben beim Publisher und sind nicht Inhalt der Implementierung.']));
  add(make([1,'block:22','MUST','Content','PHASE-15','PHASE-15','GR-PHASE15-001',E.I,'Dateiverträge, Formate, Größen, Namensregeln und Qualitätskriterien für Assets sind verbindlich festgelegt.']));
  add(make([1,'block:23','MUST','UX','PHASE-15','PHASE-15','VIS-PHASE15-001',E.J,'Verbindlich sind responsive Regeln, Design-Tokens, Mindestgrößen und Referenzlayouts; Pixelpositionen pro Gerät sind nicht verbindlich.']));
  add(make([1,'block:24','MUST','Content','PHASE-60','PHASE-60','GR-PHASE60-001',E.K,'Verbindlich sind Funktion, Ton und maximale Textmenge für Übersetzungen.']));
  add(make([1,'block:25','MUST','QA','PHASE-20','PHASE-20','GR-PHASE20-003',E.L,'Die Endbalance muss nach deterministischen Simulationen und internen Playtests innerhalb der dokumentierten Korridore abgestimmt werden.']));
}

// ============= CHAPTER 2 =============
{
  const E = {
    A:'Riftwarden: Auto RPG Roguelite ist ein kompaktes Fantasy-Roguelite mit vollständig automatischen Gruppenkämpfen in stilisierter Seitenansicht.',
    B:'Während eines Kampfes werden keine Fähigkeiten manuell ausgelöst und keine Einheiten bewegt.',
    C:'Ein regulärer Kampf dauert normalerweise 20-45 Sekunden, ein Elitekampf 35-60 Sekunden und ein Bosskampf 60-100 Sekunden auf normaler Geschwindigkeit.',
    D:'Das Spiel erzeugt keinerlei Fortschritt ohne aktives Spielen. Es gibt keine Energie, Wartezeit, Offline-Erträge, Tagesaufgaben oder Live-Service-Abhängigkeit.',
    E:'Eine verlorene Expedition kostet einen Teil der ungesicherten Beute, aber niemals Helden, Verträge oder bereits freigeschaltete permanente Systeme.',
    F:'Die Kampagne ist abgeschlossen und rechtfertigt den Kauf allein. Ascension und Endlose Rift sind substanzielle Endgame-Modi, keine Ausrede für fehlenden Kampagneninhalt.',
    G:'[["Inhaltsgruppe","Release-Ziel"],["Kampagne","4 Akte, je 5 Expeditionen, insgesamt 20 klar definierte Missionen"],["Helden","10 einzigartige Helden, jeweils Level 1-3 und 5 Meisterschaftsziele"],["Truppen","18 Verträge, jeweils bis zu 3 gleichzeitig einsetzbare Kopien"],["Beschwörungen","14 fest definierte Beschwörungstypen; maximal 6 aktive pro Seite"],["Regionen","4 Regionen mit je 7 Grundgegnern, regionalen Regeln und eigenem Hauptboss"],["Zwischenbosse","4 feste Zwischenbosse plus Elite- und Championvarianten"],["Ausrüstung","42 permanente Objekte: 12 Hauptausrüstungen, 12 Talismane, 12 Truppenkits, 6 Banner"],["Relikte","36 temporäre Relikte für Expeditionen/Ascension"],["Ereignisse","30 vollständige Ereignisse mit transparenten Optionen"],["Schlachtfeld","7 Kampfvarianten und 18 sichtbare Modifikatoren"],["Endgame","10 kuratierte Ascension-Ränge, 28 Konstellationsknoten, Jenseits-Modus und Endlose Rift"],["Meta","Kodex, 36 interne Erfolge, lokale Rekorde, kosmetische Freischaltungen"]]',
  };
  add(make([2,'block:31','MUST','Product','PHASE-10','PHASE-10','GR-PHASE10-002',E.A,'Das Produkt ist ein kompaktes Fantasy-Roguelite mit vollständig automatischen Gruppenkämpfen in stilisierter Seitenansicht.']));
  add(make([2,'block:31','MUST_NOT','Sim','PHASE-08','PHASE-08','PT-PHASE08-003',E.B,'Während eines Kampfes dürfen keine Fähigkeiten manuell ausgelöst und keine Einheiten bewegt werden.']));
  add(make([2,'block:32','MUST','Sim','PHASE-08','PHASE-08','PT-PHASE08-004',E.C,'Ein regulärer Kampf dauert 20-45 Sekunden auf normaler Geschwindigkeit.','s|20..45|regular_fight_duration']));
  add(make([2,'block:32','MUST','Sim','PHASE-08','PHASE-08','PT-PHASE08-005',E.C,'Ein Elitekampf dauert 35-60 Sekunden auf normaler Geschwindigkeit.','s|35..60|elite_fight_duration']));
  add(make([2,'block:32','MUST','Sim','PHASE-08','PHASE-08','PT-PHASE08-006',E.C,'Ein Bosskampf dauert 60-100 Sekunden auf normaler Geschwindigkeit.','s|60..100|boss_fight_duration']));
  add(make([2,'block:33','MUST_NOT','Product','PHASE-10','PHASE-10','GR-PHASE10-003',E.D,'Das Spiel darf keinerlei Fortschritt ohne aktives Spielen erzeugen.']));
  add(make([2,'block:33','MUST_NOT','Product','PHASE-10','PHASE-10','GR-PHASE10-004',E.D,'Es dürfen keine Energie, Wartezeit, Offline-Erträge, Tagesaufgaben oder Live-Service-Abhängigkeit existieren.']));
  add(make([2,'block:34','MUST_NOT','Save','PHASE-12','PHASE-12','IT-PHASE12-001',E.E,'Eine verlorene Expedition darf niemals Helden, Verträge oder bereits freigeschaltete permanente Systeme kosten.']));
  add(make([2,'block:35','MUST','Product','PHASE-00','PHASE-01','GR-PHASE00-006',E.F,'Die Kampagne muss abgeschlossen sein und den Kauf allein rechtfertigen.']));
  add(make([2,'block:38','MUST','Content','PHASE-10','PHASE-10','GR-PHASE10-005',E.G,'Die Release-Inhaltsgruppe muss die definierten Zielmengen erfüllen.']));
  add(make([2,'block:38','MUST','Sim','PHASE-08','PHASE-08','PT-PHASE08-007',E.G,'Maximal 6 Beschwörungen sind pro Seite gleichzeitig aktiv.','count|max:6|summon_active_limit']));
  add(make([2,'block:38','MUST','Content','PHASE-08','PHASE-08','PT-PHASE08-008',E.G,'Pro Truppentyp dürfen maximal 3 Kopien gleichzeitig eingesetzt werden.','count|max:3|troop_copy_limit']));
}

// ============= CHAPTER 3 =============
{
  const E = {
    A:'Jeder Sieg muss auf Formation, Rollen, Zielwahl, Doktrin oder Ausrüstung zurückführbar sein.',
    B:'Einheiten handeln deterministisch nachvollziehbar; wichtige Zielwechsel und Trigger sind sichtbar.',
    C:'Kontakt, Entwicklung, Wendepunkt und Abschluss sind in jedem Kampf erkennbar.',
    D:'Tiefe entsteht aus Interaktionen, nicht aus hunderten austauschbaren Einheiten.',
    E:'Risiken und mögliche Folgen sind sichtbar; Scheitern erzeugt Lernwert statt irreversiblem Verlust.',
    F:'Kein System darf als halbfertige Checkliste existieren. Lieber weniger Inhalte, aber vollständige Rückmeldung.',
    G:'Nicht Teil der Zielversion sind: manuelle Kampffähigkeiten, aktives Zielen, PvP, Online-Ranglisten, Accounts, Gilden, Chat, Cloud-Zwang, Live-Events, tägliche Aufgaben, saisonale Inhalte, Basisbau, offene Welt, frei begehbare Dungeons, weit verzweigte Dialogbäume, permanente Heldentode, Verletzungen zwischen Kämpfen, Ausdauer/Hunger, Waffenverschleiß, zufällige Gegenstandsaffixe, unbegrenzte Charakterlevel und Echtgeldshops.',
  };
  add(make([3,'block:44','MUST','Product','PHASE-10','PHASE-10','GR-PHASE10-006',E.A,'Jeder Sieg muss auf Formation, Rollen, Zielwahl, Doktrin oder Ausrüstung zurückführbar sein.']));
  add(make([3,'block:44','MUST','Sim','PHASE-08','PHASE-08','UT-PHASE08-003',E.B,'Einheiten müssen deterministisch nachvollziehbar handeln; wichtige Zielwechsel und Trigger müssen sichtbar sein.']));
  add(make([3,'block:44','MUST','Product','PHASE-10','PHASE-10','GR-PHASE10-007',E.C,'Kontakt, Entwicklung, Wendepunkt und Abschluss müssen in jedem Kampf erkennbar sein.']));
  add(make([3,'block:44','MUST','Product','PHASE-00','PHASE-01','GR-PHASE00-007',E.D,'Tiefe muss aus Interaktionen entstehen, nicht aus einer großen Zahl austauschbarer Einheiten.']));
  add(make([3,'block:44','MUST','Product','PHASE-10','PHASE-10','GR-PHASE10-008',E.E,'Risiken und mögliche Folgen müssen sichtbar sein; Scheitern muss Lernwert statt irreversiblem Verlust erzeugen.']));
  add(make([3,'block:44','MUST','Product','PHASE-10','PHASE-10','GR-PHASE10-009',E.F,'Kein System darf als halbfertige Checkliste existieren; weniger Inhalte mit vollständiger Rückmeldung sind zu bevorzugen.']));
  add(make([3,'block:45','MUST_NOT','Product','PHASE-00','PHASE-00','GR-PHASE00-008',E.G,'Manuelle Kampffähigkeiten, aktives Zielen, PvP, Online-Ranglisten, Accounts, Gilden, Chat, Cloud-Zwang, Live-Events, tägliche Aufgaben, saisonale Inhalte, Basisbau, offene Welt, frei begehbare Dungeons, weit verzweigte Dialogbäume, permanente Heldentode, Verletzungen zwischen Kämpfen, Ausdauer/Hunger, Waffenverschleiß, zufällige Gegenstandsaffixe, unbegrenzte Charakterlevel und Echtgeldshops sind nicht Teil der Zielversion.']));
}

// ============= CHAPTER 4 =============
{
  const E = {
    A:'Der Riftanker bindet jede Expedition an das Hauptquartier.',
    B:'Nach einem Sieg rekonstruiert er alle gefallenen regulären Einheiten, heilt die Gruppe vollständig, entfernt normale Statuswirkungen und löscht Kampf-Beschwörungen.',
    C:'Wenn keine reguläre Einheit der Spielergruppe kampffähig bleibt, bricht die Verbindung zusammen und die Expedition endet.',
    D:'Die Rückkehr nach einer Niederlage ist erzählerisch eine Notrekonstruktion und kein Tod.',
    E2:'Der Anker ist die zentrale visuelle Metapher für Speichern, Rückkehr, Ascension und Endlose Rift.',
    F:'Der Spielercharakter bleibt unsichtbar, unbenannt und ohne festgelegtes Geschlecht. Figuren sprechen den Spieler als Riftwarden oder Kommandant an. Entscheidungen werden durch Missions-, Routen- und Ereigniswahl getroffen. Es existiert kein Dialograd und keine moralische Statistik.',
    G:'Pip spricht in maximal zwei kurzen Sätzen am Stück, erklärt nie bereits sichtbare Informationen doppelt und unterbricht keine wiederholten Kämpfe. Humor: selbstüberschätzend, neugierig, freundlich, nie zynisch.',
    H:'Kein Blut, keine Wunden, keine Zerstückelung, keine Leichen, keine realistischen Todesschreie.',
    I:'Besiegte Figuren zerfallen in Echofunken, Rauch, Blätter, Metallteile oder humorvolle Knochenhaufen.',
    J:'Keine harte Vulgärsprache, sexualisierten Inhalte, realen politischen/religiösen Konflikte oder diskriminierenden Aussagen.',
    K:'Humor darf Bossauftritte, Ereignisse und Animationen auflockern, aber taktische Konsequenzen bleiben ernst und lesbar.',
  };
  add(make([4,'block:49','MUST','Content','PHASE-10','PHASE-10','GR-PHASE10-010',E.A,'Der Riftanker bindet jede Expedition an das Hauptquartier.']));
  add(make([4,'block:51','MUST','Sim','PHASE-08','PHASE-08','PT-PHASE08-009',E.B,'Nach einem Sieg rekonstruiert der Anker alle gefallenen regulären Einheiten, heilt die Gruppe vollständig, entfernt normale Statuswirkungen und löscht Kampf-Beschwörungen.']));
  add(make([4,'block:52','MUST','Sim','PHASE-08','PHASE-08','PT-PHASE08-010',E.C,'Wenn keine reguläre Einheit der Spielergruppe kampffähig bleibt, bricht die Verbindung zusammen und die Expedition endet.']));
  add(make([4,'block:54','MUST','Content','PHASE-10','PHASE-10','GR-PHASE10-011',E.D,'Die Rückkehr nach einer Niederlage ist erzählerisch eine Notrekonstruktion und kein Tod.']));
  add(make([4,'block:55','MUST','UX','PHASE-10','PHASE-10','GR-PHASE10-012',E.E2,'Der Riftanker ist die zentrale visuelle Metapher für Speichern, Rückkehr, Ascension und Endlose Rift.']));
  add(make([4,'block:57','MUST','Product','PHASE-10','PHASE-10','GR-PHASE10-013',E.F,'Der Spielercharakter bleibt unsichtbar, unbenannt und ohne festgelegtes Geschlecht.']));
  add(make([4,'block:57','MUST_NOT','Content','PHASE-10','PHASE-10','GR-PHASE10-014',E.F,'Es existiert kein Dialograd und keine moralische Statistik.']));
  add(make([4,'block:60','MUST','UX','PHASE-15','PHASE-15','UT-PHASE15-002',E.G,'Pip spricht in maximal zwei kurzen Sätzen am Stück.','sentences|max:2|pip_max_sentences']));
  add(make([4,'block:60','MUST_NOT','UX','PHASE-15','PHASE-15','UT-PHASE15-003',E.G,'Pip darf bereits sichtbare Informationen nicht doppelt erklären und keine wiederholten Kämpfe unterbrechen.']));
  add(make([4,'block:75','MUST_NOT','Content','PHASE-15','PHASE-15','GR-PHASE15-003',E.H,'Es dürfen kein Blut, keine Wunden, keine Zerstückelung, keine Leichen und keine realistischen Todesschreie gezeigt werden.']));
  add(make([4,'block:75','MUST','Content','PHASE-15','PHASE-15','GR-PHASE15-004',E.I,'Besiegte Figuren zerfallen in Echofunken, Rauch, Blätter, Metallteile oder humorvolle Knochenhaufen.']));
  add(make([4,'block:76','MUST_NOT','Content','PHASE-15','PHASE-15','GR-PHASE15-005',E.J,'Es dürfen keine harte Vulgärsprache, sexualisierten Inhalte, realen politischen/religiösen Konflikte oder diskriminierenden Aussagen vorhanden sein.']));
  add(make([4,'block:77','MUST','UX','PHASE-15','PHASE-15','GR-PHASE15-006',E.K,'Humor darf Bossauftritte, Ereignisse und Animationen auflockern; taktische Konsequenzen bleiben ernst und lesbar.']));
}

// ============= CHAPTER 5 =============
{
  const E = {
    A:'[["Phase","Verbindliche Handlung","Zielzeit"],["Hauptquartier","Freischaltungen prüfen, Helden/Verträge/Ausrüstung verwalten, Mission wählen","1-4 Minuten"],["Expeditionsvorbereitung","Mission, Gegnerrollen, Belohnungen und Regeln lesen; Startgruppe festlegen","1-3 Minuten"],["Dungeonkarte","Zwischen 5 und 8 Knoten besuchen; Route, Ereignisse, Händler und Risiko wählen","8-18 Minuten"],["Kampfvorbereitung","Gegnerformation ansehen; eigene Formation, Ausrüstung und Doktrin anpassen","20-90 Sekunden"],["Auto-Battle","Beobachten, pausieren, Geschwindigkeit ändern und Informationen einblenden","20-100 Sekunden"],["Auswertung","Leistung, Hinweise und Belohnungen prüfen","10-30 Sekunden"],["Expeditionsabschluss","Gesicherte Beute, Ruhm, Fortschritt und Freischaltungen anwenden","30-90 Sekunden"]]',
    B:'Eine Standardexpedition soll 12-25 Minuten dauern. Eine Kampagnenmission darf beim ersten Durchlauf einschließlich Story und Lesen 20-35 Minuten erreichen. Unterbrechung und lokales Fortsetzen müssen an jedem Knoten außerhalb eines laufenden Kampfes möglich sein; im Kampf wird beim App-Verlassen ein deterministischer Kampfsnapshot gespeichert.',
  };
  add(make([5,'block:84','MUST','Product','PHASE-10','PHASE-10','GR-PHASE10-015',E.A,'Eine Standardexpedition muss zwischen 5 und 8 Knoten enthalten.','count|min:5..8|expedition_visited_nodes_min_max']));
  add(make([5,'block:85','MUST','Product','PHASE-10','PHASE-10','GR-PHASE10-016',E.B,'Eine Standardexpedition muss 12-25 Minuten dauern.','minutes|12..25|standard_expedition_duration']));
  add(make([5,'block:85','MUST','Product','PHASE-10','PHASE-10','GR-PHASE10-017',E.B,'Unterbrechung und lokales Fortsetzen müssen an jedem Knoten außerhalb eines laufenden Kampfes möglich sein.']));
  add(make([5,'block:85','MUST','Save','PHASE-12','PHASE-12','UT-PHASE12-001',E.B,'Beim App-Verlassen während eines Kampfes muss ein deterministischer Kampfsnapshot gespeichert werden.']));
}

// ============= CHAPTER 6 =============
{
  const E = {
    A:'Das logische Schlachtfeld verwendet eine horizontale X-Achse von 0 bis 100 und drei diskrete Bahnen: oben, Mitte, unten.',
    B:'Spielerseite bewegt sich grundsätzlich in positive X-Richtung; Gegnerseite in negative X-Richtung.',
    C:'Eigene Startzonen: Hinten X=8, Mitte X=18, Front X=28. Gegnerische Spiegelwerte: 92, 82, 72.',
    D:'Eine Einheit besitzt einen Kollisionsradius. Baseline: klein 1,2; normal 1,8; groß 2,8; Boss 4,0.',
    E2:'Verbündete dürfen sich innerhalb einer Bahn überholen, wenn die überholende Einheit mindestens 25% schneller ist oder eine Fähigkeit dies erlaubt. Gegnerische Körper können nicht durchlaufen werden.',
    F:'Ein Bahnwechsel dauert baseline 1,2 Sekunden, unterbricht den aktuellen Standardangriff und ist nur durch Zielregel, Doktrin oder Fähigkeit erlaubt.',
    G:'[["Wert","Bedeutung","Typischer Bereich regulärer Einheiten"],["LP","Maximale Lebenspunkte","650-1.800"],["Rüstung","Reduziert physischen Schaden","0-60"],["Widerstand","Reduziert magischen Schaden","0-60"],["Angriffskraft","Basis für Standardangriff und Fähigkeiten","70-170"],["Angriffsintervall","Zeit zwischen Angriffsbeginn und nächstem Angriffsbeginn","0,75-2,4 s"],["Vorbereitung","Telegraphierte Zeit vor Treffer/Projektil","0,15-0,9 s"],["Reichweite","Maximaler horizontaler Abstand auf gleicher Bahn","2,5-35"],["Bewegung","Logische X-Einheiten pro Sekunde","4,0-9,0"],["Fähigkeitsladung","Zeit bis zur wiederholbaren Signaturfähigkeit","8-18 s"],["Kontrollresistenz","Reduziert Dauer harter Kontrolle","0-50% regulär; 65-85% Boss"]]',
    H:'Physischer Endschaden = Rohschaden x 100 / (100 + effektive Rüstung). Magischer Endschaden verwendet dieselbe Formel mit Widerstand. Reiner Schaden ignoriert Rüstung und Widerstand, darf aber nie mehr als 18% der maximalen LP eines Bosses durch einen einzelnen Treffer verursachen. Effektive Verteidigung kann nicht unter -40 und nicht über 200 liegen.',
    I:'Standardangriff-Rohschaden = Angriffskraft x Angriffsmultiplikator.',
    J:'Kritische Treffer existieren nicht als globaler Zufallswert. Nur ausdrücklich benannte Fähigkeiten dürfen einen festen kritischen Effekt besitzen.',
    K:'Schilde absorbieren Endschaden vor LP. Mehrere Schilde bilden einen gemeinsamen Schildpool, behalten aber ihre eigene Ablaufzeit; zuerst läuft/verbrauchte Quelle wird zuerst abgebaut.',
    L:'Heilung kann LP nicht über das Maximum erhöhen. Überheilung verfällt, außer eine Fähigkeit wandelt sie ausdrücklich in Schild um.',
    M:'Angriffsgeschwindigkeit verändert das gesamte Intervall, aber nie unter 0,45 Sekunden. Bewegungsgeschwindigkeit nie unter 2,0 und nie über 14,0.',
    N:'Effektive Dauer harter Kontrolle = Basisdauer x (1 - Kontrollresistenz). Harte Kontrolle umfasst Betäubung, Stille und Verwirrung. Verlangsamung ist weich. Reguläre Bosse besitzen 70% Kontrollresistenz, Ascension-Bosse 80% und das Herz des Risses 85%. Kein harter Kontrolleffekt auf Bosse darf länger als 0,65 Sekunden dauern.',
    O:'Jeder Kampf erhält einen gespeicherten Seed. Gleiche Startdaten, Seed und Simulationsversion müssen dasselbe Ergebnis erzeugen.',
    P:'Ein Kampf endet, sobald eine Seite keine kampffähige reguläre Einheit mehr besitzt. Beschwörungen allein halten den Kampf nicht offen.',
    Q:'Normales weiches Zeitlimit: 90 Sekunden. Bosslimit: 120 Sekunden. Bei Erreichen beginnt der 15 Sekunden lange Riftkollaps.',
    R:'Während des Riftkollapses erhalten alle regulären Einheiten alle 3 Sekunden reinen Schaden in Höhe von 8% ihrer maximalen LP; Heilung ist um 50% reduziert.',
    S:'Sind nach weiteren 15 Sekunden beide Seiten noch regulär kampffähig, gewinnt die Seite mit höherer Summe aus verbleibenden LP-Prozenten plus halbem Schild-Prozent. Exakter Gleichstand gilt als Niederlage des Spielers, wird aber als Sondergrund ausgewiesen.',
    T:'Tiebreak-Reihenfolge ohne Zufall: höchster Zielscore, geringste Distanz, niedrigste verbleibende LP in absoluten Punkten, niedrigste stabile Entity-ID.',
    U:'Geschwindigkeitsstufe, Pause, Kamera und reduzierte Effekte dürfen das Ergebnis nie verändern.',
  };
  add(make([6,'block:89','MUST','Sim','PHASE-08','PHASE-08','PT-PHASE08-011',E.A,'Das logische Schlachtfeld verwendet eine horizontale X-Achse von 0 bis 100 und drei diskrete Bahnen: oben, Mitte, unten.','xu|0..100|battlefield_x_range']));
  add(make([6,'block:90','MUST','Sim','PHASE-08','PHASE-08','PT-PHASE08-012',E.B,'Spielerseite bewegt sich grundsätzlich in positive X-Richtung; Gegnerseite in negative X-Richtung.']));
  add(make([6,'block:91','MUST','Sim','PHASE-08','PHASE-08','PT-PHASE08-013',E.C,'Eigene Startzonen sind X=8 (Hinten), X=18 (Mitte), X=28 (Front); gegnerische Spiegelwerte sind 92, 82, 72.']));
  add(make([6,'block:92','MUST','Sim','PHASE-08','PHASE-08','PT-PHASE08-014',E.D,'Baseline-Kollisionsradien sind klein 1,2; normal 1,8; groß 2,8; Boss 4,0.','xu|1.2..4.0|collision_radius_baseline']));
  add(make([6,'block:93','MUST','Sim','PHASE-08','PHASE-08','PT-PHASE08-015',E.E2,'Verbündete dürfen sich innerhalb einer Bahn überholen, wenn die überholende Einheit mindestens 25% schneller ist oder eine Fähigkeit dies erlaubt.','pct|min:25|ally_overtake_speed_min_pct']));
  add(make([6,'block:93','MUST_NOT','Sim','PHASE-08','PHASE-08','PT-PHASE08-016',E.E2,'Gegnerische Körper können nicht durchlaufen werden.']));
  add(make([6,'block:94','MUST','Sim','PHASE-08','PHASE-08','PT-PHASE08-017',E.F,'Ein Bahnwechsel dauert baseline 1,2 Sekunden, unterbricht den aktuellen Standardangriff und ist nur durch Zielregel, Doktrin oder Fähigkeit erlaubt.','s|1.2|lane_switch_baseline_duration']));
  add(make([6,'block:96','MUST','Sim','PHASE-08','PHASE-08','PT-PHASE08-018',E.G,'Reguläre Einheitenwerte müssen in den dokumentierten Bereichen liegen.']));
  add(make([6,'block:98','MUST','Sim','PHASE-08','PHASE-08','PT-PHASE08-019',E.H,'Physischer und magischer Endschaden werden nach Rohschaden x 100 / (100 + effektive Verteidigung) berechnet.']));
  add(make([6,'block:98','MUST_NOT','Sim','PHASE-08','PHASE-08','PT-PHASE08-020',E.H,'Effektive Verteidigung darf nicht unter -40 und nicht über 200 liegen.']));
  add(make([6,'block:98','MUST','Sim','PHASE-08','PHASE-08','PT-PHASE08-021',E.H,'Reiner Schaden darf nie mehr als 18% der maximalen LP eines Bosses durch einen einzelnen Treffer verursachen.','pct|max:18|true_damage_boss_cap_pct']));
  add(make([6,'block:99','MUST','Sim','PHASE-08','PHASE-08','PT-PHASE08-022',E.I,'Standardangriff-Rohschaden ist Angriffskraft x Angriffsmultiplikator.']));
  add(make([6,'block:100','MUST_NOT','Sim','PHASE-08','PHASE-08','PT-PHASE08-023',E.J,'Kritische Treffer dür