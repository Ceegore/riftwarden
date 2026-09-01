# GDD V5 – Autoritative Kapitel für Phase 11

- Quelle: `Riftwarden_Auto_RPG_Roguelite_GDD_V5.docx`
- SHA-256: `f550bdf33f3c23787156c0b138f42d29958c84e1dcda562010fbb0874f9d6ed9`
- Extraktionsumfang: Kapitel 6, 7, 8, 9, 10, 42, 48, 51, 73, 75

## 6. Verbindliches Kampfsimulationsmodell
6.1 Koordinaten, Bahnen und Startfelder
Das logische Schlachtfeld verwendet eine horizontale X-Achse von 0 bis 100 und drei diskrete Bahnen: oben, Mitte, unten.
Spielerseite bewegt sich grundsätzlich in positive X-Richtung; Gegnerseite in negative X-Richtung.
Eigene Startzonen: Hinten X=8, Mitte X=18, Front X=28. Gegnerische Spiegelwerte: 92, 82, 72.
Eine Einheit besitzt einen Kollisionsradius. Baseline: klein 1,2; normal 1,8; groß 2,8; Boss 4,0.
Verbündete dürfen sich innerhalb einer Bahn überholen, wenn die überholende Einheit mindestens 25% schneller ist oder eine Fähigkeit dies erlaubt. Gegnerische Körper können nicht durchlaufen werden.
Ein Bahnwechsel dauert baseline 1,2 Sekunden, unterbricht den aktuellen Standardangriff und ist nur durch Zielregel, Doktrin oder Fähigkeit erlaubt.
Bahnwechselpositionen werden visuell diagonal animiert, logisch bleibt eine Einheit während der ersten 50% auf der Ausgangsbahn und danach auf der Zielbahn.
6.2 Referenzwerte und Einheitenstatistiken
Wert | Bedeutung | Typischer Bereich regulärer Einheiten
LP | Maximale Lebenspunkte | 650-1.800
Rüstung | Reduziert physischen Schaden | 0-60
Widerstand | Reduziert magischen Schaden | 0-60
Angriffskraft | Basis für Standardangriff und Fähigkeiten | 70-170
Angriffsintervall | Zeit zwischen Angriffsbeginn und nächstem Angriffsbeginn | 0,75-2,4 s
Vorbereitung | Telegraphierte Zeit vor Treffer/Projektil | 0,15-0,9 s
Reichweite | Maximaler horizontaler Abstand auf gleicher Bahn | 2,5-35
Bewegung | Logische X-Einheiten pro Sekunde | 4,0-9,0
Fähigkeitsladung | Zeit bis zur wiederholbaren Signaturfähigkeit | 8-18 s
Kontrollresistenz | Reduziert Dauer harter Kontrolle | 0-50% regulär; 65-85% Boss
6.3 Schadensformeln
Physischer Endschaden = Rohschaden x 100 / (100 + effektive Rüstung). Magischer Endschaden verwendet dieselbe Formel mit Widerstand. Reiner Schaden ignoriert Rüstung und Widerstand, darf aber nie mehr als 18% der maximalen LP eines Bosses durch einen einzelnen Treffer verursachen. Effektive Verteidigung kann nicht unter -40 und nicht über 200 liegen.
Standardangriff-Rohschaden = Angriffskraft x Angriffsmultiplikator.
Kritische Treffer existieren nicht als globaler Zufallswert. Nur ausdrücklich benannte Fähigkeiten dürfen einen festen kritischen Effekt besitzen.
Flächenschaden verwendet für jedes Ziel separat Verteidigung und Schild.
Schilde absorbieren Endschaden vor LP. Mehrere Schilde bilden einen gemeinsamen Schildpool, behalten aber ihre eigene Ablaufzeit; zuerst läuft/verbrauchte Quelle wird zuerst abgebaut.
Heilung kann LP nicht über das Maximum erhöhen. Überheilung verfällt, außer eine Fähigkeit wandelt sie ausdrücklich in Schild um.
Mindestschaden eines erfolgreichen Angriffs ist 1. Verfehlungen existieren nur durch ausdrücklich definierte Ausweich- oder Unverwundbarkeitsregeln.
Angriffsgeschwindigkeit verändert das gesamte Intervall, aber nie unter 0,45 Sekunden. Bewegungsgeschwindigkeit nie unter 2,0 und nie über 14,0.
6.4 Angriffszustandsmaschine
Ziel validieren oder nach Zielscore neu wählen.
In Reichweite bewegen. Das Ziel wird alle 0,25 Sekunden validiert, aber nicht wegen minimaler Positionsänderungen gewechselt.
Angriff vorbereiten. Während der Vorbereitung ist die Aktion sichtbar und kann durch Betäubung oder eine als Unterbrechung markierte Fähigkeit abgebrochen werden.
Treffer oder Projektil erzeugen. Projektiltreffer verwenden die Zielposition zum Abschusszeitpunkt plus definierte Verfolgung; normale Pfeile verfolgen nicht zwischen Bahnen.
Erholungsphase. Bewegung ist bei normalen Einheiten während der ersten Hälfte gesperrt; danach darf die Einheit nachrücken.
Nächstes Intervall planen und Ziel erneut validieren.
6.5 Fähigkeiten und Ladung
Wiederholbare Fähigkeiten besitzen eine Startladung und eine Wiederaufladung. Wenn nur ein Wert angegeben ist, sind beide identisch.
Ladung läuft ab Kampfbeginn, auch während Bewegung. Stille stoppt die Ladung nicht, verhindert aber den Start; die fertige Fähigkeit wartet.
Eine Fähigkeit startet nur mit gültigem Ziel und sinnvoller Wirkung. Eine Heilung wird beispielsweise erst ausgelöst, wenn das Ziel mindestens 12% LP vermisst, sofern nicht anders festgelegt.
Wird eine Fähigkeit während ihrer Vorbereitung unterbrochen, verliert sie 35% ihrer vollen Ladung und beginnt danach von diesem Stand neu. Einmal-pro-Kampf-Fähigkeiten gelten erst beim Effekt als verbraucht.
Phasenwechsel eines Bosses können laufende Aktionen abbrechen; dies wird in der Bossdefinition einzeln festgelegt.
Startbeschwörungen und Startkonstruktionen werden nach passiven Synergien, aber vor dem ersten Bewegungstick erzeugt.
6.6 Kampfende, Zeitlimit und Gleichstand
Ein Kampf endet, sobald eine Seite keine kampffähige reguläre Einheit mehr besitzt. Beschwörungen allein halten den Kampf nicht offen.
Reguläre Einheiten sind Helden, Truppen und als regulär markierte Gegner/Bosse; temporäre Kampf-Beschwörungen sind nicht regulär.
Normales weiches Zeitlimit: 90 Sekunden. Bosslimit: 120 Sekunden. Bei Erreichen beginnt der 15 Sekunden lange Riftkollaps.
Während des Riftkollapses erhalten alle regulären Einheiten alle 3 Sekunden reinen Schaden in Höhe von 8% ihrer maximalen LP; Heilung ist um 50% reduziert.
Sind nach weiteren 15 Sekunden beide Seiten noch regulär kampffähig, gewinnt die Seite mit höherer Summe aus verbleibenden LP-Prozenten plus halbem Schild-Prozent. Exakter Gleichstand gilt als Niederlage des Spielers, wird aber als Sondergrund ausgewiesen.
Zeitlimits sind Anti-Stall-Schutz und sollen in weniger als 2% balancierter Kämpfe greifen.
6.7 Determinismus und Zufall
Jeder Kampf erhält einen gespeicherten Seed. Gleiche Startdaten, Seed und Simulationsversion müssen dasselbe Ergebnis erzeugen.
Zufall wird nur für explizite Varianten genutzt: gleichwertige Ziel-Tiebreaks, angekündigte Ereignisspannen und bestimmte Relikte.
Tiebreak-Reihenfolge ohne Zufall: höchster Zielscore, geringste Distanz, niedrigste verbleibende LP in absoluten Punkten, niedrigste stabile Entity-ID.
Geschwindigkeitsstufe, Pause, Kamera und reduzierte Effekte dürfen das Ergebnis nie verändern.
Ein Kampfreplay speichert nicht jeden Frame, sondern Startsnapshot, Seed, Simulationsversion und Spieler-Geschwindigkeitsereignisse nur für Darstellung.
Implementierungs- und Abnahmekriterien
Ein Kampf liefert bei zehn identischen Wiederholungen byte-identische Ergebnisdaten.
Keine Einheit wechselt in fünf Sekunden mehr als zweimal ohne ausdrückliche Mobilitätsfähigkeit die Bahn.
Alle Fähigkeiten können aus Kampfprotokoll und UI-Icon auf Trigger, Ziel und Ergebnis zurückgeführt werden.
Kampfgeschwindigkeit 0,5x, 1x, 2x und 3x erzeugt dieselben Sieger, Schäden und Triggerzeitpunkte in Simulationszeit.
Ein Kampf kann nicht durch reine Beschwörungen nach Tod aller regulären Einheiten fortgesetzt werden.

