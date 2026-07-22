#!/usr/bin/env node
// Build chunk-b.json: extract atomic REQ records from chapters 30-58 of GDD V5.
import { writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

function sha(t){ return 'sha256:' + createHash('sha256').update(t, 'utf8').digest('hex'); }

const R = [];
const C = [];
let nextId = 1;

function add(req) { R.push(req); }
function ctx(ch, reason) { C.push({ chapter: ch, reason }); }

function req(ch, loc, norm, cat, owner, test, excerpt, stmt, num) {
  const ownerPhases = owner.split(',').map(s=>s.trim()).filter(Boolean);
  const testIds = test.split(',').map(s=>s.trim()).filter(Boolean);
  const verification = [{ type: 'unit', plannedPhase: ownerPhases[0] ?? 'PHASE-00', testIds }];
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
  const tempId = `REQ-TEMP-B-${String(nextId++).padStart(4, '0')}`;
  R.push({
    tempId,
    statement: stmt,
    norm,
    category: cat,
    source: { sourceId: 'gdd-v5', chapter: ch, section: null, locator: loc, quoteHash: sha(excerpt), originalExcerpt: excerpt },
    ownerPhases,
    verification,
    numericConstraints,
    status: 'planned',
  });
}

// =============================================================
// CHAPTER 30 — Endlose Rift
// =============================================================
{
  const E = {
    A:'Freischaltung nach Kampagne. Start: vollständige Gruppe, genau drei permanente Gegenstände inklusive möglichem Banner, Doktrin und optional bereits abgeschlossener Ascension-Regelsatz.',
    B:'Fortlaufende einzelne Kämpfe. Nach jedem Sieg Wahl aus drei Belohnungen: Relikt, temporäres Kit/Gegenstand, Rekrut, Heil-/Sicherungsdienst, Gold/Zyklusmünzen existieren hier nicht.',
    C:'Nach jeweils fünf Kämpfen Checkpoint: Formation/Ausrüstung ordnen, freiwillig beenden, Rekord sichern. Gruppe darf nur mit im Lauf gewonnenen Rekruten verändert werden.',
    D:'Niederlage beendet Lauf und speichert erreichte Tiefe. Freiwilliges Ende am Checkpoint gilt ebenfalls als gültiger Rekord.',
    E2:'Keine wiederholbare permanente Machtbelohnung. Erstmalige Meilensteine sind kosmetisch oder geringe einmalige Riftessenz.',
    F:'Nach Kämpfen 1-4: mindestens zwei gewöhnliche und eine beliebige Option.',
    G:'Jeder fünfte Kampf: mindestens eine seltene Option; Bosscheckpoint: eine von vier, davon mindestens zwei selten/legendär.',
    H:'Reliktlimit sechs bis Tiefe 20, acht ab Tiefe 21. Darüber kein weiteres Wachstum.',
    I:'Rekrutierungswahl kann Vertragsgrenze drei nicht überschreiten; temporärer Rekrut bleibt bis Laufende.',
    J:'Alle zehn Tiefen wird eine Begegnung bewusst leichter als Erholungsfenster, danach Boss/harte Gruppe.',
    K:'Endless-Generator wiederholt identische Encounter-ID nicht innerhalb der letzten acht Kämpfe.',
    L:'Jeder Checkpoint speichert vollständig; Neustart kann keine Belohnung neu würfeln.',
    M:'Skalierung bleibt numerisch berechenbar und besitzt keine versteckten Sprünge außerhalb Tabelle.',
    N:'Tiefe 100 ist theoretisch erreichbar, aber nicht als durchschnittliches Balanceziel verlangt.',
    O:'Alle Meilensteinbelohnungen werden einmalig vergeben und danach als abgeschlossen markiert.',
  };
  req(30,'block:1236','MUST','Product','PHASE-10','GR-PHASE10-007',E.A,'Endlose Rift wird nach Abschluss der Kampagne freigeschaltet.');
  req(30,'block:1236','MUST','Content','PHASE-10','GR-PHASE10-008',E.A,'Beim Start der Endlosen Rift werden genau drei permanente Gegenstände inklusive möglichem Banner ausgerüstet.');
  req(30,'block:1236','MUST_NOT','Product','PHASE-10','GR-PHASE10-009',E.A,'Endlose Rift darf nicht ohne Doktrin starten.');
  req(30,'block:1237','MUST','Content','PHASE-10','GR-PHASE10-010',E.B,'In der Endlosen Rift finden fortlaufend einzelne Kämpfe statt.');
  req(30,'block:1237','MUST','Content','PHASE-10','GR-PHASE10-011',E.B,'Nach jedem Sieg werden drei Belohnungen zur Wahl angeboten.');
  req(30,'block:1237','MUST_NOT','Content','PHASE-10','GR-PHASE10-012',E.B,'In der Endlosen Rift existieren Gold und Zyklusmünzen nicht.');
  req(30,'block:1238','MUST','Content','PHASE-10','GR-PHASE10-013',E.C,'Nach jeweils fünf Kämpfen erscheint ein Checkpoint.');
  req(30,'block:1238','MUST','Save','PHASE-12','IT-PHASE12-002',E.C,'Am Checkpoint kann der Lauf freiwillig beendet und ein Rekord gesichert werden.');
  req(30,'block:1238','MUST_NOT','Content','PHASE-10','GR-PHASE10-014',E.C,'Die Gruppe darf nur mit im Lauf gewonnenen Rekruten verändert werden.');
  req(30,'block:1239','MUST','Save','PHASE-12','IT-PHASE12-003',E.D,'Eine Niederlage beendet den Lauf und speichert die erreichte Tiefe.');
  req(30,'block:1239','MUST','Save','PHASE-12','IT-PHASE12-004',E.D,'Ein freiwilliges Ende am Checkpoint gilt als gültiger Rekord.');
  req(30,'block:1240','MUST_NOT','Content','PHASE-10','GR-PHASE10-015',E.E2,'In der Endlosen Rift existieren keine wiederholbaren permanenten Machtbelohnungen.');
  req(30,'block:1240','MUST','Content','PHASE-10','GR-PHASE10-016',E.E2,'Erstmalige Meilensteine sind kosmetisch oder geringe einmalige Riftessenz.');
  // Tiefenskalierung (Tabelle Block 1244)
  req(30,'block:1244','MUST','Sim','PHASE-08','PT-PHASE08-009','Baseline Kampagnenende x0,90','In Tiefe 1-5 beträgt die Gegnerbaseline 0,90 der Kampagnenend-Werte.');
  req(30,'block:1244','MUST','Content','PHASE-10','GR-PHASE10-017','Eine Region, keine Champions, max. 1 Modifikator.','In Tiefe 1-5 gilt: eine Region, keine Champions, maximal 1 Modifikator.');
  req(30,'block:1244','MUST','Sim','PHASE-08','PT-PHASE08-010','Elitechance 25%, erster Zwischenboss auf 10.','In Tiefe 6-10 beträgt die Elitechance 25 Prozent und der erste Zwischenboss erscheint auf Tiefe 10.');
  req(30,'block:1244','MUST','Sim','PHASE-08','PT-PHASE08-011','Je Tiefe +2% LP/+1,2% Angriff ab 11','In Tiefe 11-20 steigt pro Tiefe das gegnerische LP um 2 Prozent und der Angriff um 1,2 Prozent.');
  req(30,'block:1244','MUST','Content','PHASE-10','GR-PHASE10-018','Zwei Regionen gemischt; Championchance 15%; Boss auf 20.','In Tiefe 11-20 werden zwei Regionen gemischt, die Championchance beträgt 15 Prozent und der Boss erscheint auf Tiefe 20.');
  req(30,'block:1244','MUST','Content','PHASE-10','GR-PHASE10-019','Eliteattribute kombiniert; alle Regionen ab 26.','In Tiefe 21-30 werden Eliteattribute kombiniert und ab Tiefe 26 sind alle Regionen verfügbar.');
  req(30,'block:1244','MUST','Content','PHASE-10','GR-PHASE10-020','Bis 2 Modifikatoren; Championchance 30%; Bossvarianten 35/40.','In Tiefe 31-40 sind bis zu 2 Modifikatoren aktiv, die Championchance beträgt 30 Prozent und Bossvarianten erscheinen auf Tiefe 35 und 40.');
  req(30,'block:1244','MUST_NOT','Content','PHASE-10','GR-PHASE10-021','Bis 2 Champions ab 51, aber nie plus zwei Eliteattribute auf beiden.','In Tiefe 41-60 sind ab Tiefe 51 maximal 2 Champions erlaubt, jedoch nie mit zwei Eliteattributen auf beiden.');
  req(30,'block:1244','MUST','Content','PHASE-10','GR-PHASE10-022','Kuratierte Rotationen; keine neue Mechanik, nur Rekorddruck.','In Tiefe 61+ werden ausschließlich kuratierte Rotationen verwendet und keine neuen Mechaniken eingeführt.');
  // Belohnungsrhythmus
  req(30,'block:1248','MUST','Content','PHASE-10','GR-PHASE10-023',E.F,'Nach Kämpfen 1-4 werden mindestens zwei gewöhnliche und eine beliebige Option angeboten.');
  req(30,'block:1249','MUST','Content','PHASE-10','GR-PHASE10-024',E.G,'Jeder fünfte Kampf enthält mindestens eine seltene Option.');
  req(30,'block:1249','MUST','Content','PHASE-10','GR-PHASE10-025',E.G,'An einem Bosscheckpoint wird eine von vier Optionen angeboten, davon mindestens zwei selten oder legendär.');
  req(30,'block:1250','MUST','Content','PHASE-10','GR-PHASE10-026',E.H,'Das Reliktlimit beträgt sechs bis Tiefe 20.');
  req(30,'block:1250','MUST','Content','PHASE-10','GR-PHASE10-027',E.H,'Das Reliktlimit beträgt acht ab Tiefe 21 und wächst darüber nicht weiter.');
  req(30,'block:1251','MUST_NOT','Content','PHASE-10','GR-PHASE10-028',E.I,'Eine Rekrutierungswahl darf die Vertragsgrenze von drei nicht überschreiten.');
  req(30,'block:1251','MUST','Content','PHASE-10','GR-PHASE10-029',E.I,'Ein temporärer Rekrut bleibt bis zum Laufende erhalten.');
  req(30,'block:1252','MUST','Content','PHASE-10','GR-PHASE10-030',E.J,'Alle zehn Tiefen wird eine Begegnung als Erholungsfenster leichter gestaltet.');
  // Implementation
  req(30,'block:1262','MUST','Sim','PHASE-08','PT-PHASE08-012',E.K,'Der Endless-Generator wiederholt keine identische Encounter-ID innerhalb der letzten acht Kämpfe.');
  req(30,'block:1263','MUST','Save','PHASE-12','IT-PHASE12-005',E.L,'Jeder Checkpoint speichert vollständig.');
  req(30,'block:1263','MUST_NOT','Content','PHASE-10','GR-PHASE10-031',E.L,'Ein Neustart darf keine Belohnung neu würfeln.');
  req(30,'block:1264','MUST','Sim','PHASE-08','PT-PHASE08-013',E.M,'Die Skalierung der Endlosen Rift bleibt numerisch berechenbar und enthält keine versteckten Sprünge außerhalb der Tabelle.');
  req(30,'block:1265','SHOULD','Product','PHASE-10','GR-PHASE10-032',E.N,'Tiefe 100 ist theoretisch erreichbar, aber kein durchschnittliches Balanceziel.');
  req(30,'block:1266','MUST','Save','PHASE-12','IT-PHASE12-006',E.O,'Alle Meilensteinbelohnungen werden einmalig vergeben und danach als abgeschlossen markiert.');
  // Meilensteine Tabelle (Block 1256) - data
  req(30,'block:1256','MUST','Content','PHASE-10','GR-PHASE10-033','5','Tiefe 5 schaltet den Porträtrahmen „Fünf Schritte“ frei.','count|value:5|endless_depth_milestone');
  req(30,'block:1256','MUST','Content','PHASE-10','GR-PHASE10-034','10','Tiefe 10 gewährt 1 Riftessenz und einen Titel.','count|value:10|endless_depth_milestone');
  req(30,'block:1256','MUST','Content','PHASE-10','GR-PHASE10-035','20','Tiefe 20 schaltet eine Kodexseite und 2 Riftessenz frei.','count|value:20|endless_depth_milestone');
  req(30,'block:1256','MUST','Content','PHASE-10','GR-PHASE10-036','30','Tiefe 30 gewährt 2 Riftessenz und einen Titel.','count|value:30|endless_depth_milestone');
  req(30,'block:1256','MUST','Content','PHASE-10','GR-PHASE10-037','50','Tiefe 50 gewährt 3 Riftessenz und die gold-violette Arenafarbe.','count|value:50|endless_depth_milestone');
  req(30,'block:1256','MUST','Content','PHASE-10','GR-PHASE10-038','75','Tiefe 75 gewährt 4 Riftessenz und eine Bossfarbvariante.','count|value:75|endless_depth_milestone');
  req(30,'block:1256','MUST','Content','PHASE-10','GR-PHASE10-039','100','Tiefe 100 gewährt einen legendären rein kosmetischen Rahmen und eine Statistikplakette.','count|value:100|endless_depth_milestone');
}

// =============================================================
// CHAPTER 31 — Heldenmeisterschaften
// =============================================================
{
  const E = {
    A:'Jeder Held besitzt fünf Kernziele. Ziele werden sichtbar, sobald der Held freigeschaltet ist; Ziel 4 nach Kampagnenabschluss, Ziel 5 nach Level 3. Fortschritt wird nur in gewonnenen Kämpfen oder erfolgreich abgeschlossenen Modi gewertet, außer reiner Teilnahmecounter. Kein Ziel verlangt Onlinefunktionen oder zeitlich begrenzte Inhalte.',
    B:'Fortschritt wird unmittelbar nach Kampf angezeigt und persistent gespeichert.',
    C:'Kosmetische Effekte verändern Trefferzeit, Fläche und Lesbarkeit nicht.',
    D:'Kein Ziel ist durch dauerhaft verpassbaren Inhalt blockierbar.',
  };
  req(31,'block:1271','MUST','Content','PHASE-10','GR-PHASE10-040',E.A,'Jeder Held besitzt genau fünf Kernziele.');
  req(31,'block:1271','MUST','UX','PHASE-15','VIS-PHASE15-002',E.A,'Ziele werden sichtbar, sobald der Held freigeschaltet ist.');
  req(31,'block:1271','MUST','Content','PHASE-10','GR-PHASE10-041',E.A,'Ziel 4 wird erst nach Kampagnenabschluss sichtbar.');
  req(31,'block:1271','MUST','Content','PHASE-10','GR-PHASE10-042',E.A,'Ziel 5 wird erst nach Erreichen von Level 3 sichtbar.');
  req(31,'block:1271','MUST_NOT','Content','PHASE-10','GR-PHASE10-043',E.A,'Fortschritt wird nicht in verlorenen Kämpfen gewertet, außer bei reinen Teilnahmecountern.');
  req(31,'block:1271','MUST_NOT','Content','PHASE-10','GR-PHASE10-044',E.A,'Kein Ziel verlangt Onlinefunktionen oder zeitlich begrenzte Inhalte.');
  req(31,'block:1272','MUST','Content','PHASE-10','GR-PHASE10-045','Alternative Farbvariante','Stufe I einer Heldenmeisterschaft gewährt eine alternative Farbvariante.');
  req(31,'block:1272','MUST','Content','PHASE-10','GR-PHASE10-046','Porträtrahmen','Stufe II einer Heldenmeisterschaft gewährt einen Porträtrahmen.');
  req(31,'block:1272','MUST','Content','PHASE-10','GR-PHASE10-047','Kurze Charaktergeschichte im Archiv','Stufe III einer Heldenmeisterschaft gewährt eine kurze Charaktergeschichte im Archiv.');
  req(31,'block:1272','MUST','Content','PHASE-10','GR-PHASE10-048','Kosmetischer Signaturfähigkeitseffekt','Stufe IV einer Heldenmeisterschaft gewährt einen kosmetischen Signaturfähigkeitseffekt.');
  req(31,'block:1272','MUST','Content','PHASE-10','GR-PHASE10-049','Heldentitel und 2 Riftessenz','Stufe V einer Heldenmeisterschaft gewährt einen Heldentitel und 2 Riftessenz.','count|value:2|rift_essence_mastery_v');
  req(31,'block:1314','MUST','Save','PHASE-12','IT-PHASE12-007',E.B,'Meisterschaftsfortschritt wird unmittelbar nach Kampf angezeigt und persistent gespeichert.');
  req(31,'block:1315','MUST_NOT','Sim','PHASE-08','PT-PHASE08-014',E.C,'Kosmetische Effekte aus Meisterschaften verändern Trefferzeit, Fläche und Lesbarkeit nicht.');
  req(31,'block:1316','MUST_NOT','Content','PHASE-10','GR-PHASE10-050',E.D,'Kein Meisterschaftsziel darf durch dauerhaft verpassbaren Inhalt blockierbar sein.');
}

// =============================================================
// CHAPTER 32 — Kodex
// =============================================================
{
  const E = {
    A:'Kategorien: 10 Helden, 18 Truppen, 14 Beschwörungen, 28 Grundgegner, 12 Eliteattribute, 8 Champions, 4 Zwischenbosse, 4 Hauptbosse, 42 Gegenstände, 36 Relikte, 30 Ereignisse, 4 Regionen, Story, Ascension-Regeln und Modifikatoren.',
    B:'Unbekannte Einträge erscheinen als Silhouette mit Entdeckungsquelle, sofern die Quelle bereits zugänglich ist.',
    C:'Erste Begegnung schaltet Namen, Rolle, Kurzmechanik und Gegenstrategie frei. Erster Sieg schaltet vollständige Baselinewerte und Fähigkeiten frei.',
    D:'Boss-Kodex zeigt normale, Veteran-, Rang-4- und Rang-9-Regeln getrennt.',
    E2:'Einträge enthalten niemals versteckte aktuelle Endwerte nach Schwierigkeit; stattdessen Basis plus aktive Multiplikatoren.',
    F:'Such-/Filteroptionen: Name, Rolle, Merkmal, Region, Schadenstyp, Beschwörung/Konstruktion, freigeschaltet/ungesehen.',
  };
  req(32,'block:1321','MUST','Content','PHASE-10','GR-PHASE10-051',E.A,'Der Kodex umfasst die Kategorien 10 Helden, 18 Truppen, 14 Beschwörungen, 28 Grundgegner, 12 Eliteattribute, 8 Champions, 4 Zwischenbosse, 4 Hauptbosse, 42 Gegenstände, 36 Relikte, 30 Ereignisse, 4 Regionen, Story, Ascension-Regeln und Modifikatoren.');
  req(32,'block:1322','MUST','UX','PHASE-15','VIS-PHASE15-003',E.B,'Unbekannte Kodex-Einträge erscheinen als Silhouette mit Entdeckungsquelle, sofern die Quelle bereits zugänglich ist.');
  req(32,'block:1323','MUST','Content','PHASE-10','GR-PHASE10-052',E.C,'Eine erste Begegnung schaltet Namen, Rolle, Kurzmechanik und Gegenstrategie frei.');
  req(32,'block:1323','MUST','Content','PHASE-10','GR-PHASE10-053',E.C,'Ein erster Sieg schaltet vollständige Baselinewerte und Fähigkeiten frei.');
  req(32,'block:1324','MUST','Content','PHASE-10','GR-PHASE10-054',E.D,'Der Boss-Kodex zeigt normale, Veteran-, Rang-4- und Rang-9-Regeln getrennt.');
  req(32,'block:1325','MUST_NOT','Content','PHASE-10','GR-PHASE10-055',E.E2,'Kodex-Einträge enthalten keine versteckten aktuellen Endwerte nach Schwierigkeit, sondern Basis plus aktive Multiplikatoren.');
  req(32,'block:1326','MUST','UX','PHASE-15','VIS-PHASE15-004',E.F,'Der Kodex unterstützt Suche und Filter nach Name, Rolle, Merkmal, Region, Schadenstyp, Beschwörung/Konstruktion und Status freigeschaltet/ungesehen.');
}

// =============================================================
// CHAPTER 33 — Interne Erfolge
// =============================================================
{
  const E = {
    A:'Erfolge sind lokal, offline und rein intern. Sie geben Kosmetik, Titel oder kleine einmalige Gold-/Riftessenzbeträge, niemals exklusive notwendige Macht. Versteckte Erfolge sind erlaubt, dürfen aber keine ernsthafte Fehlhandlung verlangen.',
    B:'Normale Erfolge: 100 Gold oder kosmetisches Abzeichen. Kampagnen-/Endgame-Meilensteine: Titel/Rahmen und höchstens 1-3 Riftessenz.',
    C:'Erfolge werden nachträglich geprüft, wenn ein altes Savegame auf eine Version mit neuer Prüfung geladen wird.',
    D:'„Pip hatte recht/nicht recht" verwendet ausschließlich die explizit zufälligen Pip-Optionen und keine versteckten Wertungen.',
  };
  req(33,'block:1330','MUST','Content','PHASE-10','GR-PHASE10-056',E.A,'Erfolge sind lokal, offline und rein intern.');
  req(33,'block:1330','MUST_NOT','Content','PHASE-10','GR-PHASE10-057',E.A,'Erfolge gewähren niemals exklusive notwendige Macht.');
  req(33,'block:1330','MUST_NOT','Content','PHASE-10','GR-PHASE10-058',E.A,'Versteckte Erfolge dürfen keine ernsthafte Fehlhandlung verlangen.');
  req(33,'block:1332','MUST','Content','PHASE-10','GR-PHASE10-059',E.B,'Normale Erfolge gewähren 100 Gold oder ein kosmetisches Abzeichen.');
  req(33,'block:1332','MUST','Content','PHASE-10','GR-PHASE10-060',E.B,'Kampagnen- oder Endgame-Erfolge gewähren Titel oder Rahmen und höchstens 1-3 Riftessenz.','count|max:3|endgame_achievement_essence');
  req(33,'block:1333','MUST','Save','PHASE-12','IT-PHASE12-008',E.C,'Erfolge werden nachträglich geprüft, wenn ein altes Savegame auf eine Version mit neuer Prüfung geladen wird.');
  req(33,'block:1334','MUST','Content','PHASE-10','GR-PHASE10-061',E.D,'Die Erfolge „Pip hatte recht/nicht recht" verwenden ausschließlich die explizit zufälligen Pip-Optionen und keine versteckten Wertungen.');
}

// =============================================================
// CHAPTER 34 — Kampfauswertung und automatische Hinweise
// =============================================================
{
  const E = {
    A:'Nach jedem Kampf werden maximal zwei Hinweise aus objektiven Regeln gewählt. Ein Hinweis benötigt eine Mindestkonfidenz und darf keine einzige perfekte Lösung behaupten. Priorität: unmittelbare Niederlagenursache; ungenutzter klarer Counter; Positionsproblem; Wirtschaft/Belohnung nie als Kampfhinweis.',
    B:'Auswertungswerte stimmen mit Kampflog auf Rundungsdifferenz unter 0,1% überein.',
    C:'MVP-Algorithmus bevorzugt nicht automatisch reine DPS über essentielle Heilung/Tankleistung.',
    D:'Hinweise werden nur bei vollständig erfüllten Triggern gezeigt und nennen keine nicht vorhandene Fähigkeit.',
    E2:'Spieler kann von jeder Metrik direkt zur Ereignis-Timeline springen.',
  };
  req(34,'block:1348','MUST','UX','PHASE-15','VIS-PHASE15-005',E.A,'Nach jedem Kampf werden maximal zwei Hinweise aus objektiven Regeln gewählt.');
  req(34,'block:1348','MUST','UX','PHASE-15','VIS-PHASE15-006',E.A,'Ein Hinweis benötigt eine Mindestkonfidenz und darf keine einzige perfekte Lösung behaupten.');
  req(34,'block:1348','MUST_NOT','UX','PHASE-15','VIS-PHASE15-007',E.A,'Wirtschaft und Belohnung werden niemals als Kampfhinweis verwendet.');
  req(34,'block:1351','MUST','Sim','PHASE-08','PT-PHASE08-015',E.B,'Auswertungswerte stimmen mit dem Kampflog auf Rundungsdifferenz unter 0,1 Prozent überein.','%|max:0.1|eval_log_deviation');
  req(34,'block:1352','MUST_NOT','Sim','PHASE-08','PT-PHASE08-016',E.C,'Der MVP-Algorithmus bevorzugt nicht automatisch reine DPS über essentielle Heilung oder Tankleistung.');
  req(34,'block:1353','MUST','UX','PHASE-15','VIS-PHASE15-008',E.D,'Hinweise werden nur bei vollständig erfüllten Triggern gezeigt und nennen keine nicht vorhandene Fähigkeit.');
  req(34,'block:1354','MUST','UX','PHASE-15','VIS-PHASE15-009',E.E2,'Der Spieler kann von jeder Metrik direkt zur Ereignis-Timeline springen.');
  // Kampfbewertung Tabelle (Block 1344)
  req(34,'block:1344','MUST','Content','PHASE-10','GR-PHASE10-062','+15% Gold, höhere Reliktgewichtung klein.','Die Kampfbewertung „Überlegen" gewährt 15 Prozent mehr Gold und eine höhere Reliktgewichtung klein.','%|value:15|superior_gold_bonus');
  req(34,'block:1344','MUST','Content','PHASE-10','GR-PHASE10-063','+8% Gold.','Die Kampfbewertung „Kontrolliert" gewährt 8 Prozent mehr Gold.','%|value:8|controlled_gold_bonus');
  req(34,'block:1344','MUST','Content','PHASE-10','GR-PHASE10-064','Kein Bonus/Malus.','Die Kampfbewertung „Hart erkämpft" gewährt weder Bonus noch Malus.');
  req(34,'block:1344','MUST','Content','PHASE-10','GR-PHASE10-065','Kein Malus; eigener Statistikmarker.','Die Kampfbewertung „Letzter Stand" gewährt keinen Malus, aber einen eigenen Statistikmarker.');
}

// =============================================================
// CHAPTER 35 — Hauptquartier
// =============================================================
{
  const E = {
    A:'Das Hauptquartier ist eine kompakte, visuell zusammenhängende Menüumgebung und keine frei begehbare Basis. Jeder Bereich öffnet eine klar fokussierte Oberfläche; der Spieler baut keine Räume manuell.',
    B:'Vom Hauptquartier ist jeder Hauptbereich mit einem Tap erreichbar; keine verschachtelte Navigation tiefer als drei Ebenen.',
    C:'Zurück führt immer eine Ebene zurück und verwirft nie unbestätigte Käufe ohne Dialog.',
    D:'Neue Inhalte erhalten einen einmaligen Punkt; der Punkt verschwindet nach Öffnen des relevanten Details, nicht bloß des Obermenüs.',
    E2:'Gold, Riftessenz und aktueller Modus sind auf allen Verwaltungsseiten sichtbar.',
  };
  req(35,'block:1359','MUST','UX','PHASE-15','VIS-PHASE15-010',E.A,'Das Hauptquartier ist eine kompakte, visuell zusammenhängende Menüumgebung.');
  req(35,'block:1359','MUST_NOT','UX','PHASE-15','VIS-PHASE15-011',E.A,'Der Spieler baut keine Räume im Hauptquartier manuell.');
  req(35,'block:1363','MUST','UX','PHASE-15','VIS-PHASE15-012',E.B,'Vom Hauptquartier ist jeder Hauptbereich mit einem Tap erreichbar.');
  req(35,'block:1363','MUST_NOT','UX','PHASE-15','VIS-PHASE15-013',E.B,'Die Navigation ist nicht tiefer als drei Ebenen verschachtelt.');
  req(35,'block:1364','MUST','UX','PHASE-15','VIS-PHASE15-014',E.C,'Zurück führt immer eine Ebene zurück.');
  req(35,'block:1364','MUST_NOT','UX','PHASE-15','VIS-PHASE15-015',E.C,'Unbestätigte Käufe werden nicht ohne Dialog verworfen.');
  req(35,'block:1365','MUST','UX','PHASE-15','VIS-PHASE15-016',E.D,'Neue Inhalte erhalten einen einmaligen Punkt, der nach Öffnen des relevanten Details verschwindet.');
  req(35,'block:1366','MUST','UX','PHASE-15','VIS-PHASE15-017',E.E2,'Gold, Riftessenz und aktueller Modus sind auf allen Verwaltungsseiten sichtbar.');
}

// =============================================================
// CHAPTER 36 — UX für Formation, Vorschau und Kampf
// =============================================================
{
  const E = {
    A:'Spieler kann im Kampfmodul nichts aktiv eingreifen, außer Pause und Geschwindigkeitsregelung. Beschleunigen ist nur erlaubt, wenn keine laufende Animation, kein Timer und keine Audio-Queue unverarbeitet sind.',
    B:'Pause speichert vollständigen Zustand, schreibt Snapshot, erlaubt Detailmodus und kehrt identisch zurück.',
    C:'Vorschau zeigt alle Informationen, die für eine fundierte Entscheidung nötig sind: Gegnertyp, Reichweite, Rolle, Schadenstyp, Modifikatoren, Bossphasen, Synergiekonflikte.',
    D:'Bahnenwechsel und Positionsänderungen sind zwischen Kämpfen erlaubt, niemals innerhalb eines laufenden Kampfes.',
  };
  // We need to see the actual content - let me add placeholders and read more
}

// (more chapters to follow)

const out = {
  schemaVersion: '1.0',
  chunk: 'b',
  chapterRange: { lo: 30, hi: 58 },
  requirements: R,
  contextOnly: C,
};

// Write
await writeFile('docs/requirements/requirements/_staging/chunk-b.json', JSON.stringify(out, null, 2));
console.log(`Wrote ${R.length} requirements, ${C.length} contextOnly entries`);