## 7. Zielwahl, Bedrohung und Doktrinen
7.1 Zielscore
Jede offensive Einheit bewertet gültige Ziele. Basisscore = 100 - Distanz x 2. Dazu kommen Rollen-, Bahn-, Fähigkeits- und Doktrinwerte. Das höchste Ergebnis wird gewählt. Ein bestehendes Ziel erhält +18 Bindungsbonus, damit Einheiten nicht flackern. Ein Wechsel findet nur statt, wenn ein neues Ziel den aktuellen Score um mindestens 20 übertrifft oder das aktuelle Ziel ungültig wird.
Scorekomponente | Wert
Gleiche Bahn | +45
Benachbarte Bahn ohne Ziel auf eigener Bahn | +15
Ziel bedroht diese Einheit | +12
Ziel ist regulär statt Beschwörung | +8, außer Anti-Beschwörer
Ziel besitzt weniger als 30% LP | +10 für Duellanten
Ziel besitzt Schild oder Konstruktion | +30 für Brecher
Ziel ist Unterstützer/Magier/Beschwörer | +28 für Jäger
Ziel trägt aktive Verstärkung | +30 für Bannwirker
Ziel gehört zu Fokusfeuerziel | +25
Ziel ist durch Blocker nicht erreichbar | -1000
Bahnwechsel nötig | -18
Ziel ist beschworen | -8 standardmäßig
7.2 Rollenprioritäten
Rolle | Primäre Regel | Sekundäre Regel
Verteidiger | Nächstgelegenen Gegner binden, der die eigene Front bedroht | Wechselt nur zum Schutz eines bedrohten Hinterziels
Brecher | Schild-, Rüstungs- oder Konstruktionsziel | Danach robustestes erreichbares Ziel
Kämpfer | Nächstes erreichbares reguläres Ziel | Behält Ziel bis deutlicher Scorewechsel
Duellant | Verwundbares, schwach geschütztes Einzelziel | Darf mit Fähigkeit eine Bahn wechseln
Schütze | Freies Ziel auf eigener Bahn | Bevorzugt Fokusfeuer und geringe Deckung
Flächenmagier | Zielpunkt mit höchster Zahl gültiger Ziele | Bei Gleichstand gefährlichste Gruppe
Heiler | Verbündeter mit niedrigstem LP-Prozent, gewichtet nach drohendem Schaden | Heilt nicht bei weniger als 12% fehlenden LP
Unterstützer | Ziel mit größtem erwarteten Nutzen | Keine unnötige Selbstverstärkung
Beschwörer | Bleibt hinter nächstem Verbündeten; greift nächstes Ziel | Beschwörungen folgen eigener Regel
Kontrollmagier | Gruppe mehrerer Gegner oder Fähigkeitsträger kurz vor Auslösung | Bosse erhalten reduzierte Kontrolldauer
7.3 Deckung und Schutzlinie
Eine reguläre Einheit bietet Deckung für Verbündete derselben Bahn, wenn sie zwischen Angreifer und Ziel steht und höchstens 9 X-Einheiten vor dem Ziel ist.
Deckung macht ein Ziel nicht ungültig, gibt aber -22 Zielscore für normale Fernkämpfer und reduziert eingehenden Projektilschaden um 12%.
Brecher, magische Flächenangriffe und als durchdringend markierte Angriffe ignorieren Deckungsreduktion.
Eine Einheit kann höchstens einen Verbündeten direkt hinter sich schützen. Bei mehreren zählt der nächstgelegene.
7.4 Die sechs Doktrinen
Ausgewogen
Mechanische Wirkung: Keine Scoreänderung. Bahnwechsel nur nach Grundregeln.
Taktische Funktion: Starterdoktrin; Referenz für alle Tests.
Grenzen: Keine Doktrin gewährt direkte Rüstung, Heilung oder Angriffskraft; feste Fähigkeitstargets haben Vorrang.
Linie halten
Mechanische Wirkung: Verteidiger/Kämpfer: Zielbindungsbonus +15, Bahnwechselstrafe zusätzlich -20; maximale Vorwärtsdistanz vor nächstem Unterstützer 20.
Taktische Funktion: Schützt Hinterlinie und stabilisiert Bahnen, reduziert Jagddruck.
Grenzen: Keine Doktrin gewährt direkte Rüstung, Heilung oder Angriffskraft; feste Fähigkeitstargets haben Vorrang.
Durchbruch
Mechanische Wirkung: Offensive Nahkämpfer: Bewegung +12%; Ziele unter 40% LP +22; Zielbindungsbonus -6. Verteidiger erhalten keine Änderung.
Taktische Funktion: Ermöglicht schnellen Abschluss, erhöht Überdehnung; kein direkter Schadensbonus.
Grenzen: Keine Doktrin gewährt direkte Rüstung, Heilung oder Angriffskraft; feste Fähigkeitstargets haben Vorrang.
Schutzformation
Mechanische Wirkung: Gegner, die einen Heiler, Beschwörer oder Schützen angreifen, erhalten für mobile Verbündete +35 Score. Ein schützender Bahnwechsel darf alle 6 s erfolgen.
Taktische Funktion: Reaktive Eskorte, kann Frontdruck verteilen.
Grenzen: Keine Doktrin gewährt direkte Rüstung, Heilung oder Angriffskraft; feste Fähigkeitstargets haben Vorrang.
Fokusfeuer
Mechanische Wirkung: Schützen und geeignete Magier geben ihrem aktuellen regulären Ziel einen Fokusmarker; weitere passende Einheiten erhalten +30 Score. Marker erlischt nach 1,5 s ohne Fernangriff.
Taktische Funktion: Konzentriert Schaden, kann gegen Köder ineffizient sein.
Grenzen: Keine Doktrin gewährt direkte Rüstung, Heilung oder Angriffskraft; feste Fähigkeitstargets haben Vorrang.
Jagd auf Zauberer
Mechanische Wirkung: Mobile Nahkämpfer erhalten +38 gegen Unterstützer, Magier und Beschwörer; Bahnwechselstrafe halbiert. Nicht mobile Verteidiger unverändert.
Taktische Funktion: Starke Backline-Jagd, schwächt lokale Frontbindung.
Grenzen: Keine Doktrin gewährt direkte Rüstung, Heilung oder Angriffskraft; feste Fähigkeitstargets haben Vorrang.
Implementierungs- und Abnahmekriterien
Doktrinwechsel ist vor jedem Kampf kostenlos und während des Kampfes unmöglich.
UI zeigt für jede Einheit eine kurze Vorschau, ob die gewählte Doktrin ihr Verhalten beeinflusst.
Eine Doktrin kann kein unerreichbares Ziel gültig machen und keine feste Bossregel überschreiben.
Zielwechsel im Replay sind anhand der Scorekomponenten debugbar; im normalen UI genügt ein kurzes Zielwechsel-Symbol bei wichtigen Sprüngen.

## 8. Statuswirkungen, Buffs und Kontrolle
Statuswirkungen besitzen immer Quelle, Ziel, Startzeit, Endzeit, Stärke und Stapelgruppe. Gleiche Stapelgruppe addiert sich nur, wenn die Definition dies ausdrücklich erlaubt. Standardmäßig ersetzt die stärkere Anwendung die schwächere und erneuert die Dauer bis zum längeren Endzeitpunkt.
Effekt | Typ | Baseline | Dauer | Stapel-/Grenzregel
Schild | Positiv | Absorbiert Schaden vor LP; gemeinsame Poollogik | Bis verbraucht oder 8 s; Quellen können abweichen | Max. 60% Max-LP regulär, 25% Boss
Verstärkter Angriff | Positiv | +20% Angriffskraft | 5 s | Nicht additiv; höchste Stärke
Eile | Positiv | +20% Angriffsgeschwindigkeit | 5 s | Intervallminimum 0,45 s
Hast | Positiv | +25% Bewegungsgeschwindigkeit | 5 s | Bewegungsmaximum 14
Widerstandskraft | Positiv | +25 Rüstung und +25 Widerstand | 5 s | Verteidigungs-Cap gilt
Regeneration | Positiv | 2,5% Max-LP pro Sekunde | 6 s | Mehrere Quellen erneuern; max. 4%/s
Brennen | Negativ | 4% Angriffskraft der Quelle als magischer Schaden pro Sekunde | 5 s | Bis 3 Quellen; jede separat
Gift | Negativ | 1,5% Max-LP des Ziels pro Sekunde, max. 35 Rohschaden/s gegen Boss | 8 s | Eine Instanz; erneuert Dauer
Verlangsamung | Negativ | -25% Bewegung, -10% Angriffsgeschwindigkeit | 4 s | Nicht additiv
Schwächung | Negativ | -20% Angriffskraft und -15% erzeugte Heilung/Schilde | 5 s | Nicht additiv
Stille | Negativ | Fähigkeiten können nicht starten; Standardangriff bleibt | 2,5 s regulär | Bossdauer x Kontrollfaktor
Betäubung | Negativ | Bewegung und Aktionen gestoppt; Vorbereitung abgebrochen | 1,2 s regulär | Bossdauer stark reduziert
Markierung | Neutral/Negativ | Definierte Quellen priorisieren das Ziel; Icon zeigt Quelle | 6 s | Mehrere Markentypen möglich, je Typ eine
Verwirrung | Negativ | Zielscore neu berechnet ohne Rollenbonus; kein Friendly Fire | 1,5 s | Boss erhält nur Ladeverlust, keine Zieländerung
Unverwundbar | Positiv/Spezial | Kein Schaden, keine negative Wirkung | Max. 1,5 s | Nur Phasenübergang/Ausweichen; nicht verlängerbar
8.1 Kontrollresistenz
Effektive Dauer harter Kontrolle = Basisdauer x (1 - Kontrollresistenz). Harte Kontrolle umfasst Betäubung, Stille und Verwirrung. Verlangsamung ist weich. Reguläre Bosse besitzen 70% Kontrollresistenz, Ascension-Bosse 80% und das Herz des Risses 85%. Kein harter Kontrolleffekt auf Bosse darf länger als 0,65 Sekunden dauern.
8.2 Reinigung und Bannung
Reinigung entfernt negative Wirkungen vom Verbündeten. Priorität: Betäubung/Stille, Schwächung, Gift/Brennen, Verlangsamung, Markierung.
Bannung entfernt positive Wirkungen vom Gegner. Priorität: Unverwundbar ist nicht bannbar; danach Schild, Eile/Verstärkung, Regeneration, Widerstandskraft.
Ein Effekt kann als nicht reinigbar oder nicht bannbar markiert sein, insbesondere Bossphasen und Schlachtfeldregeln. Dies muss im Tooltip stehen.
Entfernen eines Schildes durch Bannung vernichtet höchstens 35% der maximalen LP des Ziels als Schildmenge pro Bann; größere Pools werden auf diesen Betrag reduziert statt vollständig gelöscht.
Implementierungs- und Abnahmekriterien
Jeder aktive Effekt besitzt ein Icon mit eindeutiger Form, Fortschrittsring und gestapelter Quellenzahl, falls relevant.
Keine reguläre Einheit kann durch wiederholte Standardkontrolle dauerhaft aktionsunfähig gehalten werden.
Bosse zeigen bei reduzierter Kontrolle ein sichtbares Resistenzfeedback statt scheinbar den Effekt zu ignorieren.
Statuswerte im Kampflog stimmen mit den sichtbaren Dauern auf 0,1 Sekunden überein.

## 9. Formation, Gruppengröße und Plätze
Formationstableau: drei Bahnen x drei Tiefenzonen = neun Startfelder.
Maximal sieben reguläre Einheiten; maximal drei davon Helden; maximal drei Kopien desselben Truppentyps.
Spielbeginn vier Plätze; fünfter Platz nach Expedition 1.3; sechster nach Akt II; siebter nach Akt III.
Ein Startfeld kann nur eine reguläre Einheit enthalten. Startbeschwörungen werden in definierten freien Positionen derselben Bahn erzeugt und belegen keinen Startplatz.
Eine leere Bahn ist erlaubt und wird vor Kampfstart mit einer Warnung markiert, wenn der Gegner dort Frontdruck besitzt.
Vier Formationsvorlagen: Standard, Defensiv, Offensiv, frei benannte Spezialformation. Gespeichert werden Einheiten, exakte Kopien, Felder, Kits, Heldenausrüstung, Banner und Doktrin.
Beim unvollständigen Laden einer Vorlage werden fehlende Inhalte übersprungen; nichts wird automatisch durch eine andere Einheit ersetzt.
9.1 Formationsvalidierung
Mindestens eine reguläre Einheit muss eingesetzt werden.
Keine doppelte Heldeninstanz und keine Überschreitung des Vertragslevels.
Jede ausgerüstete Kopie darf genau ein Truppenkit tragen; ein physisches Kit-Objekt kann beliebig oft als Vorlage genutzt werden, wird also nicht zwischen Kopien verbraucht.
Jeder Held trägt maximal eine passende Hauptausrüstung und einen Talisman.
Eine Warnung ist nicht blockierend bei fehlendem Heiler, leerer Bahn oder fehlendem Nahkämpfer; harte Regelverstöße blockieren den Start.

## 10. Merkmale und Synergien
Jede reguläre Einheit besitzt höchstens zwei Merkmale. Eine Synergie zählt eingesetzte reguläre Einheiten, nicht Kopien von Beschwörungen. Schwellen liegen bei zwei und drei Einheiten. Mehr als drei erhöht den Effekt nicht. Einheiten mit zwei Merkmalen zählen für beide.
Merkmal | 2er-Schwelle | 3er-Schwelle
Königreich | Erste eigene Fronteinheit, die Schaden erhält, bekommt Schild = 12% Max-LP für 6 s. | Zusätzlich erhält die nächstgelegene eigene Einheit derselben oder benachbarten Bahn Schild = 8% Max-LP.
Wildnis | Tierbeschwörungen +18% Bewegung. | Nach Zielwechsel erhalten Tierbeschwörungen 4 s lang +20% Angriffskraft; intern 6 s Abklingzeit.
Arkan | Erster Fähigkeitseinsatz jeder Arkan-Einheit beginnt mit 20% Vorladung. | Nach ihrem ersten Einsatz erhält jede Arkan-Einheit 15% Vorladung für den nächsten Zyklus.
Glaube | Erzeugte Heilung und Schilde +10%. | Erster negative Effekt pro regulärem Verbündeten wird um 50% verkürzt; einmal pro Kampf je Einheit.
Unterwelt | Skelette und Dämonen +20% Max-LP. | Erste eigene Unterwelt-Beschwörung, die fällt, kehrt nach 1,5 s mit 45% LP zurück.
Konstruktion | Konstruktionen reparieren 1,5% Max-LP pro Sekunde, wenn 3 s kein Schaden. | Erste zerstörte eigene Konstruktion erzeugt 6 s Schutzfeld: Verbündete darin -15% eingehender Schaden.
Söldner | Söldner-Einheiten erhalten +8% Angriffskraft, solange keine zwei identischen Truppentypen eingesetzt sind. | Zusätzlich +8 Rüstung/Widerstand; Bonus entfällt nur für doppelte Typen, nicht für Helden.
Beschwörer | Alle eigenen Beschwörungen starten mit 10% Vorladung ihrer ersten Aktion und +10% Dauer. | Beschwörungsgrenze bleibt 6; beim Erreichen der Grenze erhält die älteste Beschwörung +20% Angriffskraft statt einer siebten Einheit.
Implementierungs- und Abnahmekriterien
Aktive und beinahe aktive Synergien werden im Formationsscreen live berechnet.
Synergieeffekte werden im Kampflog als eigene Quelle ausgewiesen.
Keine Synergie ist Voraussetzung zum Gewinnen auf Normal; sie darf passende Gruppen spürbar verstärken, aber Rollenfehler nicht vollständig kompensieren.
Beschwörungen zählen niemals zur Schwelle, außer eine spätere explizite Inhaltserweiterung benennt dies.

## 42. Savegame, Versionierung und Offline-Verhalten
Mindestens drei rotierende lokale Autosave-Slots plus ein manuelles Profil-Backup im App-Speicher.
Save enthält schemaVersion, contentVersion, simulationVersion, Fortschritt, Inventarfreischaltungen, Politur, Ruhm, Meisterschaft, Erfolge, Einstellungen, aktuelle Expedition und deterministische Seeds.
Schreibvorgang atomar: in temporäre Datei, Prüfsumme, dann ersetzen. Beschädigter neuester Slot fällt auf vorherigen zurück und informiert den Spieler.
Migrationen sind vorwärtsgerichtet und idempotent. Ein Save wird vor Migration gesichert.
Laufender Kampf speichert Startsnapshot plus aktuellen Simulationszustand; Fortsetzen darf nicht neu würfeln oder zum Kampfbeginn zurücksetzen, außer Snapshot ist technisch ungültig. Dann wird der Kampf mit demselben Seed vom Beginn wiederholt und klar erklärt.
Kein Fortschritt hängt von Uhrzeit, Zeitzone, Geräte-ID, Account oder Internet ab.
Deinstallation kann lokale Daten löschen; Export/Import eines Savefiles ist als Komfortfunktion vorgesehen, aber keine Cloudpflicht.

## 48. Verbindliche Restklarstellungen und Konfliktauflösung
Dieses Kapitel beseitigt die letzten Interpretationsräume der inhaltlichen Version 3. Bei Widersprüchen gilt die folgende Prioritätsreihenfolge: explizite V4-Klarstellung vor älterer V3-Formulierung; konkrete Einheiten- oder Bossregel vor globaler Standardregel; Sicherheits-, Save- und Store-Regel vor Komfortregel; feste Obergrenze vor Bonus; deterministischer Tie-Break vor zufälliger Auswahl. Kein Implementierungsagent darf aus einer unklaren Formulierung neue Inhalte, neue Währungen, weitere Slots oder zusätzliche Live-Systeme ableiten.
48.1 Begriffe und verbindliche Zeitbasis
Begriff | Verbindliche Bedeutung
Kampfzeit | Simulationszeit bei 1x. 2x und 3x beschleunigen Simulationsschritte, verändern aber keine Dauer in Kampfzeit.
Reale Zeit | Wall-Clock-Zeit des Geräts. Sie wird nur für UI-Animationen, Debounce und Systemdialoge benutzt, nie für Belohnung oder Kampfentscheidung.
Nah | Gleiche Bahn und Distanz <= 8 logische X-Einheiten, sofern keine Fähigkeit einen anderen Radius nennt.
Benachbart | Direkt angrenzende Bahn oder direkt angrenzende Tiefenzone. Diagonal ist nur benachbart, wenn die konkrete Regel es sagt.
Deutlich verletzt | Aktuelle LP <= 60% des Maximums.
Wenig Leben | Aktuelle LP <= 30% des Maximums.
Starker Treffer | Ein einzelnes Schadensereignis nach Verteidigung >= 18% der maximalen LP des Ziels oder ausdrücklich als stark markiert.
Gefährlichster Gegner | Höchster Threat-Rating-Wert aus erwarteter 8-Sekunden-Wirkung; Gleichstand: Boss > Champion > Elite > Support > Schaden > Tank > niedrigste stabile Entity-ID.
Reguläre Einheit | Held oder eingesetzte Truppenkopie. Beschwörungen, Bossobjekte und Konstruktionen ohne Gruppenplatz sind nicht regulär.
Fallen | Entity wechselt atomar in defeated; Zielbarkeit, Kollision und Aura enden sofort. Die sichtbare Auflösungsanimation ist rein kosmetisch.
Einmal pro Kampf | Zähler wird bei BattleStart auf verfügbar gesetzt und erst beim erfolgreichen Commit des Effekts verbraucht; abgebrochene Vorbereitung verbraucht ihn nicht.
Fähigkeit bereit | Ladung vollständig, Trigger erfüllt, gültiges Ziel vorhanden und Owner kampffähig. Fehlt ein Ziel, bleibt sie bereit ohne Überladung.
48.2 Priorität gleichzeitiger Ereignisse
1. Ein Simulations-Tick sammelt zunächst Eingaben und bereits geplante Ereignisse, verändert aber noch keinen Zustand.
2. Zuerst werden Kampfende- und Phasenübergangsbedingungen geprüft. Ein Bossphasenwechsel verhindert Schaden über die Phasengrenze nur, wenn die Bossdefinition ausdrücklich eine Übergangssperre besitzt.
3. Danach werden Wiederbelebungen, Todesverhinderungen und Schild-vor-LP-Regeln aufgelöst.
4. Danach werden Schaden, Heilung, Kontrolle, Bewegung und Beschwörungen in der Ereignispriorität ausgeführt.
5. Gleichrangige Ereignisse werden nach scheduledTick, priority, sourceEntityId, abilityId und eventSequence sortiert. Entity-IDs sind stabil; Array- oder Renderreihenfolge ist niemals ein Tie-Break.
6. Erreicht eine Seite im selben Tick den Zustand ohne reguläre kampffähige Einheit, gilt: Boss-/Missionssonderregel, sonst Doppelniederlage. Eine Doppelniederlage zählt als Niederlage des Spielers und erzeugt keinen Siegloot.
48.3 Beschwörungslimit und Ersatz
Jede Seite besitzt exakt sechs aktive Beschwörungs-Slots. Stationäre Konstruktionen zählen mit, wenn ihre Definition countsTowardSummonLimit=true setzt.
Kann eine Fähigkeit mehrere Einheiten erzeugen, werden freie Slots in der definierten Spawn-Reihenfolge belegt. Nicht erzeugte Einheiten verursachen weder Explosion noch OnSpawn-Effekt.
Ersatz ist nur erlaubt, wenn die Fähigkeit replacementPolicy=replace_lower_priority besitzt. Ersetzt wird die eigene aktive Beschwörung mit niedrigstem replacementPriority; Gleichstand: kürzeste Restlebenszeit, dann älteste Spawn-Sequenz.
Ein ersetztes Wesen erhält expirationReason=replaced und löst keine Effekte aus, die nur bei defeated gelten. Ausdrücklich auf expiration reagierende Effekte dürfen auslösen.
Beschwörungen können einen Gegner besiegen, aber der Kampf endet sofort, wenn ihre Seite keine reguläre Einheit mehr besitzt; nach Kampfende werden keine nachlaufenden Geschosse gewertet.
48.4 Kontrolle, Immunität und Bossinteraktion
Betäubung, Stille, Rückstoß und erzwungener Bahnwechsel sind harte Kontrolle. Verlangsamung, Schwächung, Markierung, Brennen und Gift sind weiche Effekte.
Kontrollresistenz reduziert nur Dauer, nie die sichtbare Auslösung. Eine auf 0,15 s oder weniger reduzierte harte Kontrolle wird als 0,15-s-Unterbrechungsimpuls dargestellt.
Phasenübergänge reinigen harte Kontrolle, unterbrechen gegnerische Projektile jedoch nicht. Bereits abgeschossene Geschosse dürfen treffen, sofern die Phase nicht ausdrücklich unverwundbar ist.
Bosse können nicht von normalen Effekten die Bahn wechseln. Rückstoß wird in 0,25 s Unterbrechung umgewandelt, sofern keine Bossfähigkeit gerade als uninterruptible markiert ist.
Mehrere Reinigungen im selben Tick entfernen einen Effekt nur einmal. Die Quelle der zuerst sortierten Reinigung erhält die Statistikgutschrift.
48.5 Beute, Duplikate und volle Inventare
Das permanente Inventar besitzt keine Gesamtplatzgrenze. Ein Gegenstand kann nur einmal dauerhaft besessen werden; ein Duplikat wird unmittelbar in den im Gegenstandsdatensatz definierten Goldwert umgewandelt.
Politur ist ein boolescher permanenter Zustand je Gegenstands-ID. Ein poliertes Duplikat erzeugt nicht mehr Gold als ein unpoliertes Duplikat.
Temporäre Relikte dürfen bis zu acht unterschiedliche aktive Karten besitzen. Ein neuntes Relikt öffnet zwingend Ersetzen oder Ablehnen; Ablehnen gibt 20% des Relikt-Händlerwerts in Zyklus-/Dungeonwährung.
Belohnungen werden vor der nächsten Navigation persistent committed. Ein Prozessabbruch zwischen Wahl und Animation lädt den bereits committed Zustand und zeigt nur die Abschlussanimation erneut.
Kann eine Erstbelohnung wegen bereits freigeschaltetem Inhalt nicht erneut vergeben werden, wird exakt die dokumentierte Ersatzbelohnung genutzt; niemals wird zufällig ein anderer permanenter Inhalt vergeben.
48.6 Schwierigkeit, Instabilität und Ascension
Reihenfolge | Multiplikation/Regel
1. Basis | Einheiten- oder Bossbasiswerte.
2. Missionsbereich | Nur normale Gegner: Kampagnen-Missionsmultiplikator.
3. Kampagnenschwierigkeit | Entdecker/Normal/Veteran auf LP, Angriff und Ladung.
4. Riftinstabilität | Nur explizit definierte Instabilitätsboni.
5. Ascension/Jenseits | Kumulative Rangregeln und Gradmultiplikator.
6. Elite/Champion | Eigenschaftsspezifische Werte.
7. Schlachtfeld | Kampfmodifikator; keine rückwirkende Änderung bereits erzeugter Schilde.
Rundung | Zwischenergebnisse bleiben Integer-Milliwerte; erst sichtbare UI-Werte werden kaufmännisch gerundet.
Entdecker, Normal und Veteran gelten nur für Kampagne und Kampagnenwiederholung. Ascension verwendet seine eigene Baseline und ignoriert die Kampagnenschwierigkeit.
Endlose Rift nutzt Normal-Baseline plus Tiefenskalierung und optional gewählten bereits freigeschalteten Ascension-Regelsatz. Jenseitsgrad darf nicht zusätzlich auf Endlose Rift angewendet werden.
Ein Schlachtfeldmodifikator darf nie eine Bosskernmechanik vollständig neutralisieren oder deren angekündigte Gegenstrategie unmöglich machen. Der Encounter-Validator lehnt solche Kombinationen ab.
48.7 Anti-Wiederholung und Generator-Fallback
Der Generator führt pro Modus einen Verlauf der letzten drei Kartenprofile, letzten acht Ereignisse, letzten sechs normalen Formationen und letzten vier Modifikatoren.
Identische Ereignis-ID ist innerhalb einer Expedition verboten. Außerhalb darf sie erst nach vier anderen Ereignissen erneut erscheinen, sofern der Pool mindestens fünf gültige Einträge besitzt.
Kann ein Pool wegen Freischaltungen oder Ausschlüssen die Regel nicht erfüllen, wird die geringste Wiederholungsstrafe gewählt; die Karte darf niemals unendlich neu würfeln. Maximal 50 Generierungsversuche, danach deterministisches Fallback-Profil.
Das Fallback-Profil enthält genau sechs Ebenen, einen normalen Kampf, einen Händler oder Rekrutierungsknoten, einen Elitekampf, einen Anker, eine letzte Vorbereitung und das Ziel. Es ist immer erreichbar und verwendet keine Doppelmodifikatoren.
Generatorfehler werden lokal protokolliert, aber der Spieler sieht nur „Die Rift wurde stabilisiert“; Fortschritt und Seed bleiben erhalten.
48.8 Abschlusszustände
Zustand | Folge
Mission gewonnen | Erst-/Wiederholungsbelohnung committen, Ruhm und Meisterschaft aktualisieren, Storyflag setzen, HQ laden.
Freiwilliger Rückzug am Anker | Gesicherte Beute plus dokumentierter Anteil ungesicherten Goldes; Mission nicht abgeschlossen; Ruhm nur wenn mindestens drei Knoten erreicht.
Niederlage | Modusabhängiger Goldbehalt; keine ungesicherten Gegenstände/Relikte; permanente Freischaltungen unverändert.
App geschlossen | Kein Spielereignis. Letzter atomarer Snapshot wird geladen; kein Verlust als Strafe.
Kampagne abgeschlossen | Abschlusssequenz einmal, danach frei wiederholbar; Endgameflags atomar gemeinsam setzen.
100% Fortschritt | Keine zusätzliche Macht. Titel, Statistik und kosmetische HQ-Auszeichnung.

## 51. Deterministische Simulation und Replay-Architektur
51.1 Fixed-Step und Zahlenmodell
Parameter | Festlegung
Simulationsrate | 30 Ticks pro Kampfsekunde; tickDuration = 33 1/3 ms logisch.
Renderziel | 60 FPS; Interpolation zwischen zwei bestätigten Simulationssnapshots.
Zeitwerte | Als ganze Ticks gespeichert. Daten in Sekunden werden beim Laden deterministisch zu Ticks gerundet.
Statwerte | Milliwerte als Integer: 1000 = 1 sichtbare Einheit. Prozent in Basispunkten: 10000 = 100%.
Multiplikation | Math.imul für 32-Bit-Faktoren oder sichere Integerrechnung; Zwischenwert muss unter Number.MAX_SAFE_INTEGER bleiben.
Rundung | round-half-away-from-zero nach jedem abgeschlossenen Formelschritt, nicht rendererabhängig.
Positionswerte | 1/100 logische X-Einheit als Integer. Keine Floatposition in autoritativem Zustand.
Tick-Overrun | Simulation darf mehrere Ticks nachholen, aber maximal 8 pro Renderframe. Danach Renderqualität reduzieren; niemals Ticks überspringen.
51.2 Zufallsgenerator
PRNG ist xoshiro128** mit vier unsigned 32-bit Zustandswerten. Seeding erfolgt über SplitMix32 aus einem 128-bit Run-Seed, der als vier Hex-UInt32 gespeichert wird.
Getrennte Streams: map, encounter, rewards, eventChoices, combatCosmetic. Der combatCosmetic-Stream darf keinen Gameplayzustand beeinflussen.
Jeder deterministische Rollslot besitzt einen stabilen String-Key. Neue Rolls dürfen nicht zwischen bestehende Rolls eingefügt werden; sie erhalten einen neuen Slot oder erhöhen simulationVersion.
Math.random ist im gesamten Quelltext per ESLint verboten. UI-Konfetti darf den Cosmetic-Stream oder crypto.getRandomValues nutzen, aber nie Replaydaten verändern.
Replaydatei speichert Seed, contentVersion, simulationVersion, Startsnapshot und Spielerentscheidungen. Aus ihr muss das Ergebnis bit-identisch rekonstruierbar sein.
51.3 Simulationszustandsautomat
BattleState = PREPARED -> INTRO -> ACTIVE -> PHASE_TRANSITION -> ACTIVE             -> RESOLVING_END -> VICTORY | DEFEAT | DRAW_ABORTEntityState = SPAWNING -> ACTIVE -> PREPARING -> EXECUTING -> RECOVERING              -> CONTROLLED -> DEFEATED -> REMOVED
INTRO besitzt keine autoritativen Angriffe. Startpassiven werden am ersten ACTIVE-Tick in stabiler Priorität committed.
PHASE_TRANSITION pausiert Bossaktionen und Fähigkeitladung nur, wenn die Phase es definiert; die globale Standarddauer beträgt 45 Ticks.
RESOLVING_END dauert autoritativ höchstens 3 Ticks und verarbeitet bereits committed Wiederbelebung/Todesverhinderung. Kosmetische Outrozeit liegt außerhalb der Simulation.
Ein Kampf erhält ein hartes Simulationslimit von 5400 Ticks = 180 Sekunden. Danach greift die in V3 definierte Riftkollapswertung; kein unendlicher Kampf.
51.4 Eventtypen und Log
Kategorie | Pflichtevents
Lifecycle | BattleStarted, PhaseStarted, BattleEnded
Entity | Spawned, Activated, TargetChanged, MovedLane, Defeated, Removed, Revived
Combat | AttackPrepared, ProjectileSpawned, DamageApplied, HealApplied, ShieldApplied, EffectApplied, EffectRemoved
Ability | ChargeReady, AbilityPrepared, AbilityInterrupted, AbilityCommitted, AbilityResolved
World | ModifierTriggered, HazardTelegraphed, HazardResolved, ReinforcementQueued, ReinforcementSpawned
Diagnostics | InvalidTargetPrevented, SummonLimitBlocked, FallbackRuleUsed, SafetyCapTriggered
Jedes Event enthält tick, sequence, type, sourceId, targetIds, ability/effect ID, integer payload und localization-safe logTags.
Der Ergebnisbildschirm liest ausschließlich aggregierte Events. Er schätzt keine Werte aus Renderanimationen.
Debug-Replays können das vollständige Eventlog speichern; normale Saves speichern nur Snapshot plus Entscheidungen, um Dateigröße zu begrenzen.

## 73. Kanonische Konstanten, Einheiten, Enums und ID-Regeln
73.1 Einzige Quelle globaler Regeln
Alle globalen Gameplay-, Save-, UI- und technischen Konstanten liegen in versionierten, typisierten Konfigurationsmodulen. Kein Magic Number darf außerhalb der jeweils autorisierten Datei dupliziert werden.
// src/game/rules/gameRules.tsexport const GAME_RULES = {  simulationTicksPerSecond: 30,  formationLanes: 3,  formationDepths: 3,  maxRegularUnitsPerSide: 7,  maxHeroesPerPlayerGroup: 3,  maxCopiesPerTroopType: 3,  maxActiveSummonsPerSide: 6,  baseActiveRelics: 6,  deepEndlessActiveRelics: 8,  absoluteMaxActiveRelics: 8,  heroLevelMin: 1,  heroLevelMax: 3,  permanentEquipmentSlotsPerHero: 2,  formationPresetCount: 4,  normalRiftCollapseStartTicks: 90 * 30,  eliteRiftCollapseStartTicks: 90 * 30,  bossRiftCollapseStartTicks: 120 * 30,  riftCollapseDurationTicks: 15 * 30,  absoluteBattleAbortTicks: 180 * 30,  autosaveRotationSlots: 3,  supportedLocales: ['de', 'en'] as const,} as const;
73.2 Autoritative Einheiten und Rundung
Domäne | Interne Einheit | Regel
Zeit | ganze Simulationsticks | 1 Sekunde = 30 Ticks. UI-Sekunden sind Anzeige; kein Floattimer im Simulationszustand.
Position | 1/100 X-Einheit als Integer | 0..10000. Bahnen sind Enum 0..2; keine Y-Physik in der Simulation.
Werte | Milliwerte | 1000 intern = 1 sichtbarer Punkt. LP/Schaden/Schilde bleiben Integer.
Prozent | Basispunkte | 10000 = 100%; zulässiger Normalbereich 0..50000, datensatzspezifisch enger.
Währung | ganze Einheiten | Keine Dezimalwährung und keine negative Bilanz.
IDs | lower_snake_case ASCII | Unveränderlich nach Release; Anzeige kommt ausschließlich über Localization Key.
Sortierung | Unicode-freie stabile Schlüssel | Gameplay nutzt ID/Index, nicht lokalisierte Namen.
Rundung | half-away-from-zero | Nur an ausdrücklich markierten Formelschritten; UI rundet separat.
73.3 Vollständige Kern-Enums
Enum | Erlaubte Werte
Side | player, enemy
Lane | top, middle, bottom
Depth | front, middle, back
UnitCategory | hero, troop, summon, enemy, boss, boss_object
RoleTag | defender, fighter, breaker, duelist, marksman, mage, healer, support, summoner, controller, constructor
DamageType | physical, magical, true
TargetKind | enemy_unit, allied_unit, self, ground_position, summon_slot, boss_object
AbilityKind | passive, basic_attack, signature, level3_once, boss, modifier, item
StatusKind | shield, attack_up, attack_speed_up, move_speed_up, resistance_up, regeneration, burn, poison, slow, weaken, silence, stun, mark, confusion
StackPolicy | replace_if_stronger, refresh_duration, extend_duration_capped, independent_by_source, no_reapply
Difficulty | explorer, normal, veteran
RunMode | campaign, campaign_replay, ascension, beyond, endless
QualityTier | auto, high, medium, low
SaveCommitReason | profile_change, node_entered, decision_committed, battle_started, battle_snapshot, battle_finished, reward_committed, run_finished, settings_changed, manual_backup
RecoveryReason | none, newest_slot_invalid, run_invalid, content_mismatch, migration_failed, renderer_unavailable, insufficient_storage
73.4 ID-Namensräume und Referenzregeln
Präfixe: hero_, troop_, summon_, enemy_, boss_, ability_, attack_, status_, trait_, synergy_, item_, talisman_, kit_, banner_, relic_, mission_, encounter_, event_, modifier_, achievement_, mastery_, screen_, audio_, visual_.
Eine ID darf nur einem Inhaltstyp gehören. Buildvalidierung verwirft doppelte IDs auch über unterschiedliche Dateien.
Referenzen werden niemals über Arrayposition oder Anzeigenamen gespeichert. Savegames speichern ausschließlich stabile IDs und schemaVersion/contentVersion.
Entfernen oder Umdeuten einer veröffentlichten ID ist verboten. Nicht mehr genutzte Inhalte werden deprecated und durch Migration/Replacement-ID behandelt.
Lokalisierungskeys folgen content.<type>.<id>.<field> beziehungsweise ui.<screen>.<element>. Fehlende Keys sind Release-Buildfehler.

## 75. Konkrete Datenmodelle, Schemas und Inhaltskompilierung
75.1 Null-/Optional-Semantik
Ein Pflichtfeld fehlt niemals. undefined ist ausschließlich für technisch optionale, nicht serialisierte Funktionsparameter zulässig.
JSON verwendet null nur, wenn „bewusst kein Wert“ eine fachliche Aussage ist. Leere Arrays bedeuten „gültig, aber keine Einträge“.
Defaults werden beim Source-Content nicht still ergänzt. Der Compiler materialisiert explizite Defaults in generated content, damit Runtime und Tests denselben Wert sehen.
Unbekannte Felder sind in Source-, Save- und Importdaten Fehler. Forward Compatibility erfolgt über schemaVersion und Migration, nicht durch Ignorieren.
75.2 Zentrale Typen
type ContentId = string;type LocalizationKey = string;type Tick = number;type MilliValue = number;type BasisPoints = number;interface ContentManifest {  schemaVersion: number;  contentVersion: string;          // SHA-256 of canonical generated content  simulationVersion: number;  localeVersions: Record<'de' | 'en', string>;  counts: Record<string, number>;  files: Array<{ path: string; sha256: string; byteLength: number }>;}interface UnitStats {  maxHp: MilliValue;  armor: MilliValue;  resistance: MilliValue;  attackPower: MilliValue;  attackIntervalTicks: Tick;  preparationTicks: Tick;  rangeX100: number;  movementX100PerSecond: number;  controlResistanceBps: BasisPoints;}interface UnitDefinition {  id: ContentId;  category: 'hero' | 'troop' | 'summon' | 'enemy' | 'boss' | 'boss_object';  displayNameKey: LocalizationKey;  roleTags: RoleTag[];  traitIds: ContentId[];           // 0..2  baseStats: UnitStats;  collisionRadiusX100: number;  preferredDepths: Depth[];  basicAttackId: ContentId;  passiveAbilityIds: ContentId[];  activeAbilityIds: ContentId[];  targetProfileId: ContentId;  visualId: ContentId;  audioId: ContentId;  codexId: ContentId;}interface AbilityDefinition {  id: ContentId;  kind: AbilityKind;  trigger: TriggerDefinition;  target: TargetQuery;  chargeTicks: Tick | null;  cooldownTicks: Tick | null;  castTicks: Tick;  recoveryTicks: Tick;  interruptPolicy: 'interruptible' | 'cast_committed' | 'uninterruptible';  usesPerBattle: number | null;  effects: EffectDefinition[];  telegraphId: ContentId;  invalidTargetPolicy: 'wait' | 'retarget' | 'consume_without_effect';}interface StatusDefinition {  id: ContentId;  kind: StatusKind;  stackPolicy: StackPolicy;  maxStacks: number;  durationCapTicks: Tick | null;  dispelCategory: 'positive' | 'negative' | 'control' | 'none';  bossPolicy: 'normal' | 'duration_reduced' | 'convert_to_interrupt' | 'immune';  statModifiers: StatModifier[];  periodicEffects: PeriodicEffect[];}
75.3 Encounter-, Mission- und Ereignisverträge
interface EncounterDefinition {  id: ContentId;  regionId: ContentId;  kind: 'normal' | 'elite' | 'boss' | 'survival' | 'reinforcement';  enemySlots: Array<{ unitId: ContentId; lane: Lane; depth: Depth; eliteId?: ContentId }>;  modifierIds: ContentId[];  reinforcementWaves: ReinforcementWave[];  objective: CombatObjective;  rewardTableId: ContentId;  previewDisclosure: PreviewDisclosure;  allowedModes: RunMode[];}interface MissionDefinition {  id: ContentId;  act: 1 | 2 | 3 | 4;  sequence: number;  titleKey: LocalizationKey;  objective: MissionObjective;  mapProfileId: ContentId;  mandatoryNodeRules: NodeRule[];  encounterPoolIds: ContentId[];  firstCompletionRewards: RewardDefinition[];  repeatRewards: RewardDefinition[];  unlockFlags: string[];  storyEntryKeys: LocalizationKey[];}interface EventDefinition {  id: ContentId;  regionTags: ContentId[];  riskTier: 0 | 1 | 2 | 3;  titleKey: LocalizationKey;  bodyKey: LocalizationKey;  prerequisites: PredicateDefinition[];  options: EventOptionDefinition[];  deterministicRollSlots: string[];  repeatPolicy: 'once_per_run' | 'history_limited';}
75.4 Compiler- und Laufzeitpipeline
Schritt | Eingabe | Ausgabe/Gate
1 Source parse | UTF-8 JSON, Localization ICU, Assetmanifest | Syntaxfehler, Duplikatkeys und verbotene Unicode-Steuerzeichen blockieren.
2 Schema validation | Zod strict schemas | Kein unbekanntes oder fehlendes Feld.
3 Cross-reference | Alle IDs/Keys/Assets | Jede Referenz existiert und besitzt passenden Typ.
4 Semantic validation | Regeln/Counts/Kompatibilität | Obergrenzen, Trigger, Pools, Bossphasen und Screenlinks gültig.
5 Canonicalization | Sortierte Source-Daten | Stabile Schlüsselreihenfolge, normalisierte Zahlen, keine Kommentare.
6 Index build | Canonical content | Maps nach ID, Poolindizes, Such-/Kodexindizes.
7 Hashing | Alle generated files | contentVersion und file SHA-256.
8 Runtime load | Manifest + generated content | Hash/Schema prüfen; bei Fehler S02 Recovery statt Teilstart.
75.5 Semantische Pflichtvalidatoren
Exakte Releasecounts gemäß Kapitel 2.1; eine Abweichung blockiert release, außer eine neue Dokumentversion ändert den Umfang.
Jede reguläre Einheit besitzt genau einen Standardangriff, mindestens ein Zielprofil, vollständige Visual-/Audio-/Codexreferenzen und gültige Startzone.
Jede automatisch auslösende Fähigkeit besitzt Trigger, Ziel, Cast-/Recoveryzeit, InvalidTargetPolicy, Telegraphie und Effektliste.
Jeder Boss besitzt vollständig abgedeckte LP-Phasen ohne Lücke/Überlappung, eine maximale Kampfdauer und Vorschau für alle strategisch relevanten Mechaniken.
Jede Mission generiert 5-8 besuchte Knoten, garantiert ihre Pflichtknoten, hat mindestens drei gültige normale Encounter-Varianten pro Kampfslot und endet erreichbar.
Jedes Ereignis besitzt zwei oder drei Optionen, sichtbare Kosten/Folgen, deterministische Randomslots und eine valide Ablehn-/Fallbackfolge.
Jeder Screen verweist auf existierende Route, Localization Keys, Icons und mindestens einen Happy-Path-E2E-Test.
